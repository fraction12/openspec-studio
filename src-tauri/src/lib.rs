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
        .plugin(tauri_plugin_store::Builder::new().build())
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
            bridge::openspec::archive_change,
            bridge::openspec::read_openspec_artifact_file,
            bridge::openspec::list_openspec_file_records,
            bridge::openspec::list_openspec_file_metadata_records,
            bridge::openspec::list_openspec_file_records_with_options,
            bridge::openspec::get_openspec_git_status,
            bridge::openspec::pick_repository_folder,
            bridge::openspec::run_openspec_command,
            bridge::openspec::validate_repo,
            bridge::studio_runner::configure_studio_runner_session_secret,
            bridge::studio_runner::clear_studio_runner_session_secret,
            bridge::studio_runner::start_studio_runner,
            bridge::studio_runner::restart_studio_runner,
            bridge::studio_runner::stop_studio_runner,
            bridge::studio_runner::check_studio_runner_status,
            bridge::studio_runner::start_studio_runner_event_stream,
            bridge::studio_runner::stop_studio_runner_event_stream,
            bridge::studio_runner::dispatch_studio_runner_event
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
