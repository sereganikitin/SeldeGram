use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WebviewWindow,
};

#[tauri::command]
fn hide_window(window: WebviewWindow) {
    let _ = window.hide();
}

#[tauri::command]
fn show_window(window: WebviewWindow) {
    let _ = window.show();
    let _ = window.set_focus();
    let _ = window.unminimize();
}

#[tauri::command]
fn toggle_window(window: WebviewWindow) {
    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
    } else {
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.unminimize();
    }
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

/// Уведомление о количестве непрочитанных сообщений. Прокидывается в
/// заголовок окна — это сразу видно в таскбар-тултипе, Alt+Tab, и в имени
/// записи в трее. Кроссплатформенно, не требует Win32-API.
#[tauri::command]
fn set_unread_count(window: WebviewWindow, count: u32) {
    let title = if count == 0 {
        "CraboGram".to_string()
    } else if count > 99 {
        "CraboGram (99+)".to_string()
    } else {
        format!("CraboGram ({})", count)
    };
    let _ = window.set_title(&title);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            hide_window,
            show_window,
            toggle_window,
            quit_app,
            set_unread_count,
        ])
        .on_window_event(|window, event| {
            // Перехватываем закрытие окна — сворачиваем в трей.
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .setup(|app| {
            let show_item = MenuItem::with_id(app, "show", "Открыть CraboGram", true, None::<&str>)?;
            let hide_item = MenuItem::with_id(app, "hide", "Скрыть в трей", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Выход", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &hide_item, &quit_item])?;

            let app_handle_for_menu = app.handle().clone();
            let app_handle_for_click = app.handle().clone();

            let _tray = TrayIconBuilder::with_id("main-tray")
                .icon(app.default_window_icon().cloned().ok_or("no default icon")?)
                .tooltip("CraboGram")
                .menu(&menu)
                .menu_on_left_click(false)
                .on_menu_event(move |_app, event| {
                    if let Some(win) = app_handle_for_menu.get_webview_window("main") {
                        match event.id().as_ref() {
                            "show" => {
                                let _ = win.show();
                                let _ = win.set_focus();
                                let _ = win.unminimize();
                            }
                            "hide" => {
                                let _ = win.hide();
                            }
                            "quit" => app_handle_for_menu.exit(0),
                            _ => {}
                        }
                    }
                })
                .on_tray_icon_event(move |_tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(win) = app_handle_for_click.get_webview_window("main") {
                            if win.is_visible().unwrap_or(false) {
                                let _ = win.hide();
                            } else {
                                let _ = win.show();
                                let _ = win.set_focus();
                                let _ = win.unminimize();
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running CraboGram desktop");
}
