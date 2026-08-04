import { useEffect, useMemo, useRef, useState } from "react";
import { saveAiConfig, testAiConnection, type AiProvider } from "@/lib/ai";
import { useAiStore } from "@/store/aiStore";
import { useEditorStore } from "@/store/editorStore";
import { useT } from "@/lib/i18n";
import { rebuildMenu } from "@/lib/menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { Eye, EyeOff, Sparkles, Settings as SettingsIcon } from "lucide-react";

type Lang = "zh" | "en";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const config = useAiStore();
  const { lang, setLang } = useEditorStore();
  const tr = useT();
  const baseUrlRef = useRef<HTMLInputElement>(null);
  const [provider, setProvider] = useState<AiProvider>(config.provider);
  const [baseUrl, setBaseUrl] = useState(config.baseUrl);
  const [model, setModel] = useState(config.model);
  const [apiKey, setApiKey] = useState(config.apiKey);
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeSection, setActiveSection] = useState("ai-service");

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
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const keywords = [
      "ai", "ai 续写", "续写", "completion", "complete",
      "服务", "service", "模型", "model", "api key", "api", "key",
      "base url", "base", "url", "openai", "anthropic", "claude", "gpt",
      "设置", "settings",
    ];
    return keywords.some((kw) => kw.includes(q));
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

  const handleLanguageChange = (next: Lang) => {
    if (next === lang) return;
    setLang(next);
    rebuildMenu().catch((e) => console.error("rebuild menu failed:", e));
  };

  const NavItem = ({
    id, label, icon,
  }: { id: string; label: string; icon: React.ReactNode }) => (
    <button
      type="button"
      className={
        activeSection === id
          ? "flex items-center gap-2.5 w-full h-8 px-3 rounded-md bg-accent text-accent-foreground font-medium text-sm transition-colors"
          : "flex items-center gap-2.5 w-full h-8 px-3 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground text-sm transition-colors"
      }
      onClick={() => setActiveSection(id)}
    >
      <span className="flex h-4 w-4 items-center justify-center">{icon}</span>
      <span>{label}</span>
    </button>
  );

  const SectionRow = ({
    label, description, children,
  }: { label: string; description: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between py-2">
      <div className="flex-1 min-w-0 pr-4">
        <div className="text-[13px] font-medium text-foreground">{label}</div>
        <div className="text-[13px] text-muted-foreground mt-1 leading-snug">{description}</div>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="mt-6 first:mt-0">
      <h2 className="text-[13px] font-semibold text-foreground mb-1">{title}</h2>
      <div>{children}</div>
    </section>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      onKeyDown={(event) => event.key === "Escape" && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="relative flex w-[900px] h-[620px] max-w-[calc(100vw-48px)] max-h-[calc(100vh-48px)] overflow-hidden rounded-[20px] bg-background shadow-none select-text"
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭设置"
          className="absolute top-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Sidebar */}
        <aside className="flex w-52 flex-col border-r border-border bg-muted/30 p-3">
          <div className="relative mb-4">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tr.settingsSearch}
              aria-label={tr.settingsSearch}
              className="pl-9 h-8 border-0 bg-muted/50 text-sm shadow-none focus-visible:ring-1"
            />
          </div>

          <nav className="flex flex-col gap-5 overflow-y-auto">
            <div>
              <div className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {lang === "zh" ? "设置" : "Settings"}
              </div>
              <div className="flex flex-col gap-0.5">
                {showAiSettings && (
                  <NavItem id="ai-service" label={tr.settingsAiCompletion} icon={<Sparkles className="h-4 w-4" />} />
                )}
              </div>
            </div>

            <div>
              <div className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {lang === "zh" ? "外观" : "Appearance"}
              </div>
              <div className="flex flex-col gap-0.5">
                <NavItem id="appearance" label={tr.settingsAppearance} icon={<SettingsIcon className="h-4 w-4" />} />
              </div>
            </div>
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-y-auto select-text">
          <div className="px-6 py-4">
            {showAiSettings && activeSection === "ai-service" ? (
              <form onSubmit={(event) => { event.preventDefault(); void handleSave(); }}>
                <h1 id="settings-title" className="text-[15px] font-semibold text-foreground mb-2">
                  {tr.settingsAiCompletion}
                </h1>

                <Section title={tr.autoCompletionTitle}>
                  <SectionRow
                    label={tr.enableCompletion}
                    description={tr.enableCompletionDesc}
                  >
                    <Switch
                      aria-label={tr.enableCompletion}
                      checked={config.enabled}
                      onCheckedChange={(checked) => {
                        if (checked && !config.apiKey) {
                          setMessage("请先在下方填写并保存 API Key，再开启 AI 续写。");
                          return;
                        }
                        config.setEnabled(checked);
                      }}
                    />
                  </SectionRow>
                </Section>

                <Section title={tr.modelService}>
                  <SectionRow label={tr.apiFormat} description={tr.apiFormatDesc}>
                    <Select value={provider} onValueChange={(value) => setProvider(value as AiProvider)}>
                      <SelectTrigger className="w-[220px] h-8 border-0 bg-muted/50 text-sm shadow-none focus:ring-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg !border-0 shadow-lg">
                        <SelectItem value="openai">OpenAI Compatible</SelectItem>
                        <SelectItem value="anthropic">Anthropic</SelectItem>
                      </SelectContent>
                    </Select>
                  </SectionRow>

                  <SectionRow label={tr.baseUrl} description={`例如：${provider === "anthropic" ? "https://api.anthropic.com" : "https://api.openai.com/v1"}`}>
                    <Input
                      ref={baseUrlRef}
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      placeholder="https://api.example.com"
                      spellCheck={false}
                      className="w-[220px] h-8 border-0 bg-muted/50 text-sm shadow-none focus-visible:ring-1"
                    />
                  </SectionRow>

                  <SectionRow label={tr.modelName} description={tr.modelNameDesc}>
                    <Input
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="例如 gpt-4o-mini"
                      spellCheck={false}
                      className="w-[220px] h-8 border-0 bg-muted/50 text-sm shadow-none focus-visible:ring-1"
                    />
                  </SectionRow>

                  <SectionRow label={tr.apiKey} description={tr.apiKeyDesc}>
                    <div className="relative w-[220px]">
                      <Input
                        type={showKey ? "text" : "password"}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={tr.apiKeyPlaceholder}
                        autoComplete="off"
                        spellCheck={false}
                        className="h-8 border-0 bg-muted/50 pr-10 text-sm shadow-none focus-visible:ring-1"
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        onClick={() => setShowKey((v) => !v)}
                        aria-label={showKey ? "隐藏 API Key" : "显示 API Key"}
                      >
                        {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </SectionRow>
                </Section>

                {message && (
                  <div
                    role="status"
                    className="mt-3 flex items-start gap-2 rounded-md bg-muted px-2.5 py-2 text-[12px] text-muted-foreground"
                  >
                    <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="2" y1="8" x2="12.01" y2="8" />
                    </svg>
                    <span>{message}</span>
                  </div>
                )}

                <div className="mt-5 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleTest()}
                    disabled={busy}
                  >
                    {tr.testConnection}
                  </Button>
                  <Button type="submit" variant="default" size="sm" disabled={busy}>
                    {tr.save}
                  </Button>
                </div>
              </form>
            ) : activeSection === "appearance" ? (
              <div>
                <h1 id="settings-title" className="text-[15px] font-semibold text-foreground mb-2">
                  {tr.settingsAppearance}
                </h1>

                <Section title={tr.settingsLanguage}>
                  <SectionRow label={tr.settingsLanguage} description={tr.settingsLanguageDesc}>
                    <div className="inline-flex h-8 overflow-hidden rounded-md bg-muted/50">
                      {(["zh", "en"] as const).map((l) => (
                        <button
                          key={l}
                          type="button"
                          onClick={() => handleLanguageChange(l)}
                          className={
                            "px-3 text-xs font-medium transition-colors " +
                            (lang === l
                              ? "bg-accent text-foreground"
                              : "text-muted-foreground hover:bg-accent hover:text-foreground")
                          }
                        >
                          {l === "zh" ? "简体中文" : "English"}
                        </button>
                      ))}
                    </div>
                  </SectionRow>
                </Section>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <h1 id="settings-title" className="text-xl font-semibold text-foreground mb-2">
                  未找到设置
                </h1>
                <p className="text-sm text-muted-foreground">
                  试试搜索 “AI”、“模型” 或 “API Key”。
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
