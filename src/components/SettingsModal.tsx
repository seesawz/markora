import { useEffect, useMemo, useRef, useState } from "react";
import { saveAiConfig, testAiConnection, type AiProvider } from "@/lib/ai";
import { useAiStore } from "@/store/aiStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff } from "lucide-react";

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
                    <Switch
                      aria-label="开启 AI 续写"
                      checked={config.enabled}
                      onCheckedChange={(checked) => {
                        if (checked && !config.apiKey) {
                          setMessage("请先在下方填写并保存 API Key，再开启 AI 续写。");
                          return;
                        }
                        config.setEnabled(checked);
                      }}
                    />
                  </div>
                </div>
              </section>
              <section className="settings-group" aria-labelledby="model-service-title">
                <h2 id="model-service-title">模型服务</h2>
                <div className="settings-card">
                  <div className="settings-row">
                    <span className="settings-row-copy"><strong>API 格式</strong><small>选择模型服务使用的请求协议</small></span>
                    <Select value={provider} onValueChange={(value) => setProvider(value as AiProvider)}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai">OpenAI Compatible</SelectItem>
                        <SelectItem value="anthropic">Anthropic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <label className="settings-row">
                    <span className="settings-row-copy"><strong>Base URL</strong><small>例如：{provider === "anthropic" ? "https://api.anthropic.com" : "https://api.openai.com/v1"}</small></span>
                    <Input ref={baseUrlRef} value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://api.example.com" spellCheck={false} className="w-[220px]" />
                  </label>
                  <label className="settings-row">
                    <span className="settings-row-copy"><strong>模型</strong><small>服务商提供的模型名称</small></span>
                    <Input value={model} onChange={(event) => setModel(event.target.value)} placeholder="模型名称" spellCheck={false} className="w-[220px]" />
                  </label>
                  <div className="settings-row">
                    <span className="settings-row-copy"><strong>API Key</strong><small>保存在本地配置文件，点击眼睛可查看</small></span>
                    <div className="relative w-[220px]">
                      <Input
                        type={showKey ? "text" : "password"}
                        value={apiKey}
                        onChange={(event) => setApiKey(event.target.value)}
                        placeholder="粘贴 API Key"
                        autoComplete="off"
                        spellCheck={false}
                        className="pr-8"
                      />
                      <button
                        type="button"
                        className="absolute right-1 top-1/2 -translate-y-1/2 grid place-items-center h-6 w-6 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        onClick={() => setShowKey((value) => !value)}
                        aria-label={showKey ? "隐藏 API Key" : "显示 API Key"}
                        title={showKey ? "隐藏" : "显示"}
                      >
                        {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {message && <div className="settings-message" role="status">{message}</div>}

              <footer className="flex justify-end gap-2 mt-5">
                <Button type="button" variant="secondary" onClick={() => void handleTest()} disabled={busy}>测试连接</Button>
                <Button type="submit" disabled={busy}>保存更改</Button>
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
