use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
#[cfg(any(target_os = "macos", target_os = "ios"))]
use tauri::RunEvent;
use tauri::{Emitter, Manager, WindowEvent};

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

#[tauri::command]
fn create_folder(path: &str) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn rename_path(from: &str, to: &str) -> Result<(), String> {
    fs::rename(from, to).map_err(|e| e.to_string())
}

// 删除走系统回收站,可恢复,避免误删笔记
#[tauri::command]
fn trash_path(path: &str) -> Result<(), String> {
    trash::delete(path).map_err(|e| e.to_string())
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceEntry {
    name: String,
    path: String,
    is_dir: bool,
    children: Vec<WorkspaceEntry>,
}

// 忽略的目录：版本控制、构建产物、依赖、工具目录
const SKIP_DIRS: [&str; 8] = [
    ".git",
    ".svn",
    ".hg",
    "node_modules",
    "target",
    "dist",
    ".obsidian",
    ".trash",
];
const MAX_SCAN_DEPTH: usize = 8;

fn scan_dir(dir: &std::path::Path, depth: usize) -> Result<Vec<WorkspaceEntry>, String> {
    if depth > MAX_SCAN_DEPTH {
        return Ok(Vec::new());
    }
    let mut dirs: Vec<PathBuf> = Vec::new();
    let mut files: Vec<PathBuf> = Vec::new();
    let rd = fs::read_dir(dir).map_err(|e| e.to_string())?;
    for entry in rd.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        let path = entry.path();
        if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            if !SKIP_DIRS.contains(&name.as_str()) {
                dirs.push(path);
            }
        } else if is_markdown_path(&name) {
            files.push(path);
        }
    }
    dirs.sort();
    files.sort();

    let mut entries = Vec::new();
    for d in dirs {
        let children = scan_dir(&d, depth + 1)?;
        if children.is_empty() {
            continue; // 空目录不展示
        }
        entries.push(WorkspaceEntry {
            name: d
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default(),
            path: d.to_string_lossy().to_string(),
            is_dir: true,
            children,
        });
    }
    for f in files {
        entries.push(WorkspaceEntry {
            name: f
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default(),
            path: f.to_string_lossy().to_string(),
            is_dir: false,
            children: Vec::new(),
        });
    }
    Ok(entries)
}

/// 递归扫描文件夹，返回按目录分组的 Markdown 文件树
#[tauri::command]
fn scan_workspace(root: &str) -> Result<Vec<WorkspaceEntry>, String> {
    let root = PathBuf::from(root);
    if !root.is_dir() {
        return Err("不是有效的文件夹".to_string());
    }
    scan_dir(&root, 0)
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AiConfigFile {
    provider: String,
    base_url: String,
    model: String,
    #[serde(default)]
    api_key: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AiConfigResponse {
    provider: String,
    base_url: String,
    model: String,
    api_key: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AiConfigRequest {
    provider: String,
    base_url: String,
    model: String,
    api_key: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AiCompletionRequest {
    provider: String,
    base_url: String,
    model: String,
    prompt: String,
}

fn ai_config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    Ok(dir.join("ai.json"))
}

fn default_ai_config() -> AiConfigFile {
    AiConfigFile {
        provider: "openai".to_string(),
        base_url: "https://api.openai.com/v1".to_string(),
        model: "gpt-4o-mini".to_string(),
        api_key: String::new(),
    }
}

fn read_ai_config(app: &tauri::AppHandle) -> Result<AiConfigFile, String> {
    let path = ai_config_path(app)?;
    if !path.exists() {
        return Ok(default_ai_config());
    }
    let raw = fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&raw).map_err(|e| format!("AI 配置损坏：{}", e))
}

fn config_response(config: AiConfigFile) -> AiConfigResponse {
    AiConfigResponse {
        provider: config.provider,
        base_url: config.base_url,
        model: config.model,
        api_key: config.api_key,
    }
}

// ponytail: API Key 改存 ai.json 明文（钥匙串在未公证应用上不可靠），空则报错
fn config_api_key(app: &tauri::AppHandle) -> Result<String, String> {
    let config = read_ai_config(app)?;
    let key = config.api_key.trim();
    if key.is_empty() {
        Err("请先在 AI 设置中配置 API Key".to_string())
    } else {
        Ok(key.to_string())
    }
}

#[tauri::command]
fn get_ai_config(app: tauri::AppHandle) -> Result<AiConfigResponse, String> {
    Ok(config_response(read_ai_config(&app)?))
}

#[tauri::command]
fn save_ai_config(
    app: tauri::AppHandle,
    request: AiConfigRequest,
) -> Result<AiConfigResponse, String> {
    let provider = request.provider.trim();
    if provider != "openai" && provider != "anthropic" {
        return Err("不支持的 API 格式".to_string());
    }
    if request.base_url.trim().is_empty() || request.model.trim().is_empty() {
        return Err("Base URL 和模型名称不能为空".to_string());
    }

    // ponytail: API Key 直接写 ai.json，留空即清除
    let api_key = request.api_key.unwrap_or_default().trim().to_string();
    let config = AiConfigFile {
        provider: provider.to_string(),
        base_url: request.base_url.trim_end_matches('/').to_string(),
        model: request.model.trim().to_string(),
        api_key,
    };
    let path = ai_config_path(&app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let raw = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(path, raw).map_err(|e| e.to_string())?;
    Ok(config_response(config))
}

fn endpoint(base_url: &str, provider: &str) -> Result<String, String> {
    let base = base_url.trim_end_matches('/');
    if base.is_empty() {
        return Err("Base URL 不能为空".to_string());
    }
    if provider == "anthropic" {
        return Ok(if base.ends_with("/messages") {
            base.to_string()
        } else if base.ends_with("/v1") {
            format!("{}/messages", base)
        } else {
            format!("{}/v1/messages", base)
        });
    }
    Ok(if base.ends_with("/chat/completions") {
        base.to_string()
    } else {
        format!("{}/chat/completions", base)
    })
}

fn extract_ai_text(provider: &str, raw: &str) -> Result<String, String> {
    let value: Value = serde_json::from_str(raw).map_err(|e| format!("AI 响应无法解析：{}", e))?;
    let text = extract_content(&value, provider);
    if !text.trim().is_empty() {
        return Ok(text);
    }
    // ponytail: 取不到内容时附上原始响应片段,便于排查（模型名错误/格式不兼容等）
    let detail = raw.chars().take(600).collect::<String>();
    Err(format!("AI 返回了空内容，原始响应：{}", detail))
}

// content 可能是字符串、null、或内容块数组；推理模型可能把输出放在 reasoning_content
fn extract_content(value: &Value, provider: &str) -> String {
    if provider == "anthropic" {
        if let Some(blocks) = value["content"].as_array() {
            return blocks
                .iter()
                .filter_map(|b| b["text"].as_str())
                .collect::<Vec<_>>()
                .join("");
        }
        return value["content"].as_str().unwrap_or("").to_string();
    }
    let message = &value["choices"][0]["message"];
    if let Some(s) = message["content"].as_str() {
        return s.to_string();
    }
    if let Some(blocks) = message["content"].as_array() {
        return blocks
            .iter()
            .filter_map(|b| {
                b.get("text")
                    .and_then(|t| t.as_str())
                    .or_else(|| b.as_str())
            })
            .collect::<Vec<_>>()
            .join("");
    }
    // 推理模型（DeepSeek-R1 等）content 为 null 时退回 reasoning_content
    if let Some(s) = message["reasoning_content"].as_str() {
        return s.to_string();
    }
    String::new()
}

async fn complete_ai_request(
    provider: &str,
    base_url: &str,
    model: &str,
    api_key: String,
    prompt: &str,
) -> Result<String, String> {
    let url = endpoint(base_url, provider)?;
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(90))
        .build()
        .map_err(|e| e.to_string())?;

    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    let body = if provider == "anthropic" {
        headers.insert(
            "x-api-key",
            HeaderValue::from_str(&api_key).map_err(|_| "API Key 含有非法字符".to_string())?,
        );
        headers.insert("anthropic-version", HeaderValue::from_static("2023-06-01"));
        json!({
            "model": model,
            "max_tokens": 4096,
            // ponytail: 默认关闭思考模式--推理模型(glm-5.2 等)开思考会慢 4-8 秒,续写场景不可用
            "thinking": { "type": "disabled" },
            "messages": [{ "role": "user", "content": prompt }]
        })
    } else {
        let authorization = format!("Bearer {}", api_key);
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&authorization)
                .map_err(|_| "API Key 含有非法字符".to_string())?,
        );
        json!({
            "model": model,
            "messages": [{ "role": "user", "content": prompt }],
            "temperature": 0.2
        })
    };

    let response = client
        .post(url)
        .headers(headers)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("AI 请求失败：{}", e))?;
    let status = response.status();
    let raw = response.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        let detail = raw.chars().take(500).collect::<String>();
        return Err(format!("AI 请求失败（{}）：{}", status, detail));
    }

    extract_ai_text(provider, &raw)
}

#[tauri::command]
async fn test_ai_connection(app: tauri::AppHandle, request: AiConfigRequest) -> Result<(), String> {
    let api_key = request
        .api_key
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.to_string())
        .map(Ok)
        .unwrap_or_else(|| config_api_key(&app))?;
    complete_ai_request(
        &request.provider,
        &request.base_url,
        &request.model,
        api_key,
        "只回复 OK。",
    )
    .await
    .map(|_| ())
}

#[tauri::command]
async fn complete_ai(
    app: tauri::AppHandle,
    request: AiCompletionRequest,
) -> Result<String, String> {
    let config = read_ai_config(&app)?;
    let provider = if request.provider.trim().is_empty() {
        config.provider
    } else {
        request.provider
    };
    let base_url = if request.base_url.trim().is_empty() {
        config.base_url
    } else {
        request.base_url
    };
    let model = if request.model.trim().is_empty() {
        config.model
    } else {
        request.model
    };
    complete_ai_request(
        &provider,
        &base_url,
        &model,
        config_api_key(&app)?,
        &request.prompt,
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::{endpoint, extract_ai_text, scan_dir, scan_workspace};

    #[test]
    fn builds_provider_endpoints() {
        assert_eq!(
            endpoint("https://api.openai.com/v1", "openai").unwrap(),
            "https://api.openai.com/v1/chat/completions"
        );
        assert_eq!(
            endpoint("https://api.anthropic.com", "anthropic").unwrap(),
            "https://api.anthropic.com/v1/messages"
        );
    }

    #[test]
    fn extracts_openai_response_text() {
        let raw = r#"{"choices":[{"message":{"content":"generated"}}]}"#;
        assert_eq!(extract_ai_text("openai", raw).unwrap(), "generated");
    }

    #[test]
    fn extracts_openai_array_content() {
        let raw = r#"{"choices":[{"message":{"content":[{"type":"text","text":"part-1"},{"type":"text","text":"part-2"}]}}]}"#;
        assert_eq!(extract_ai_text("openai", raw).unwrap(), "part-1part-2");
    }

    #[test]
    fn falls_back_to_reasoning_content() {
        let raw = r#"{"choices":[{"message":{"content":null,"reasoning_content":"thoughts"}}]}"#;
        assert_eq!(extract_ai_text("openai", raw).unwrap(), "thoughts");
    }

    #[test]
    fn extracts_anthropic_response_text() {
        let raw = r#"{"content":[{"type":"text","text":"generated"}]}"#;
        assert_eq!(extract_ai_text("anthropic", raw).unwrap(), "generated");
    }

    #[test]
    fn rejects_empty_ai_response() {
        let raw = r#"{"choices":[{"message":{"content":""}}]}"#;
        let err = extract_ai_text("openai", raw).unwrap_err();
        assert!(err.contains("AI 返回了空内容"), "unexpected error: {}", err);
        assert!(err.contains("原始响应"), "should include raw body: {}", err);
    }

    #[test]
    fn scans_workspace_into_file_tree() {
        use std::fs;
        let tmp = std::env::temp_dir().join(format!("markora-scan-{}", std::process::id()));
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(tmp.join("docs/sub")).unwrap();
        fs::create_dir_all(tmp.join(".git")).unwrap();
        fs::write(tmp.join("readme.md"), "# hi").unwrap();
        fs::write(tmp.join("docs/sub/note.markdown"), "x").unwrap();
        fs::write(tmp.join("docs/other.md"), "y").unwrap();
        fs::write(tmp.join(".git/config"), "").unwrap(); // 隐藏目录应被跳过
        fs::write(tmp.join("docs/skip.txt"), "").unwrap(); // 非 md 应被跳过

        let tree = scan_dir(&tmp, 0).unwrap();
        let names: Vec<&str> = tree.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(names, vec!["docs", "readme.md"]);

        let docs = &tree[0];
        assert!(docs.is_dir);
        assert_eq!(docs.children.len(), 2);
        assert_eq!(docs.children[0].name, "sub");
        assert_eq!(docs.children[0].children[0].name, "note.markdown");
        assert_eq!(docs.children[1].name, "other.md");

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn scan_workspace_rejects_non_dir() {
        let err = scan_workspace("/nonexistent/path/xyz").unwrap_err();
        assert!(!err.is_empty());
    }
}

// 读剪贴板图片并直接写成 PNG 文件,全程在 Rust 内完成,不经过 JS 传像素
// 返回写入的完整路径;剪贴板无图片时返回 Err
#[tauri::command]
fn save_clipboard_image(dir: &str, name: &str) -> Result<String, String> {
    use arboard::Clipboard;
    use image::ImageEncoder;
    use image::{ImageBuffer, Rgba};

    let mut cb = Clipboard::new().map_err(|e| e.to_string())?;
    let img = cb
        .get_image()
        .map_err(|e| format!("no clipboard image: {}", e))?;
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
                        Some(
                            p.canonicalize()
                                .map(|c| c.to_string_lossy().to_string())
                                .unwrap_or(a),
                        )
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
                                if is_markdown_path(&s) {
                                    Some(s)
                                } else {
                                    None
                                }
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
            create_folder,
            rename_path,
            trash_path,
            scan_workspace,
            save_clipboard_image,
            get_ai_config,
            save_ai_config,
            test_ai_connection,
            complete_ai,
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
