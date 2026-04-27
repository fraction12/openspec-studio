mod bridge;

use tauri::{
    menu::{Menu, MenuItem, Submenu},
    Emitter, Manager,
};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let open_repository = MenuItem::with_id(
                app,
                "open_repository",
                "Open Repository...",
                true,
                Some("CmdOrCtrl+O"),
            )?;
            let file_menu = Submenu::with_items(app, "File", true, &[&open_repository])?;
            let menu = Menu::with_items(app, &[&file_menu])?;

            app.set_menu(menu)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            if event.id().as_ref() == "open_repository" {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.emit("open-repository-menu", ());
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            bridge::read_openspec_artifact_file,
            bridge::list_openspec_file_records,
            bridge::pick_repository_folder,
            bridge::run_openspec_command,
            bridge::validate_repo
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
