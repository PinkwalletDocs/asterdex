import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import WebApp from "@twa-dev/sdk";
import App from "./App";
import "./App.css";

WebApp.ready();
WebApp.expand();

/** Telegram Mini App：与客户端主题/安全区对齐（浏览器内无 themeParams 则跳过） */
try {
  const tp = WebApp.themeParams;
  if (tp.bg_color) {
    document.documentElement.style.backgroundColor = tp.bg_color;
    document.body.style.backgroundColor = tp.bg_color;
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && tp.bg_color) meta.setAttribute("content", tp.bg_color);
  WebApp.onEvent("themeChanged", () => {
    const next = WebApp.themeParams;
    if (next.bg_color) {
      document.documentElement.style.backgroundColor = next.bg_color;
      document.body.style.backgroundColor = next.bg_color;
      const m = document.querySelector('meta[name="theme-color"]');
      if (m) m.setAttribute("content", next.bg_color);
    }
  });
} catch {
  /* 非 TG 环境 */
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
