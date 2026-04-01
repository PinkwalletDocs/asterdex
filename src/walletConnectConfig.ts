import { BSC_RPC } from "./config";

/** 默认 BSC，其余为可选链（WalletConnect 会话内可切换） */
export const WC_OPTIONAL_CHAIN_IDS = [
  1, // Ethereum
  137, // Polygon
  42161, // Arbitrum One
  10, // Optimism
  8453, // Base
  43114, // Avalanche C-Chain
  250, // Fantom
  100, // Gnosis
  324, // zkSync Era
] as const;

/** eip155 风格 RPC，键为十进制 chainId 字符串 */
export const WC_RPC_MAP: Record<string, string> = {
  "1": "https://cloudflare-eth.com",
  "56": BSC_RPC,
  "137": "https://polygon-rpc.com",
  "42161": "https://arb1.arbitrum.io/rpc",
  "10": "https://mainnet.optimism.io",
  "8453": "https://mainnet.base.org",
  "43114": "https://api.avax.network/ext/bc/C/rpc",
  "250": "https://rpc.ankr.com/fantom",
  "100": "https://rpc.gnosischain.com",
  "324": "https://mainnet.era.zksync.io",
};

export function getWalletConnectProjectId(): string {
  return (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined)?.trim() ?? "";
}

export const WC_WALLET_UUID = "walletconnect-v2";
