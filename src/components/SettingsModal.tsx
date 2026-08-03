import { useEffect, useMemo, useRef, useState } from "react";
import { saveAiConfig, testAiConnection, type AiProvider } from "../lib/ai";
import { useAiStore } from "../store/aiStore";
import { Select, SelectItem } from "./ui/Select";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const config = useAiStore();
  const baseUrlRef = useRef<HTMLInputElement>(null);
  const [provider, setProvider] = useState<AiProvider>(config.provider);
  const [baseUrl, setBaseUrl] = useState(config.baseUrl);
  const [model, setModel] = useState(config.model);
  const [apiKey, setApiKey] = useState(config.apiKey);
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    setProvider(config.provider);
    setBaseUrl(config.baseUrl);
    setModel(config.model);
    setApiKey(config.apiKey);
    setShowKey(false);
    setMessage(null);
    setQuery("");
    window.setTimeout(() => baseUrlRef.current?.focus(), 0);
  }, [open, config.provider, config.baseUrl, config.model, config.apiKey]);

  const showAiSettings = useMemo(() => {
    const keywords = "ai 服务 模型 api key base url openai anthropic";
    return keywords.includes(query.trim().toLowerCase());
  }, [query]);

  if (!open) return null;

  const input = {
    provider,
    baseUrl: baseUrl.trim(),
    model: model.trim(),
    apiKey: apiKey.trim(),
  };

  const validate = () => {
    if (!input.baseUrl || !input.model) {
      setMessage("请填写 Base URL 和模型名称。");
      return false;
    }
    if (!input.apiKey) {
      setMessage("请填写 API Key。");
      return false;
    }
    return true;
  };

  const handleTest = async () => {
    if (!validate()) return;
    setBusy(true);
    setMessage(null);
    try {
      await testAiConnection(input);
      setMessage("连接成功。");
    } catch (error) {
      setMessage(String(error));
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    if (!validate()) return;
    setBusy(true);
    setMessage(null);
    try {
      const saved = await saveAiConfig(input);
      useAiStore.getState().setConfig(saved);
      onClose();
    } catch (error) {
      setMessage(String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="settings-overlay"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      onKeyDown={(event) => event.key === "Escape" && onClose()}
    >
      <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title">
        <button type="button" className="settings-close-button" onClick={onClose} aria-label="关闭设置">✕</button>
        <aside className="settings-sidebar">
          <label className="settings-search">
            <span aria-hidden="true">⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索设置..." aria-label="搜索设置" />
          </label>

          <nav className="settings-navigation" aria-label="设置分类">
            <span className="settings-navigation-title">AI</span>
            {showAiSettings && (
              <button type="button" className="settings-nav-item settings-nav-item-active" aria-current="page">
                <span className="settings-nav-icon" aria-hidden="true">✦</span>
                AI 服务
              </button>
            )}
          </nav>
        </aside>

        <main className="settings-content">
          {showAiSettings ? (
            <form onSubmit={(event) => { event.preventDefault(); void handleSave(); }}>
              <h1 id="settings-modal-title">AI 服务</h1>
              <section className="settings-group" aria-labelledby="inline-completion-title">
                <h2 id="inline-completion-title">AI 续写</h2>
                <div className="settings-card">
                  <div className="settings-row">
                    <span className="settings-row-copy"><strong>自动续写</strong><small>停止输入 0.8 秒后生成建议，按 Tab 接受</small></span>
                    <button
                      type="button"
                      role="switch"
                      aria-label="开启 AI 续写"
                      aria-checked={config.enabled}
                      className="settings-switch"
                      onClick={() => {
                        if (!config.apiKey) {
                          setMessage("请先在下方填写并保存 API Key，再开启 AI 续写。");
                          return;
                        }
                        config.setEnabled(!config.enabled);
                      }}
                    ><span /></button>
                  </div>
                </div>
              </section>
              <section className="settings-group" aria-labelledby="model-service-title">
                <h2 id="model-service-title">模型服务</h2>
                <div className="settings-card">
                  <div className="settings-row">
                    <span className="settings-row-copy"><strong>API 格式</strong><small>选择模型服务使用的请求协议</small></span>
                    <Select value={provider} onValueChange={(value) => setProvider(value as AiProvider)}>
                      <SelectItem value="openai">OpenAI Compatible</SelectItem>
                      <SelectItem value="anthropic">Anthropic</SelectItem>
                    </Select>
                  </div>
                  <label className="settings-row">
                    <span className="settings-row-copy"><strong>Base URL</strong><small>例如：{provider === "anthropic" ? "https://api.anthropic.com" : "https://api.openai.com/v1"}</small></span>
                    <input ref={baseUrlRef} value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://api.example.com" spellCheck={false} />
                  </label>
                  <label className="settings-row">
                    <span className="settings-row-copy"><strong>模型</strong><small>服务商提供的模型名称</small></span>
                    <input value={model} onChange={(event) => setModel(event.target.value)} placeholder="模型名称" spellCheck={false} />
                  </label>
                  <div className="settings-row">
                    <span className="settings-row-copy"><strong>API Key</strong><small>保存在本地配置文件，点击眼睛可查看</small></span>
                    <div className="settings-key-field">
                      <input
                        type={showKey ? "text" : "password"}
                        value={apiKey}
                        onChange={(event) => setApiKey(event.target.value)}
                        placeholder="粘贴 API Key"
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <button
                        type="button"
                        className="settings-eye-button"
                        onClick={() => setShowKey((value) => !value)}
                        aria-label={showKey ? "隐藏 API Key" : "显示 API Key"}
                        title={showKey ? "隐藏" : "显示"}
                      >
                        <EyeIcon open={showKey} />
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {message && <div className="settings-message" role="status">{message}</div>}

              <footer className="settings-modal-actions">
                <button type="button" className="secondary-button" onClick={() => void handleTest()} disabled={busy}>测试连接</button>
                <button type="submit" className="primary-button" disabled={busy}>保存更改</button>
              </footer>
            </form>
          ) : (
            <div className="settings-empty-state">
              <h1 id="settings-modal-title">未找到设置</h1>
              <p>试试搜索 “AI”、“模型” 或 “API Key”。</p>
            </div>
          )}
        </main>
      </section>
    </div>
  );
}
