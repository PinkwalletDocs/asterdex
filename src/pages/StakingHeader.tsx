import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "../context/WalletContext";

function shortAddr(v: string | null) {
  if (!v) return "";
  return `${v.slice(0, 6)}...${v.slice(-4)}`;
}

const ASTER_LOGO_URL = "https://static.asterdexfx.com/cloud-futures/static/images/aster/mini_logo.svg";

const CHAIN_OPTIONS = [
  { id: "bnb", name: "BNB Chain", icon: "https://assets.coingecko.com/coins/images/12591/small/binance-coin-logo.png" },
  { id: "eth", name: "Ethereum", icon: "https://assets.coingecko.com/coins/images/279/small/ethereum.png" },
  { id: "arb", name: "Arbitrum", icon: "https://assets.coingecko.com/coins/images/16547/small/arb.jpg" },
  { id: "sol", name: "Solana", icon: "https://assets.coingecko.com/coins/images/4128/small/solana.png" },
] as const;

export function StakingHeader() {
  const { address, openConnectModal, setShowWalletList } = useWallet();
  const headerRef = useRef<HTMLElement | null>(null);
  const [openChain, setOpenChain] = useState(false);
  const [selectedUiChain, setSelectedUiChain] = useState<(typeof CHAIN_OPTIONS)[number]["id"]>("bnb");
  const activeChain = CHAIN_OPTIONS.find((c) => c.id === selectedUiChain)!;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (headerRef.current?.contains(t)) return;
      setOpenChain(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  return (
    <header ref={headerRef} className="top-header staking-site-header" data-nav-chrome="true">
      <Link to="/" className="brand-box">
        <img className="aster-logo" src={ASTER_LOGO_URL} alt="" />
        <span className="brand-name">ASTER</span>
      </Link>

      <nav className="top-nav staking-top-nav">
        <Link to="/" className="nav-item plain">
          交易 <span className="chev">▼</span>
        </Link>
        <button type="button" className="nav-item plain">
          投资组合
        </button>
        <button type="button" className="nav-item plain">
          推荐
        </button>
        <Link to="/staking" className="nav-item plain staking-nav-active">
          质押
        </Link>
        <button type="button" className="nav-item plain">
          浏览器
        </button>
        <button type="button" className="nav-item plain">
          奖励 <span className="chev">▼</span>
        </button>
        <button type="button" className="nav-item plain">
          更多 <span className="chev">▼</span>
        </button>
      </nav>

      <div className="header-actions">
        <div className="nav-dd-wrap chain-slot">
          <button
            type="button"
            className="icon-square chain-trigger"
            aria-label="网络"
            onClick={() => setOpenChain((v) => !v)}
          >
            <img src={activeChain.icon} alt="" className="chain-trigger-img" referrerPolicy="no-referrer" />
            <span className="chev sm">▼</span>
          </button>
          {openChain ? (
            <div className="dropdown dropdown-chain" data-dropdown-surface="true">
              {CHAIN_OPTIONS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="chain-row"
                  onClick={() => {
                    setSelectedUiChain(c.id);
                    setOpenChain(false);
                  }}
                >
                  <img src={c.icon} alt="" className="chain-row-icon" referrerPolicy="no-referrer" />
                  <span className="chain-row-name">{c.name}</span>
                  {c.id === selectedUiChain ? <span className="chain-dot" /> : <span className="chain-dot empty" />}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {address ? (
          <button
            type="button"
            className="wallet-pill"
            data-connect-wallet="true"
            onClick={() => setShowWalletList((v) => !v)}
          >
            {shortAddr(address)}
          </button>
        ) : null}
        <button
          type="button"
          className="connect-btn"
          data-connect-wallet="true"
          onClick={() => {
            if (address) setShowWalletList((v) => !v);
            else openConnectModal();
          }}
        >
          {address ? "已连接" : "连接钱包"}
        </button>
        <button type="button" className="icon-square" aria-label="语言">
          <span className="glyph-globe">⌁</span>
        </button>
        <button type="button" className="icon-square" aria-label="设置">
          <span className="glyph-gear">⚙</span>
        </button>
      </div>
    </header>
  );
}
