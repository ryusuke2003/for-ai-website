#[cfg(target_os = "macos")]
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager, WindowEvent,
};

const TRAY_ID: &str = "one-main-tray";

#[cfg(target_os = "macos")]
fn show_main_window(app: &tauri::AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    let _ = window.show();
    let _ = window.set_focus();
}

#[cfg(target_os = "macos")]
fn emit_timer_action(app: &tauri::AppHandle, action: &str) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    let _ = window.emit("one:tray-timer-action", action);
}

#[cfg(target_os = "macos")]
#[tauri::command]
fn set_tray_title(app: tauri::AppHandle, title: String) -> Result<(), String> {
    let tray = app
        .tray_by_id(TRAY_ID)
        .ok_or_else(|| "ONE tray icon is not available".to_string())?;

    tray.set_title(Some(title)).map_err(|error| error.to_string())
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn set_tray_title(_app: tauri::AppHandle, _title: String) -> Result<(), String> {
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default().invoke_handler(tauri::generate_handler![set_tray_title]);

    #[cfg(target_os = "macos")]
    let builder = builder.setup(|app| {
        app.set_dock_visibility(false);

        let open_item = MenuItem::with_id(app, "open-window", "ONEを開く", true, None::<&str>)?;
        let start_item = MenuItem::with_id(app, "timer-start", "開始 / 再開", true, None::<&str>)?;
        let pause_item = MenuItem::with_id(app, "timer-pause", "一時停止", true, None::<&str>)?;
        let reset_item = MenuItem::with_id(app, "timer-reset", "リセット", true, None::<&str>)?;
        let quit_item = MenuItem::with_id(app, "quit", "ONEを終了", true, None::<&str>)?;
        let menu = Menu::with_items(
            app,
            &[
                &open_item,
                &start_item,
                &pause_item,
                &reset_item,
                &quit_item,
            ],
        )?;

        let mut tray_builder = TrayIconBuilder::with_id(TRAY_ID)
            .menu(&menu)
            .show_menu_on_left_click(true)
            .icon_as_template(true)
            .title("ONE")
            .tooltip("ONE")
            .on_menu_event(|app, event| match event.id().as_ref() {
                "open-window" => show_main_window(app),
                "timer-start" => emit_timer_action(app, "start"),
                "timer-pause" => emit_timer_action(app, "pause"),
                "timer-reset" => emit_timer_action(app, "reset"),
                "quit" => app.exit(0),
                _ => {}
            });

        if let Some(icon) = app.default_window_icon() {
            tray_builder = tray_builder.icon(icon.clone());
        }

        tray_builder.build(app)?;

        if let Some(window) = app.get_webview_window("main") {
            let window_for_close = window.clone();
            window.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window_for_close.hide();
                }
            });
        }

        Ok(())
    });

    builder
        .run(tauri::generate_context!())
        .expect("error while running ONE");
}
