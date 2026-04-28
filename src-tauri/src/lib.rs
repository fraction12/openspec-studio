mod bridge;

use tauri::{
    menu::{Menu, MenuItem, Submenu},
    Emitter, Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
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
            bridge::archive_change,
            bridge::read_openspec_artifact_file,
            bridge::list_openspec_file_records,
            bridge::list_openspec_file_metadata_records,
            bridge::list_openspec_file_records_with_options,
            bridge::get_openspec_git_status,
            bridge::pick_repository_folder,
            bridge::run_openspec_command,
            bridge::validate_repo
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
