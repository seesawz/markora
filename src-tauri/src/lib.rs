use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{Emitter, Manager};

#[derive(Debug, Serialize, Deserialize)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Vec<FileNode>,
}

fn read_dir_recursive(path: &str) -> Vec<FileNode> {
    let mut nodes: Vec<FileNode> = Vec::new();

    let entries = match fs::read_dir(path) {
        Ok(e) => e,
        Err(_) => return nodes,
    };

    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };

        let name = entry.file_name().to_string_lossy().to_string();

        if name.starts_with('.') {
            continue;
        }

        let file_path = entry.path();
        let is_dir = file_path.is_dir();

        let children = if is_dir {
            read_dir_recursive(file_path.to_str().unwrap_or(""))
        } else {
            Vec::new()
        };

        nodes.push(FileNode {
            name,
            path: file_path.to_string_lossy().to_string(),
            is_dir,
            children,
        });
    }

    nodes.sort_by(|a, b| {
        if a.is_dir && !b.is_dir {
            std::cmp::Ordering::Less
        } else if !a.is_dir && b.is_dir {
            std::cmp::Ordering::Greater
        } else {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        }
    });

    nodes
}

#[tauri::command]
fn read_directory(path: &str) -> Result<Vec<FileNode>, String> {
    Ok(read_dir_recursive(path))
}

#[tauri::command]
fn read_file_content(path: &str) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file_content(path: &str, content: &str) -> Result<(), String> {
    fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_home_dir() -> Result<String, String> {
    let home = dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "/".to_string());
    Ok(home)
}

#[tauri::command]
fn create_new_file(path: &str) -> Result<(), String> {
    fs::write(path, "").map_err(|e| e.to_string())
}

#[tauri::command]
fn create_new_dir(path: &str) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_path(path: &str) -> Result<(), String> {
    let p = PathBuf::from(path);
    if p.is_dir() {
        fs::remove_dir_all(p).map_err(|e| e.to_string())
    } else {
        fs::remove_file(p).map_err(|e| e.to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};

            let new_file = MenuItemBuilder::with_id("new_file", "New File")
                .accelerator("CmdOrCtrl+N")
                .build(app)?;
            let open_file = MenuItemBuilder::with_id("open_file", "Open File…")
                .accelerator("CmdOrCtrl+O")
                .build(app)?;
            let save = MenuItemBuilder::with_id("save", "Save")
                .accelerator("CmdOrCtrl+S")
                .build(app)?;
            let save_as = MenuItemBuilder::with_id("save_as", "Save As…")
                .accelerator("CmdOrCtrl+Shift+S")
                .build(app)?;

            let file_menu = SubmenuBuilder::new(app, "File")
                .item(&new_file)
                .item(&open_file)
                .separator()
                .item(&save)
                .item(&save_as)
                .build()?;

            let view_menu = SubmenuBuilder::new(app, "View")
                .item(
                    &MenuItemBuilder::with_id("toggle_mode", "Toggle Source/Preview")
                        .accelerator("CmdOrCtrl+/")
                        .build(app)?,
                )
                .separator()
                .item(
                    &MenuItemBuilder::with_id("toggle_theme", "Toggle Theme")
                        .accelerator("CmdOrCtrl+Shift+T")
                        .build(app)?,
                )
                .build()?;

            let menu = MenuBuilder::new(app)
                .items(&[
                    &SubmenuBuilder::new(app, "Markora")
                        .item(&MenuItemBuilder::with_id("about", "About Markora").build(app)?)
                        .separator()
                        .item(&MenuItemBuilder::with_id("quit", "Quit Markora").accelerator("CmdOrCtrl+Q").build(app)?)
                        .build()?,
                    &file_menu,
                    &view_menu,
                ])
                .build()?;

            app.set_menu(menu)?;

            app.on_menu_event(|app_handle, event| {
                let id = event.id().as_ref();
                match id {
                    "new_file" | "open_file" | "save" | "save_as" |
                    "toggle_mode" | "toggle_theme" => {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.emit("menu-event", id);
                        }
                    }
                    "about" => {}
                    "quit" => { app_handle.exit(0); }
                    _ => {}
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_directory,
            read_file_content,
            write_file_content,
            get_home_dir,
            create_new_file,
            create_new_dir,
            delete_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
