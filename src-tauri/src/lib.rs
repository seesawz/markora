use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Emitter, Manager, WindowEvent};
#[cfg(any(target_os = "macos", target_os = "ios"))]
use tauri::RunEvent;

#[tauri::command]
fn read_file_content(path: &str) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file_content(path: &str, content: &str) -> Result<(), String> {
    fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_new_file(path: &str) -> Result<(), String> {
    fs::write(path, "").map_err(|e| e.to_string())
}

// 读剪贴板图片并直接写成 PNG 文件,全程在 Rust 内完成,不经过 JS 传像素
// 返回写入的完整路径;剪贴板无图片时返回 Err
#[tauri::command]
fn save_clipboard_image(dir: &str, name: &str) -> Result<String, String> {
    use arboard::Clipboard;
    use image::{ImageBuffer, Rgba};
    use image::ImageEncoder;

    let mut cb = Clipboard::new().map_err(|e| e.to_string())?;
    let img = cb.get_image().map_err(|e| format!("no clipboard image: {}", e))?;
    let (w, h) = (img.width as u32, img.height as u32);

    let buf: ImageBuffer<Rgba<u8>, Vec<u8>> = ImageBuffer::from_raw(w, h, img.bytes.into_owned())
        .ok_or_else(|| "invalid image buffer".to_string())?;

    let mut png: Vec<u8> = Vec::new();
    let encoder = image::codecs::png::PngEncoder::new(&mut png);
    encoder
        .write_image(&buf, w, h, image::ExtendedColorType::Rgba8)
        .map_err(|e| e.to_string())?;

    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let sep = std::path::MAIN_SEPARATOR;
    let full = format!("{}{}{}", dir.trim_end_matches(['/', '\\']), sep, name);
    fs::write(&full, png).map_err(|e| e.to_string())?;
    Ok(full)
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
            read_file_content,
            write_file_content,
            create_new_file,
            save_clipboard_image,
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
