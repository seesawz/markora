import { useEffect, useState } from "react";
import { WarningCircle, X } from "@phosphor-icons/react";
import { TOAST_EVENT } from "../lib/toast";

export function Toast() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    let timer = 0;
    const show = (event: Event) => {
      setMessage((event as CustomEvent<string>).detail);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setMessage(""), 5000);
    };
    window.addEventListener(TOAST_EVENT, show);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(TOAST_EVENT, show);
    };
  }, []);

  if (!message) return null;
  return (
    <div className="app-toast" role="alert">
      <WarningCircle size={18} className="shrink-0" />
      <span className="min-w-0 flex-1">{message}</span>
      <button type="button" onClick={() => setMessage("")} aria-label="关闭提示">
        <X size={15} />
      </button>
    </div>
  );
}
