fn main() {
    // Cargo по умолчанию не отслеживает наши permission/capability файлы —
    // без явного rerun-if-changed инкрементальные сборки берут стейл ACL.
    println!("cargo:rerun-if-changed=permissions");
    println!("cargo:rerun-if-changed=capabilities");
    println!("cargo:rerun-if-changed=tauri.conf.json");

    // ВАЖНО: Tauri 2 не авто-обнаруживает custom-команды из invoke_handler!.
    // Для каждой нужно явно объявить allow-* permission через AppManifest —
    // тогда tauri-build сгенерирует permission-юниты и положит их в
    // gen/schemas/. Без этого все custom-команды отбиваются ACL,
    // даже если permission/*.toml вручную написаны.
    let attrs = tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "hide_window",
            "show_window",
            "toggle_window",
            "minimize_window",
            "toggle_maximize_window",
            "is_maximized_window",
            "start_dragging_window",
            "quit_app",
            "set_unread_count",
            "vpn_list_profiles",
            "vpn_import_link",
            "vpn_import_json",
            "vpn_delete_profile",
            "vpn_connect",
            "vpn_disconnect",
            "vpn_status",
        ]),
    );
    tauri_build::try_build(attrs).expect("tauri_build failed");
}
