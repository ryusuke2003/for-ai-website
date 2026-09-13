#[cfg(target_os = "macos")]
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, WindowEvent,
};

const TRAY_ID: &str = "one-main-tray";

#[cfg(target_os = "macos")]
fn toggle_main_window(app: &tauri::AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    match window.is_visible() {
        Ok(true) => {
            let _ = window.hide();
        }
        Ok(false) => {
            let _ = window.show();
            let _ = window.set_focus();
        }
        Err(_) => {}
    }
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

        let start_item = MenuItem::with_id(app, "timer-start", "開始", true, None::<&str>)?;
        let pause_item = MenuItem::with_id(app, "timer-pause", "一時停止", true, None::<&str>)?;
        let reset_item = MenuItem::with_id(app, "timer-reset", "リセット", true, None::<&str>)?;
        let focus_25_item = MenuItem::with_id(app, "timer-25", "25分開始", true, None::<&str>)?;
        let break_5_item = MenuItem::with_id(app, "timer-break-5", "5分休憩", true, None::<&str>)?;
        let toggle_item = MenuItem::with_id(
            app,
            "toggle-window",
            "ONEを表示 / 隠す",
            true,
            None::<&str>,
        )?;
        let quit_item = MenuItem::with_id(app, "quit", "ONEを終了", true, None::<&str>)?;
        let menu = Menu::with_items(
            app,
            &[
                &start_item,
                &pause_item,
                &reset_item,
                &focus_25_item,
                &break_5_item,
                &toggle_item,
                &quit_item,
            ],
        )?;

        let mut tray_builder = TrayIconBuilder::with_id(TRAY_ID)
            .menu(&menu)
            .show_menu_on_left_click(false)
            .icon_as_template(true)
            .title("ONE")
            .tooltip("ONE")
            .on_menu_event(|app, event| match event.id().as_ref() {
                "timer-start" => emit_timer_action(app, "start"),
                "timer-pause" => emit_timer_action(app, "pause"),
                "timer-reset" => emit_timer_action(app, "reset"),
                "timer-25" => emit_timer_action(app, "start-25"),
                "timer-break-5" => emit_timer_action(app, "break-5"),
                "toggle-window" => toggle_main_window(app),
                "quit" => app.exit(0),
                _ => {}
            })
            .on_tray_icon_event(|tray, event| {
                if let TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } = event
                {
                    toggle_main_window(tray.app_handle());
                }
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
