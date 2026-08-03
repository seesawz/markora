import { useEffect, useMemo, useRef, useState } from "react";
import { saveAiConfig, testAiConnection, type AiProvider } from "../lib/ai";
import { useAiStore } from "../store/aiStore";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const config = useAiStore();
  const baseUrlRef = useRef<HTMLInputElement>(null);
  const [provider, setProvider] = useState<AiProvider>(config.provider);
  const [baseUrl, setBaseUrl] = useState(config.baseUrl);
  const [model, setModel] = useState(config.model);
  const [apiKey, setApiKey] = useState("");
  const [clearApiKey, setClearApiKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    setProvider(config.provider);
    setBaseUrl(config.baseUrl);
    setModel(config.model);
    setApiKey("");
    setClearApiKey(false);
    setMessage(null);
    setQuery("");
    window.setTimeout(() => baseUrlRef.current?.focus(), 0);
  }, [open, config.provider, config.baseUrl, config.model]);

  const showAiSettings = useMemo(() => {
    const keywords = "ai 服务 模型 api key base url openai anthropic";
    return keywords.includes(query.trim().toLowerCase());
  }, [query]);

  if (!open) return null;

  const input = {
    provider,
    baseUrl: baseUrl.trim(),
    model: model.trim(),
    apiKey: apiKey.trim() || undefined,
    clearApiKey,
  };

  const validate = () => {
    if (!input.baseUrl || !input.model) {
      setMessage("请填写 Base URL 和模型名称。");
      return false;
    }
    if (!config.apiKeyConfigured && !input.apiKey) {
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
    <div className="settings-overlay" onKeyDown={(event) => event.key === "Escape" && onClose()}>
      <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title">
        <aside className="settings-sidebar">
          <button type="button" className="settings-back-button" onClick={onClose}>← <span>返回应用</span></button>
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
                        if (!config.apiKeyConfigured) {
                          setMessage("请先保存 API Key，再开启 AI 续写。");
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
                  <label className="settings-row">
                    <span className="settings-row-copy"><strong>API 格式</strong><small>选择模型服务使用的请求协议</small></span>
                    <select value={provider} onChange={(event) => setProvider(event.target.value as AiProvider)}>
                      <option value="openai">OpenAI Compatible</option>
                      <option value="anthropic">Anthropic</option>
                    </select>
                  </label>
                  <label className="settings-row">
                    <span className="settings-row-copy"><strong>Base URL</strong><small>例如：{provider === "anthropic" ? "https://api.anthropic.com" : "https://api.openai.com/v1"}</small></span>
                    <input ref={baseUrlRef} value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://api.example.com" spellCheck={false} />
                  </label>
                  <label className="settings-row">
                    <span className="settings-row-copy"><strong>模型</strong><small>服务商提供的模型名称</small></span>
                    <input value={model} onChange={(event) => setModel(event.target.value)} placeholder="模型名称" spellCheck={false} />
                  </label>
                  <label className="settings-row">
                    <span className="settings-row-copy"><strong>API Key</strong><small>{config.apiKeyConfigured && !clearApiKey ? "已配置，留空保持不变" : "只保存在系统钥匙串中"}</small></span>
                    <input type="password" value={apiKey} onChange={(event) => { setApiKey(event.target.value); setClearApiKey(false); }} placeholder={config.apiKeyConfigured ? "已配置" : "粘贴 API Key"} autoComplete="off" />
                  </label>
                  {config.apiKeyConfigured && (
                    <div className="settings-row settings-row-action">
                      <span className="settings-row-copy"><strong>已保存的 Key</strong><small>清除后需要重新配置 API Key</small></span>
                      <button type="button" className="secondary-button" onClick={() => setClearApiKey((value) => !value)}>{clearApiKey ? "保留" : "清除"}</button>
                    </div>
                  )}
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
