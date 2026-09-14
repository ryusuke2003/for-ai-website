use tauri_plugin_notification::NotificationExt;
use tauri_plugin_updater::UpdaterExt;

#[cfg(target_os = "macos")]
use std::{
    env, fs,
    path::PathBuf,
    sync::atomic::{AtomicBool, Ordering},
};

#[cfg(target_os = "macos")]
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, WindowEvent,
};

const TRAY_ID: &str = "one-main-tray";
#[cfg(target_os = "macos")]
const UPDATE_MENU_ID: &str = "update";
#[cfg(target_os = "macos")]
const TRAY_WIDTH: f64 = 560.0;
#[cfg(target_os = "macos")]
const TRAY_HEIGHT: f64 = 620.0;
#[cfg(target_os = "macos")]
const FULL_WIDTH: f64 = 1180.0;
#[cfg(target_os = "macos")]
const FULL_HEIGHT: f64 = 900.0;
#[cfg(target_os = "macos")]
const FULL_HORIZONTAL_MARGIN: f64 = 48.0;
#[cfg(target_os = "macos")]
const FULL_VERTICAL_MARGIN: f64 = 64.0;
#[cfg(target_os = "macos")]
const LOGIN_AGENT_LABEL: &str = "com.ryusuke2003.one.autostart";
#[cfg(target_os = "macos")]
const LOGIN_AGENT_FILE: &str = "com.ryusuke2003.one.autostart.plist";
#[cfg(target_os = "macos")]
const APP_BUNDLE_IDENTIFIER: &str = "com.ryusuke2003.one";
#[cfg(target_os = "macos")]
const AUTOSTART_ARGUMENT: &str = "--autostart";

#[cfg(target_os = "macos")]
#[derive(Default)]
struct TrayWindowState(AtomicBool);

#[cfg(target_os = "macos")]
fn login_agent_contents() -> String {
    format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>{LOGIN_AGENT_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/open</string>
    <string>-g</string>
    <string>-j</string>
    <string>-b</string>
    <string>{APP_BUNDLE_IDENTIFIER}</string>
    <string>--args</string>
    <string>{AUTOSTART_ARGUMENT}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
</dict>
</plist>
"#,
    )
}

#[cfg(target_os = "macos")]
fn login_agent_path() -> Result<PathBuf, String> {
    let home = env::var_os("HOME").ok_or_else(|| "HOME is not available".to_string())?;
    Ok(PathBuf::from(home)
        .join("Library")
        .join("LaunchAgents")
        .join(LOGIN_AGENT_FILE))
}

#[cfg(target_os = "macos")]
fn ensure_login_autostart() -> Result<(), String> {
    let path = login_agent_path()?;
    let contents = login_agent_contents();

    if fs::read_to_string(&path).ok().as_deref() == Some(contents.as_str()) {
        return Ok(());
    }

    let parent = path
        .parent()
        .ok_or_else(|| "LaunchAgents directory is not available".to_string())?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    fs::write(path, contents).map_err(|error| error.to_string())
}

#[cfg(target_os = "macos")]
fn launched_from_login() -> bool {
    env::args_os().any(|argument| argument.to_string_lossy() == AUTOSTART_ARGUMENT)
}

#[cfg(target_os = "macos")]
async fn available_update_version(app: &AppHandle) -> Result<Option<String>, String> {
    let update = app
        .updater()
        .map_err(|error| error.to_string())?
        .check()
        .await
        .map_err(|error| error.to_string())?;
    Ok(update.map(|update| update.version))
}

#[cfg(target_os = "macos")]
async fn install_available_update(app: &AppHandle) -> Result<bool, String> {
    let update = app
        .updater()
        .map_err(|error| error.to_string())?
        .check()
        .await
        .map_err(|error| error.to_string())?;

    let Some(update) = update else {
        return Ok(false);
    };

    update
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(|error| error.to_string())?;
    Ok(true)
}

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

    emit_navigation(app, "tray-todo");
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

    let mut full_width = FULL_WIDTH;
    let mut full_height = FULL_HEIGHT;
    let mut centered_position = None;

    if let Ok(Some(monitor)) = window.current_monitor() {
        let scale = monitor.scale_factor();
        let monitor_size = monitor.size();
        let monitor_position = monitor.position();
        let logical_width = monitor_size.width as f64 / scale;
        let logical_height = monitor_size.height as f64 / scale;

        full_width = FULL_WIDTH.min(
            (logical_width - FULL_HORIZONTAL_MARGIN * 2.0).max(380.0),
        );
        full_height = FULL_HEIGHT.min(
            (logical_height - FULL_VERTICAL_MARGIN * 2.0).max(640.0),
        );

        let physical_width = full_width * scale;
        let physical_height = full_height * scale;
        let x = monitor_position.x as f64
            + (monitor_size.width as f64 - physical_width) / 2.0;
        let y = monitor_position.y as f64
            + (monitor_size.height as f64 - physical_height) / 2.0;
        centered_position = Some(PhysicalPosition::new(
            x.round() as i32,
            y.round() as i32,
        ));
    }

    // Tray直下の位置・装飾状態を見せたまま切り替えると、macOS側の反映順で
    // 通常ウィンドウが画面端へ残ることがあるため、一度隠してから復元する。
    let _ = window.hide();
    let _ = window.set_always_on_top(false);
    let _ = window.set_decorations(true);
    let _ = window.set_resizable(true);
    let _ = window.set_min_size(Some(LogicalSize::new(380.0, 640.0)));
    let _ = window.set_size(LogicalSize::new(full_width, full_height));

    if let Some(position) = centered_position {
        let _ = window.set_position(position);
    } else {
        let _ = window.center();
    }

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

fn notification_permission_name(state: tauri::plugin::PermissionState) -> &'static str {
    match state {
        tauri::plugin::PermissionState::Granted => "granted",
        tauri::plugin::PermissionState::Denied => "denied",
        tauri::plugin::PermissionState::Prompt => "default",
        tauri::plugin::PermissionState::PromptWithRationale => "default",
    }
}

#[tauri::command]
fn notification_permission_state(app: tauri::AppHandle) -> Result<String, String> {
    let state = app
        .notification()
        .permission_state()
        .map_err(|error| error.to_string())?;
    Ok(notification_permission_name(state).to_string())
}

#[tauri::command]
fn request_notification_permission(app: tauri::AppHandle) -> Result<String, String> {
    let state = app
        .notification()
        .request_permission()
        .map_err(|error| error.to_string())?;
    Ok(notification_permission_name(state).to_string())
}

#[tauri::command]
fn show_native_notification(
    app: tauri::AppHandle,
    title: String,
    body: String,
) -> Result<(), String> {
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            set_tray_title,
            open_full_window,
            notification_permission_state,
            request_notification_permission,
            show_native_notification,
        ]);

    #[cfg(target_os = "macos")]
    let launched_from_login = launched_from_login();

    #[cfg(target_os = "macos")]
    let builder = builder.setup(move |app| {
        if let Err(error) = ensure_login_autostart() {
            eprintln!("failed to register login autostart: {error}");
        }

        app.set_dock_visibility(false);
        app.manage(TrayWindowState::default());

        let update_item = MenuItem::with_id(
            app,
            UPDATE_MENU_ID,
            "アップデートを確認中…",
            false,
            None::<&str>,
        )?;
        let quit_item = MenuItem::with_id(app, "quit", "タイマーを終了", true, None::<&str>)?;
        let menu = Menu::with_items(app, &[&update_item, &quit_item])?;
        let update_item_for_menu = update_item.clone();

        let mut tray_builder = TrayIconBuilder::with_id(TRAY_ID)
            .menu(&menu)
            .show_menu_on_left_click(false)
            .icon_as_template(true)
            .title("")
            .tooltip("タイマー")
            .on_menu_event(move |app, event| {
                if event.id().as_ref() == UPDATE_MENU_ID {
                    let app_handle = app.clone();
                    let update_item = update_item_for_menu.clone();
                    let _ = update_item.set_text("更新中…");
                    let _ = update_item.set_enabled(false);

                    tauri::async_runtime::spawn(async move {
                        match install_available_update(&app_handle).await {
                            Ok(true) => app_handle.restart(),
                            Ok(false) => {
                                let _ = update_item.set_text("最新版です（再確認）");
                                let _ = update_item.set_enabled(true);
                            }
                            Err(error) => {
                                eprintln!("failed to install update: {error}");
                                let _ = update_item.set_text("更新に失敗しました（再試行）");
                                let _ = update_item.set_enabled(true);
                            }
                        }
                    });
                    return;
                }

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

        let app_handle_for_update = app.handle().clone();
        let update_item_for_check = update_item.clone();
        tauri::async_runtime::spawn(async move {
            match available_update_version(&app_handle_for_update).await {
                Ok(Some(version)) => {
                    let _ = update_item_for_check.set_text(format!("v{version}に更新"));
                    let _ = update_item_for_check.set_enabled(true);
                }
                Ok(None) => {
                    let _ = update_item_for_check.set_text("最新版です（再確認）");
                    let _ = update_item_for_check.set_enabled(true);
                }
                Err(error) => {
                    eprintln!("failed to check for updates: {error}");
                    let _ = update_item_for_check.set_text("アップデートを確認");
                    let _ = update_item_for_check.set_enabled(true);
                }
            }
        });

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

            if !launched_from_login {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }

        Ok(())
    });

    builder
        .run(tauri::generate_context!())
        .expect("error while running timer");
}
