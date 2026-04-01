import { BSC_RPC } from "./config";

/** 仅授权 BSC，避免移动端授权弹窗出现多网络选择 */
export const WC_OPTIONAL_CHAIN_IDS: number[] = [];

/** eip155 风格 RPC，键为十进制 chainId 字符串 */
export const WC_RPC_MAP: Record<string, string> = {
  "56": BSC_RPC,
};

export function getWalletConnectProjectId(): string {
  return (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined)?.trim() ?? "";
}

/** Reown 校验用：含 Vite base（如 /asterdex），避免子路径部署时 metadata 与站点不一致 */
export function getWalletConnectMetadataUrl(): string {
  if (typeof window === "undefined") return "";
  const base = import.meta.env.BASE_URL.replace(/\/+$/, "");
  return base ? `${window.location.origin}${base}` : window.location.origin;
}

/** 系统浏览器（无钱包 WebView）常见于手机；与桌面区分以改用 URI 二维码而非 App 深度链接 */
export function isMobileSystemBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent);
}

export const WC_WALLET_UUID = "walletconnect-v2";
