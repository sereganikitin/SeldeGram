// VPN-модуль: управляет локальным sing-box sidecar, хранилищем профилей
// и парсингом популярных схем (vless://, hy2://, ss://). Все команды
// возвращают результат через JSON в форматах, удобных фронту.
//
// Архитектура:
// - sing-box.exe лежит как Tauri sidecar (binaries/sing-box).
// - Профили (sing-box outbound JSON + метаданные) хранятся в
//   $APP_DATA/vpn-profiles.json.
// - При connect: пишем во временный singbox-config.json целевой профиль
//   + SOCKS5 inbound на 127.0.0.1:1080, спавним sidecar, ждём readiness.
// - WebView проксируется через 127.0.0.1:1080 — это делает фронт через
//   set_proxy + перезагрузку окна.

use anyhow::{anyhow, Context, Result};
use base64::{engine::general_purpose, Engine as _};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use url::Url;
use uuid::Uuid;

const SOCKS_PORT: u16 = 47180; // нестандартный, чтобы не конфликтовать с локальным юзерским SOCKS

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Profile {
    pub id: String,
    pub name: String,
    /// Метка типа для UI ("vless" / "hysteria2" / "shadowsocks" / "json")
    pub kind: String,
    pub server: Option<String>,
    /// sing-box outbound JSON
    pub outbound: Value,
    pub created_at: String,
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct ProfileStore {
    pub profiles: Vec<Profile>,
    pub active_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct VpnStatus {
    pub connected: bool,
    pub active_id: Option<String>,
    pub socks_port: u16,
}

struct Runtime {
    child: Option<Child>,
    active_id: Option<String>,
}

static RUNTIME: Lazy<Mutex<Runtime>> = Lazy::new(|| {
    Mutex::new(Runtime {
        child: None,
        active_id: None,
    })
});

fn store_path(app: &AppHandle) -> Result<PathBuf> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| anyhow!("app_data_dir: {e}"))?;
    fs::create_dir_all(&dir).ok();
    Ok(dir.join("vpn-profiles.json"))
}

fn singbox_config_path(app: &AppHandle) -> Result<PathBuf> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| anyhow!("app_data_dir: {e}"))?;
    fs::create_dir_all(&dir).ok();
    Ok(dir.join("singbox-config.json"))
}

fn singbox_binary_path(app: &AppHandle) -> Result<PathBuf> {
    // sidecar resolved by Tauri at runtime (resource dir под именем
    // sing-box-<triple>.exe); используем path API.
    let resource = app
        .path()
        .resolve(
            "binaries/sing-box",
            tauri::path::BaseDirectory::Resource,
        )
        .ok();
    if let Some(p) = resource {
        // На разных таргетах Tauri добавляет суффикс таргета.
        // Перебираем варианты.
        let candidates = [
            p.clone(),
            p.with_extension("exe"),
            p.with_file_name(format!("sing-box-x86_64-pc-windows-msvc.exe")),
        ];
        for c in candidates {
            if c.exists() {
                return Ok(c);
            }
        }
    }
    // dev-режим: ищем рядом с проектом
    let here = std::env::current_exe()?.parent().map(|p| p.to_path_buf());
    if let Some(p) = here {
        for name in ["sing-box.exe", "sing-box-x86_64-pc-windows-msvc.exe"] {
            let c = p.join(name);
            if c.exists() {
                return Ok(c);
            }
        }
    }
    Err(anyhow!(
        "sing-box binary not found — положи sing-box.exe в desktop/src-tauri/binaries/sing-box-x86_64-pc-windows-msvc.exe"
    ))
}

fn load_store(app: &AppHandle) -> Result<ProfileStore> {
    let p = store_path(app)?;
    if !p.exists() {
        return Ok(ProfileStore::default());
    }
    let txt = fs::read_to_string(&p).with_context(|| format!("read {}", p.display()))?;
    Ok(serde_json::from_str(&txt).unwrap_or_default())
}

fn save_store(app: &AppHandle, store: &ProfileStore) -> Result<()> {
    let p = store_path(app)?;
    let txt = serde_json::to_string_pretty(store)?;
    fs::write(&p, txt).with_context(|| format!("write {}", p.display()))?;
    Ok(())
}

// ────────────────────────── URI parsers ──────────────────────────

fn now_iso() -> String {
    // Без std-time форматтера; формат RFC3339 примитивно через chrono было бы
    // удобнее, но без лишней зависимости — секундный таймстамп.
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("{}", now)
}

fn parse_vless(uri: &str) -> Result<Profile> {
    // vless://uuid@host:port?security=tls&encryption=none&type=ws&path=...&host=...&sni=...&flow=...&fp=...&pbk=...&sid=...#name
    let url = Url::parse(uri).context("bad vless:// URL")?;
    if url.scheme() != "vless" {
        return Err(anyhow!("not a vless link"));
    }
    let uuid = url.username();
    if uuid.is_empty() {
        return Err(anyhow!("vless: empty uuid"));
    }
    let host = url
        .host_str()
        .ok_or_else(|| anyhow!("vless: missing host"))?;
    let port = url.port().ok_or_else(|| anyhow!("vless: missing port"))?;
    let q: HashMap<_, _> = url.query_pairs().into_owned().collect();

    let name = url
        .fragment()
        .map(|s| urlencoding::decode(s).map(|c| c.into_owned()).unwrap_or_else(|_| s.to_string()))
        .unwrap_or_else(|| format!("vless@{host}"));

    let security = q.get("security").cloned().unwrap_or_else(|| "none".into());
    let net_type = q.get("type").cloned().unwrap_or_else(|| "tcp".into());

    let mut outbound = json!({
        "type": "vless",
        "tag": "proxy",
        "server": host,
        "server_port": port,
        "uuid": uuid,
        "flow": q.get("flow").cloned().unwrap_or_default(),
        "packet_encoding": q.get("packetEncoding").cloned().unwrap_or_default(),
    });

    if security == "tls" || security == "reality" {
        let mut tls = json!({
            "enabled": true,
            "server_name": q.get("sni").or_else(|| q.get("host")).cloned().unwrap_or_else(|| host.to_string()),
            "insecure": q.get("allowInsecure").map(|s| s == "1" || s == "true").unwrap_or(false),
        });
        if let Some(fp) = q.get("fp") {
            tls["utls"] = json!({ "enabled": true, "fingerprint": fp });
        }
        if security == "reality" {
            tls["reality"] = json!({
                "enabled": true,
                "public_key": q.get("pbk").cloned().unwrap_or_default(),
                "short_id": q.get("sid").cloned().unwrap_or_default(),
            });
        }
        if let Some(alpn) = q.get("alpn") {
            tls["alpn"] = json!(alpn.split(',').collect::<Vec<_>>());
        }
        outbound["tls"] = tls;
    }

    if net_type == "ws" {
        outbound["transport"] = json!({
            "type": "ws",
            "path": q.get("path").cloned().unwrap_or_else(|| "/".into()),
            "headers": q.get("host").map(|h| json!({ "Host": h })).unwrap_or_else(|| json!({})),
        });
    } else if net_type == "grpc" {
        outbound["transport"] = json!({
            "type": "grpc",
            "service_name": q.get("serviceName").cloned().unwrap_or_default(),
        });
    } else if net_type == "http" || net_type == "h2" {
        outbound["transport"] = json!({
            "type": "http",
            "path": q.get("path").cloned().unwrap_or_else(|| "/".into()),
            "host": q.get("host").map(|h| vec![h.clone()]).unwrap_or_default(),
        });
    }

    Ok(Profile {
        id: Uuid::new_v4().to_string(),
        name,
        kind: "vless".into(),
        server: Some(format!("{host}:{port}")),
        outbound,
        created_at: now_iso(),
    })
}

fn parse_hysteria2(uri: &str) -> Result<Profile> {
    // hy2://password@host:port?sni=...&obfs=...&obfs-password=...#name
    let url = Url::parse(uri).context("bad hy2:// URL")?;
    if url.scheme() != "hy2" && url.scheme() != "hysteria2" {
        return Err(anyhow!("not a hysteria2 link"));
    }
    let password = url.username();
    let host = url.host_str().ok_or_else(|| anyhow!("hy2: missing host"))?;
    let port = url.port().ok_or_else(|| anyhow!("hy2: missing port"))?;
    let q: HashMap<_, _> = url.query_pairs().into_owned().collect();
    let name = url
        .fragment()
        .map(|s| urlencoding::decode(s).map(|c| c.into_owned()).unwrap_or_else(|_| s.to_string()))
        .unwrap_or_else(|| format!("hy2@{host}"));

    let mut outbound = json!({
        "type": "hysteria2",
        "tag": "proxy",
        "server": host,
        "server_port": port,
        "password": password,
        "tls": {
            "enabled": true,
            "server_name": q.get("sni").cloned().unwrap_or_else(|| host.to_string()),
            "insecure": q.get("insecure").map(|s| s == "1" || s == "true").unwrap_or(false),
        }
    });
    if let Some(obfs) = q.get("obfs") {
        outbound["obfs"] = json!({
            "type": obfs,
            "password": q.get("obfs-password").cloned().unwrap_or_default(),
        });
    }

    Ok(Profile {
        id: Uuid::new_v4().to_string(),
        name,
        kind: "hysteria2".into(),
        server: Some(format!("{host}:{port}")),
        outbound,
        created_at: now_iso(),
    })
}

fn parse_shadowsocks(uri: &str) -> Result<Profile> {
    // ss://base64(method:password)@host:port#name
    // или ss://base64(method:password@host:port)#name (старый формат)
    let stripped = uri.strip_prefix("ss://").ok_or_else(|| anyhow!("not ss://"))?;
    let (body, name) = match stripped.split_once('#') {
        Some((b, n)) => (
            b.to_string(),
            urlencoding::decode(n).map(|c| c.into_owned()).unwrap_or_else(|_| n.to_string()),
        ),
        None => (stripped.to_string(), String::new()),
    };

    // Современный формат: userinfo base64 перед @
    let (method, password, host, port) = if let Some(at) = body.find('@') {
        let userinfo_b64 = &body[..at];
        let host_port = &body[at + 1..];
        let user = general_purpose::URL_SAFE_NO_PAD
            .decode(userinfo_b64)
            .or_else(|_| general_purpose::STANDARD.decode(userinfo_b64))
            .map(|b| String::from_utf8_lossy(&b).into_owned())
            .map_err(|_| anyhow!("ss: bad userinfo base64"))?;
        let (method, password) = user.split_once(':').ok_or_else(|| anyhow!("ss: bad userinfo"))?;
        let (host, port_str) = host_port.split_once(':').ok_or_else(|| anyhow!("ss: bad host:port"))?;
        let port: u16 = port_str.split('/').next().unwrap_or(port_str).parse()?;
        (method.to_string(), password.to_string(), host.to_string(), port)
    } else {
        // Старый формат: всё base64
        let decoded = general_purpose::URL_SAFE_NO_PAD
            .decode(&body)
            .or_else(|_| general_purpose::STANDARD.decode(&body))
            .map(|b| String::from_utf8_lossy(&b).into_owned())
            .map_err(|_| anyhow!("ss: bad full base64"))?;
        let (mp, hp) = decoded.split_once('@').ok_or_else(|| anyhow!("ss: legacy bad"))?;
        let (m, p) = mp.split_once(':').ok_or_else(|| anyhow!("ss: legacy mp"))?;
        let (h, port_str) = hp.split_once(':').ok_or_else(|| anyhow!("ss: legacy hp"))?;
        (m.to_string(), p.to_string(), h.to_string(), port_str.parse()?)
    };

    let final_name = if name.is_empty() { format!("ss@{host}") } else { name };
    let outbound = json!({
        "type": "shadowsocks",
        "tag": "proxy",
        "server": host,
        "server_port": port,
        "method": method,
        "password": password,
    });

    Ok(Profile {
        id: Uuid::new_v4().to_string(),
        name: final_name,
        kind: "shadowsocks".into(),
        server: Some(format!("{host}:{port}")),
        outbound,
        created_at: now_iso(),
    })
}

fn parse_socks(uri: &str) -> Result<Profile> {
    // socks5://user:pass@host:port#name
    let url = Url::parse(uri).context("bad socks:// URL")?;
    let scheme = url.scheme();
    if !matches!(scheme, "socks" | "socks5" | "socks5h") {
        return Err(anyhow!("not a socks link"));
    }
    let host = url.host_str().ok_or_else(|| anyhow!("socks: missing host"))?;
    let port = url.port().ok_or_else(|| anyhow!("socks: missing port"))?;
    let name = url
        .fragment()
        .map(|s| urlencoding::decode(s).map(|c| c.into_owned()).unwrap_or_else(|_| s.to_string()))
        .unwrap_or_else(|| format!("socks@{host}"));

    let mut outbound = json!({
        "type": "socks",
        "tag": "proxy",
        "server": host,
        "server_port": port,
        "version": "5",
    });
    if !url.username().is_empty() {
        outbound["username"] = json!(url.username());
        outbound["password"] = json!(url.password().unwrap_or(""));
    }

    Ok(Profile {
        id: Uuid::new_v4().to_string(),
        name,
        kind: "socks".into(),
        server: Some(format!("{host}:{port}")),
        outbound,
        created_at: now_iso(),
    })
}

fn parse_any_link(link: &str) -> Result<Profile> {
    let link = link.trim();
    if link.starts_with("vless://") {
        parse_vless(link)
    } else if link.starts_with("hy2://") || link.starts_with("hysteria2://") {
        parse_hysteria2(link)
    } else if link.starts_with("ss://") {
        parse_shadowsocks(link)
    } else if link.starts_with("socks5://") || link.starts_with("socks://") || link.starts_with("socks5h://") {
        parse_socks(link)
    } else {
        Err(anyhow!("unknown URI scheme — поддерживаются vless://, hy2://, ss://, socks5://"))
    }
}

fn parse_json_outbound(json_text: &str, fallback_name: &str) -> Result<Profile> {
    let v: Value = serde_json::from_str(json_text).context("bad JSON")?;
    // Принимаем 3 формы:
    // 1) Полный sing-box config — берём первый outbound с type != "direct"/"block"
    // 2) Объект outbound со своим "type"
    // 3) Массив outbounds — первый non-direct
    let outbound = if v.is_object() && v.get("type").is_some() {
        v.clone()
    } else if let Some(outs) = v.get("outbounds").and_then(|x| x.as_array()) {
        outs.iter()
            .find(|o| o.get("type").and_then(|t| t.as_str()).map(|t| t != "direct" && t != "block" && t != "dns").unwrap_or(false))
            .cloned()
            .ok_or_else(|| anyhow!("no proxy outbound in config"))?
    } else if v.is_array() {
        v.as_array()
            .unwrap()
            .iter()
            .find(|o| o.get("type").and_then(|t| t.as_str()).map(|t| t != "direct" && t != "block" && t != "dns").unwrap_or(false))
            .cloned()
            .ok_or_else(|| anyhow!("no proxy outbound in array"))?
    } else {
        return Err(anyhow!("unsupported JSON shape"));
    };

    let kind = outbound
        .get("type")
        .and_then(|t| t.as_str())
        .unwrap_or("json")
        .to_string();
    let server = outbound.get("server").and_then(|s| s.as_str()).map(String::from);
    let port = outbound.get("server_port").and_then(|p| p.as_u64());
    let server_full = match (server.as_deref(), port) {
        (Some(s), Some(p)) => Some(format!("{s}:{p}")),
        _ => None,
    };

    let mut outbound = outbound;
    if let Some(obj) = outbound.as_object_mut() {
        obj.insert("tag".into(), json!("proxy"));
    }

    Ok(Profile {
        id: Uuid::new_v4().to_string(),
        name: fallback_name.to_string(),
        kind,
        server: server_full,
        outbound,
        created_at: now_iso(),
    })
}

// ────────────────────────── sing-box runtime ──────────────────────────

fn build_singbox_config(profile_outbound: &Value) -> Value {
    json!({
        "log": { "level": "warn" },
        "inbounds": [
            {
                "type": "socks",
                "tag": "in",
                "listen": "127.0.0.1",
                "listen_port": SOCKS_PORT,
                "sniff": true,
            }
        ],
        "outbounds": [
            profile_outbound,
            { "type": "direct", "tag": "direct" },
            { "type": "block",  "tag": "block" }
        ],
        "route": {
            "rules": [],
            "final": "proxy"
        }
    })
}

fn stop_runtime() {
    if let Ok(mut rt) = RUNTIME.lock() {
        if let Some(mut child) = rt.child.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
        rt.active_id = None;
    }
}

fn start_runtime(app: &AppHandle, profile: &Profile) -> Result<()> {
    stop_runtime();
    let cfg = build_singbox_config(&profile.outbound);
    let cfg_path = singbox_config_path(app)?;
    fs::write(&cfg_path, serde_json::to_string_pretty(&cfg)?)
        .with_context(|| format!("write {}", cfg_path.display()))?;

    let bin = singbox_binary_path(app)?;
    let child = Command::new(&bin)
        .args(["run", "-c"])
        .arg(&cfg_path)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .with_context(|| format!("spawn {}", bin.display()))?;

    if let Ok(mut rt) = RUNTIME.lock() {
        rt.child = Some(child);
        rt.active_id = Some(profile.id.clone());
    }

    // Дать sing-box ~400ms подняться. На медленных машинах больше; UI всё
    // равно делает ping через локальный сокет, так что окно «прогрева»
    // достаточно.
    std::thread::sleep(std::time::Duration::from_millis(400));
    Ok(())
}

// ────────────────────────── Tauri commands ──────────────────────────

#[tauri::command]
pub fn vpn_list_profiles(app: AppHandle) -> Result<Value, String> {
    let store = load_store(&app).map_err(|e| e.to_string())?;
    Ok(json!({
        "profiles": store.profiles,
        "active_id": store.active_id,
    }))
}

#[tauri::command]
pub fn vpn_import_link(app: AppHandle, link: String) -> Result<Profile, String> {
    let profile = parse_any_link(&link).map_err(|e| e.to_string())?;
    let mut store = load_store(&app).map_err(|e| e.to_string())?;
    store.profiles.push(profile.clone());
    save_store(&app, &store).map_err(|e| e.to_string())?;
    Ok(profile)
}

#[tauri::command]
pub fn vpn_import_json(app: AppHandle, json: String, name: String) -> Result<Profile, String> {
    let label = if name.trim().is_empty() { "JSON profile".to_string() } else { name };
    let profile = parse_json_outbound(&json, &label).map_err(|e| e.to_string())?;
    let mut store = load_store(&app).map_err(|e| e.to_string())?;
    store.profiles.push(profile.clone());
    save_store(&app, &store).map_err(|e| e.to_string())?;
    Ok(profile)
}

#[tauri::command]
pub fn vpn_delete_profile(app: AppHandle, id: String) -> Result<(), String> {
    let mut store = load_store(&app).map_err(|e| e.to_string())?;
    store.profiles.retain(|p| p.id != id);
    if store.active_id.as_deref() == Some(&id) {
        store.active_id = None;
        stop_runtime();
    }
    save_store(&app, &store).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn vpn_connect(app: AppHandle, id: String) -> Result<VpnStatus, String> {
    let mut store = load_store(&app).map_err(|e| e.to_string())?;
    let profile = store
        .profiles
        .iter()
        .find(|p| p.id == id)
        .cloned()
        .ok_or_else(|| "profile not found".to_string())?;
    start_runtime(&app, &profile).map_err(|e| e.to_string())?;
    store.active_id = Some(profile.id.clone());
    save_store(&app, &store).map_err(|e| e.to_string())?;
    Ok(VpnStatus {
        connected: true,
        active_id: Some(profile.id),
        socks_port: SOCKS_PORT,
    })
}

#[tauri::command]
pub fn vpn_disconnect(app: AppHandle) -> Result<VpnStatus, String> {
    stop_runtime();
    let mut store = load_store(&app).map_err(|e| e.to_string())?;
    store.active_id = None;
    save_store(&app, &store).map_err(|e| e.to_string())?;
    Ok(VpnStatus { connected: false, active_id: None, socks_port: SOCKS_PORT })
}

#[tauri::command]
pub fn vpn_status() -> VpnStatus {
    let rt = RUNTIME.lock().ok();
    let (connected, active_id) = match rt {
        Some(r) => (r.child.is_some(), r.active_id.clone()),
        None => (false, None),
    };
    VpnStatus { connected, active_id, socks_port: SOCKS_PORT }
}

pub fn shutdown() {
    stop_runtime();
}
