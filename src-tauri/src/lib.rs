#[cfg(target_os = "macos")]
use std::sync::atomic::{AtomicBool, Ordering};

#[cfg(target_os = "macos")]
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, WindowEvent,
};

const TRAY_ID: &str = "one-main-tray";
#[cfg(target_os = "macos")]
const TRAY_WIDTH: f64 = 560.0;
#[cfg(target_os = "macos")]
const TRAY_HEIGHT: f64 = 620.0;
#[cfg(target_os = "macos")]
const FULL_WIDTH: f64 = 1180.0;
#[cfg(target_os = "macos")]
const FULL_HEIGHT: f64 = 900.0;

#[cfg(target_os = "macos")]
#[derive(Default)]
struct TrayWindowState(AtomicBool);

#[cfg(target_os = "macos")]
fn emit_navigation(app: &AppHandle, target: &str) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    let _ = window.emit("one:tray-navigation", target);
}

#[cfg(target_os = "macos")]
fn show_tray_window(app: &AppHandle, position: PhysicalPosition<f64>) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    let state = app.state::<TrayWindowState>();
    if state.0.load(Ordering::SeqCst) && window.is_visible().unwrap_or(false) {
        let _ = window.hide();
        state.0.store(false, Ordering::SeqCst);
        return;
    }

    let _ = window.set_min_size(Some(LogicalSize::new(360.0, 420.0)));
    let _ = window.set_size(LogicalSize::new(TRAY_WIDTH, TRAY_HEIGHT));
    let _ = window.set_resizable(false);
    let _ = window.set_decorations(false);
    let _ = window.set_always_on_top(true);

    let scale = window.scale_factor().unwrap_or(1.0);
    let x = position.x - (TRAY_WIDTH * scale / 2.0);
    let y = position.y + (10.0 * scale);
    let _ = window.set_position(PhysicalPosition::new(x.round() as i32, y.round() as i32));

    emit_navigation(app, "tray-timer");
    state.0.store(true, Ordering::SeqCst);
    let _ = window.show();
    let _ = window.set_focus();
}

#[cfg(target_os = "macos")]
#[tauri::command]
fn open_full_window(app: AppHandle, target: String) -> Result<(), String> {
    if target != "timer" && target != "todo" {
        return Err("unsupported window target".to_string());
    }

    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window is not available".to_string())?;

    app.state::<TrayWindowState>()
        .0
        .store(false, Ordering::SeqCst);

    let _ = window.set_always_on_top(false);
    let _ = window.set_decorations(true);
    let _ = window.set_resizable(true);
    let _ = window.set_min_size(Some(LogicalSize::new(380.0, 640.0)));
    let _ = window.set_size(LogicalSize::new(FULL_WIDTH, FULL_HEIGHT));
    let _ = window.center();

    emit_navigation(&app, &target);
    let _ = window.show();
    let _ = window.set_focus();
    Ok(())
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn open_full_window(_app: tauri::AppHandle, _target: String) -> Result<(), String> {
    Ok(())
}

#[cfg(target_os = "macos")]
#[tauri::command]
fn set_tray_title(app: AppHandle, title: String) -> Result<(), String> {
    let tray = app
        .tray_by_id(TRAY_ID)
        .ok_or_else(|| "timer tray icon is not available".to_string())?;

    tray.set_title(Some(title)).map_err(|error| error.to_string())
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn set_tray_title(_app: tauri::AppHandle, _title: String) -> Result<(), String> {
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![set_tray_title, open_full_window]);

    #[cfg(target_os = "macos")]
    let builder = builder.setup(|app| {
        app.set_dock_visibility(false);
        app.manage(TrayWindowState::default());

        let quit_item = MenuItem::with_id(app, "quit", "タイマーを終了", true, None::<&str>)?;
        let menu = Menu::with_items(app, &[&quit_item])?;

        let mut tray_builder = TrayIconBuilder::with_id(TRAY_ID)
            .menu(&menu)
            .show_menu_on_left_click(false)
            .icon_as_template(true)
            .title("")
            .tooltip("タイマー")
            .on_menu_event(|app, event| {
                if event.id().as_ref() == "quit" {
                    app.exit(0);
                }
            })
            .on_tray_icon_event(|tray, event| match event {
                TrayIconEvent::Click {
                    position,
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } => show_tray_window(tray.app_handle(), position),
                _ => {}
            });

        if let Some(icon) = app.default_window_icon() {
            tray_builder = tray_builder.icon(icon.clone());
        }

        tray_builder.build(app)?;

        if let Some(window) = app.get_webview_window("main") {
            let window_for_events = window.clone();
            let app_handle = app.handle().clone();
            window.on_window_event(move |event| match event {
                WindowEvent::CloseRequested { api, .. } => {
                    api.prevent_close();
                    let _ = window_for_events.hide();
                    app_handle
                        .state::<TrayWindowState>()
                        .0
                        .store(false, Ordering::SeqCst);
                }
                WindowEvent::Focused(false) => {
                    let state = app_handle.state::<TrayWindowState>();
                    if state.0.swap(false, Ordering::SeqCst) {
                        let _ = window_for_events.hide();
                    }
                }
                _ => {}
            });
        }

        Ok(())
    });

    builder
        .run(tauri::generate_context!())
        .expect("error while running timer");
}
