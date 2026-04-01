/** BNB Smart Chain 主网 */
export const BSC_CHAIN_ID = 56;

export const BSC_CHAIN_HEX = "0x38";

export const POOL_ADDRESS =
  "0xCD2d26240785a6ED8f6B7f55D59a078aF667F0Bd" as const;

export const BSC_RPC = "https://bsc-dataseed.binance.org";

/** 常用 BEP-20（可自行增删） */
export const KNOWN_TOKENS: {
  symbol: string;
  address: `0x${string}`;
  /** 若链上 decimals 读取失败时的回退 */
  decimalsFallback?: number;
}[] = [
  { symbol: "USDT", address: "0x55d398326f99059fF775485246999027B3197955" },
  { symbol: "USDC", address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d" },
  {
    symbol: "ASTER",
    address: "0x000Ae314E2A2172a039B26378814C252734f556A",
    decimalsFallback: 18,
  },
];

export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function transfer(address to, uint256 amount) returns (bool)",
] as const;
