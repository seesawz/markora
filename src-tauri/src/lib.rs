use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Emitter, Manager, WindowEvent};
#[cfg(any(target_os = "macos", target_os = "ios"))]
use tauri::RunEvent;

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

#[tauri::command]
fn write_binary_file(path: &str, data: Vec<u8>) -> Result<(), String> {
    fs::write(path, data).map_err(|e| e.to_string())
}

#[derive(Default)]
struct AppState {
    close_confirmed: Mutex<bool>,
    pending_files: Mutex<Vec<String>>,
}

#[tauri::command]
fn confirm_close(app_handle: tauri::AppHandle, state: tauri::State<AppState>) {
    if let Ok(mut guard) = state.close_confirmed.lock() {
        *guard = true;
    }
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.close();
    }
}

#[tauri::command]
fn take_pending_files(state: tauri::State<AppState>) -> Vec<String> {
    if let Ok(mut guard) = state.pending_files.lock() {
        return std::mem::take(&mut *guard);
    }
    Vec::new()
}

fn is_markdown_path(p: &str) -> bool {
    let lower = p.to_lowercase();
    lower.ends_with(".md") || lower.ends_with(".markdown")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .setup(|app| {
            // Collect Markdown files from CLI args (skip argv[0])
            let args: Vec<String> = std::env::args().skip(1).collect();
            let files: Vec<String> = args
                .into_iter()
                .filter(|a| is_markdown_path(a))
                .filter_map(|a| {
                    let p = PathBuf::from(&a);
                    if p.is_file() {
                        Some(p.canonicalize().map(|c| c.to_string_lossy().to_string()).unwrap_or(a))
                    } else {
                        None
                    }
                })
                .collect();
            if !files.is_empty() {
                if let Some(state) = app.try_state::<AppState>() {
                    if let Ok(mut guard) = state.pending_files.lock() {
                        guard.extend(files);
                    }
                }
            }

            // Handle window events: close-requested + drag-drop
            if let Some(window) = app.get_webview_window("main") {
                let win = window.clone();
                let app_handle = app.handle().clone();
                window.on_window_event(move |event| match event {
                    WindowEvent::CloseRequested { api, .. } => {
                        let state = app_handle.state::<AppState>();
                        let confirmed = state.close_confirmed.lock().map(|g| *g).unwrap_or(false);
                        if !confirmed {
                            api.prevent_close();
                            let _ = win.emit("menu-event", "close_requested");
                        }
                    }
                    WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }) => {
                        let files: Vec<String> = paths
                            .iter()
                            .filter_map(|p| {
                                let s = p.to_string_lossy().to_string();
                                if is_markdown_path(&s) { Some(s) } else { None }
                            })
                            .collect();
                        if !files.is_empty() {
                            let _ = win.emit("files-dropped", files);
                        }
                    }
                    _ => {}
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_directory,
            read_file_content,
            write_file_content,
            get_home_dir,
            create_new_file,
            create_new_dir,
            delete_path,
            write_binary_file,
            confirm_close,
            take_pending_files
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_app_handle, _event| {
        #[cfg(any(target_os = "macos", target_os = "ios"))]
        if let RunEvent::Opened { urls } = _event {
            let files: Vec<String> = urls
                .into_iter()
                .filter_map(|u| u.to_file_path().ok())
                .filter(|p| p.is_file())
                .map(|p| p.to_string_lossy().to_string())
                .filter(|s| is_markdown_path(s))
                .collect();
            if files.is_empty() {
                return;
            }
            let state = _app_handle.state::<AppState>();
            if let Ok(mut guard) = state.pending_files.lock() {
                guard.extend(files.clone());
            }
            if let Some(window) = _app_handle.get_webview_window("main") {
                let _ = window.emit("files-dropped", files);
            }
        }
    });
}
