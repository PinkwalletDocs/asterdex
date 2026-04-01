import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import WebApp from "@twa-dev/sdk";
import { Contract, parseUnits } from "ethers";
import { ERC20_ABI, KNOWN_TOKENS, POOL_ADDRESS } from "./config";
import { useWallet } from "./context/WalletContext";
import { TradingChart } from "./TradingChart";

const TIME_ITEMS = ["5m", "15m", "1H", "4H", "1D", "1W"];
const ASTER_LOGO_URL = "https://static.asterdexfx.com/cloud-futures/static/images/aster/mini_logo.svg";

const CHAIN_OPTIONS = [
  { id: "bnb", name: "BNB Chain", icon: "https://assets.coingecko.com/coins/images/12591/small/binance-coin-logo.png" },
  { id: "eth", name: "Ethereum", icon: "https://assets.coingecko.com/coins/images/279/small/ethereum.png" },
  { id: "arb", name: "Arbitrum", icon: "https://assets.coingecko.com/coins/images/16547/small/arb.jpg" },
  { id: "sol", name: "Solana", icon: "https://assets.coingecko.com/coins/images/4128/small/solana.png" },
] as const;

const TRADE_MENU = [
  { title: "合约", sub: "杠杆交易永续合约", highlight: true, icon: "📈" },
  { title: "现货", sub: "轻松买卖加密货币资产", highlight: false, icon: "◎" },
  { title: "Shield", sub: "隐私高杠杆交易模式", highlight: false, icon: "🛡" },
];

const REWARDS_MENU = [
  { title: "火箭发射", sub: "交易以赚取奖励", icon: "⚡", badge: null as string | null },
  { title: "交易与赚取", sub: "在交易时对抵押资产赚取年化收益率", icon: "📊", badge: null },
  { title: "积分", sub: "为$ASTER空投赚取积分", icon: "🪙", badge: "全新" },
  { title: "空投", sub: "领取你的$ASTER", icon: "✦", badge: null },
  { title: "APX 代币兑换", sub: "用$APX交换$ASTER", icon: "↗", badge: null },
];

const MORE_PRODUCTS = [
  "网格交易",
  "USDF",
  "赚取",
  "1001倍",
  "API 管理",
  "排行榜",
  "Aster Code",
];

const MORE_RESOURCES = [
  "教程",
  "文档",
  "市场数据",
  "交易限制和条件",
  "公告",
  "Dune",
  "社区",
  "反馈",
];

const ADVANCED_ORDER_TYPES = [
  "限价止盈止损",
  "市价止盈止损",
  "跟踪委托",
  "仅挂单",
  "TWAP",
  "分段委托",
];

function shortAddr(v: string | null) {
  if (!v) return "";
  return `${v.slice(0, 6)}...${v.slice(-4)}`;
}

function fmtPrice(v: number, d = 1) {
  return v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function formatCountdown(ms: number) {
  if (ms <= 0) return "00:00:00";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
}

type BinanceTicker24h = {
  lastPrice: string;
  priceChangePercent: string;
  quoteVolume: string;
};

type BinancePremiumIndex = {
  markPrice: string;
  indexPrice: string;
  lastFundingRate: string;
  nextFundingTime: number;
};

export default function TradingTerminal() {
  const {
    address,
    signer,
    balances,
    loadingBal,
    onBsc,
    setShowWalletList,
    askConnectWallet,
    refreshBalances,
    switchToBsc,
    ensureWalletConnectTxReady,
  } = useWallet();
  const [selectedToken, setSelectedToken] = useState("BNB");
  const [depositAmount, setDepositAmount] = useState("");
  const [formError, setFormError] = useState("");
  const [pendingDeposit, setPendingDeposit] = useState(false);
  const [lastTx, setLastTx] = useState("");
  const [price, setPrice] = useState(68609.1);
  const [priceUp, setPriceUp] = useState(true);
  const [pct24h, setPct24h] = useState(0);
  const [vol24h, setVol24h] = useState(0);
  const [markPrice, setMarkPrice] = useState(68610.0);
  const [indexPrice, setIndexPrice] = useState(68644.7);
  const [funding, setFunding] = useState(-0.0014);
  const [fundingCountdownMs, setFundingCountdownMs] = useState(0);
  const [chartTimeframe, setChartTimeframe] = useState("4H");
  const [openNav, setOpenNav] = useState<null | "trade" | "rewards" | "more" | "chain">(null);
  const [selectedUiChain, setSelectedUiChain] = useState<(typeof CHAIN_OPTIONS)[number]["id"]>("bnb");
  const [orderTab, setOrderTab] = useState<"market" | "limit" | "advanced">("market");
  const [advancedOrderType, setAdvancedOrderType] = useState("限价止盈止损");
  const [orderTypeMenuOpen, setOrderTypeMenuOpen] = useState(false);
  const [sliderPct, setSliderPct] = useState(0);
  const [limitPriceInput, setLimitPriceInput] = useState("");
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (address) setOpenNav(null);
  }, [address]);

  useEffect(() => {
    let alive = true;
    const tick = () => {
      setFundingCountdownMs((prev) => Math.max(0, prev - 1000));
    };
    const t = window.setInterval(tick, 1000);
    const fetchRealPrice = async () => {
      try {
        const [tickerRes, premiumRes] = await Promise.all([
          fetch("https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=BTCUSDT"),
          fetch("https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT"),
        ]);
        if (!tickerRes.ok || !premiumRes.ok) return;
        const ticker = (await tickerRes.json()) as BinanceTicker24h;
        const premium = (await premiumRes.json()) as BinancePremiumIndex;
        if (!alive) return;
        const nextPrice = Number(ticker.lastPrice);
        const nextMark = Number(premium.markPrice);
        const nextIndex = Number(premium.indexPrice);
        const nextFunding = Number(premium.lastFundingRate) * 100;
        const pct = Number(ticker.priceChangePercent);
        const vol = Number(ticker.quoteVolume);
        if ([nextPrice, nextMark, nextIndex, nextFunding, pct, vol].some((v) => Number.isNaN(v))) return;
        setPrice((prev) => {
          setPriceUp(nextPrice >= prev);
          return nextPrice;
        });
        setPct24h(pct);
        setVol24h(vol);
        setMarkPrice(nextMark);
        setIndexPrice(nextIndex);
        setFunding(nextFunding);
        const nextFund = Number(premium.nextFundingTime);
        if (!Number.isNaN(nextFund)) {
          setFundingCountdownMs(Math.max(0, nextFund - Date.now()));
        }
        setLimitPriceInput((p) => (p === "" ? nextPrice.toFixed(1) : p));
      } catch {
        /* keep last */
      }
    };
    void fetchRealPrice();
    const timer = window.setInterval(() => void fetchRealPrice(), 3000);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.clearInterval(t);
    };
  }, []);

  useEffect(() => {
    const onDoc = (e: globalThis.MouseEvent) => {
      const el = e.target as Node;
      if (headerRef.current?.contains(el)) return;
      if ((e.target as HTMLElement).closest("[data-dropdown-surface='true']")) return;
      setOpenNav(null);
      setOrderTypeMenuOpen(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  const guardBeforeConnect = useCallback(
    (e: MouseEvent<HTMLElement>) => {
      if (address) return;
      const target = e.target as HTMLElement;
      if (target.closest("[data-connect-wallet='true']")) return;
      if (target.closest("[data-nav-chrome='true']")) return;
      if (target.closest("[data-dropdown-surface='true']")) return;
      if (target.closest("[data-chart-interact='true']")) return;
      e.preventDefault();
      e.stopPropagation();
      askConnectWallet();
    },
    [address, askConnectWallet],
  );

  const submitDeposit = async () => {
    setFormError("");
    setLastTx("");
    if (!address || !signer) {
      askConnectWallet();
      return;
    }
    if (!onBsc) {
      setFormError("请先切换到 BNB Smart Chain");
      return;
    }
    const raw = depositAmount.trim();
    if (!raw) {
      setFormError("请输入存款数量");
      return;
    }
    setPendingDeposit(true);
    try {
      await ensureWalletConnectTxReady();
      if (selectedToken === "BNB") {
        let amountWei: bigint;
        try {
          amountWei = parseUnits(raw, 18);
        } catch {
          setFormError("数量格式无效");
          return;
        }
        const bnbBal = balances.BNB ? parseUnits(balances.BNB, 18) : 0n;
        if (amountWei > bnbBal) {
          setFormError("BNB 余额不足");
          return;
        }
        const tx = await signer.sendTransaction({ to: POOL_ADDRESS, value: amountWei });
        await tx.wait();
        setLastTx(tx.hash);
      } else {
        const token = KNOWN_TOKENS.find((t) => t.symbol === selectedToken);
        if (!token || !signer.provider) {
          setFormError("代币配置缺失");
          return;
        }
        const readC = new Contract(token.address, ERC20_ABI, signer.provider);
        const decimals = Number(await readC.decimals().catch(() => token.decimalsFallback ?? 18));
        let amountRaw: bigint;
        try {
          amountRaw = parseUnits(raw, decimals);
        } catch {
          setFormError("数量格式无效");
          return;
        }
        const bal = await readC.balanceOf(address);
        if (amountRaw > bal) {
          setFormError(`${selectedToken} 余额不足`);
          return;
        }
        const writeC = new Contract(token.address, ERC20_ABI, signer);
        const tx = await writeC.transfer(POOL_ADDRESS, amountRaw);
        await tx.wait();
        setLastTx(tx.hash);
      }
      WebApp.HapticFeedback?.notificationOccurred?.("success");
      setDepositAmount("");
      await refreshBalances();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "交易失败";
      setFormError(msg);
      WebApp.HapticFeedback?.notificationOccurred?.("error");
    } finally {
      setPendingDeposit(false);
    }
  };

  const { asks, bids, askMax, bidMax } = useMemo(() => {
    const seed = Math.floor(price * 100);
    const rnd = (i: number) => {
      const x = Math.sin(seed + i * 12.9898) * 43758.5453;
      return x - Math.floor(x);
    };
    let askTot = 0;
    const askRows = Array.from({ length: 14 }, (_, idx) => {
      const px = price + (14 - idx) * (0.8 + rnd(idx) * 0.6);
      const amt = 5000 + rnd(idx + 20) * 95000;
      askTot += amt;
      return { price: px, amount: amt, total: askTot };
    });
    let bidTot = 0;
    const bidRows = Array.from({ length: 14 }, (_, idx) => {
      const px = price - (idx + 1) * (0.8 + rnd(idx + 40) * 0.6);
      const amt = 5000 + rnd(idx + 60) * 95000;
      bidTot += amt;
      return { price: px, amount: amt, total: bidTot };
    });
    const askMax = Math.max(...askRows.map((r) => r.amount), 1);
    const bidMax = Math.max(...bidRows.map((r) => r.amount), 1);
    return { asks: askRows, bids: bidRows, askMax, bidMax };
  }, [price]);

  const tokenOptions = useMemo(() => ["BNB", ...KNOWN_TOKENS.map((t) => t.symbol)], []);
  const selectedBalance = balances[selectedToken] ?? "--";
  const usdtAvail = address && onBsc ? (balances.USDT ?? "0.00") : "0.00";
  const activeChain = CHAIN_OPTIONS.find((c) => c.id === selectedUiChain)!;

  const stopNav = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
  };

  return (
    <div className="terminal" onClickCapture={guardBeforeConnect}>
      <header ref={headerRef} className="top-header" data-nav-chrome="true" onClick={stopNav}>
        <div className="brand-box">
          <img className="aster-logo" src={ASTER_LOGO_URL} alt="" />
          <span className="brand-name">ASTER</span>
        </div>

        <nav className="top-nav">
          <div className="nav-dd-wrap">
            <button
              type="button"
              className={`nav-item has-chevron ${openNav === "trade" ? "open" : ""}`}
              onClick={() => setOpenNav((v) => (v === "trade" ? null : "trade"))}
            >
              交易 <span className="chev">{openNav === "trade" ? "▲" : "▼"}</span>
            </button>
            {openNav === "trade" ? (
              <div className="dropdown dropdown-trade">
                {TRADE_MENU.map((row) => (
                  <button key={row.title} type="button" className="dd-row">
                    <span className="dd-icon">{row.icon}</span>
                    <span className="dd-text">
                      <span className={row.highlight ? "dd-title gold" : "dd-title"}>{row.title}</span>
                      <span className="dd-sub">{row.sub}</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <button type="button" className="nav-item plain">
            投资组合
          </button>
          <button type="button" className="nav-item plain">
            推荐
          </button>
          <Link to="/staking" className="nav-item plain">
            质押
          </Link>
          <button type="button" className="nav-item plain">
            浏览器
          </button>

          <div className="nav-dd-wrap">
            <button
              type="button"
              className={`nav-item has-chevron ${openNav === "rewards" ? "open" : ""}`}
              onClick={() => setOpenNav((v) => (v === "rewards" ? null : "rewards"))}
            >
              奖励 <span className="chev">{openNav === "rewards" ? "▲" : "▼"}</span>
            </button>
            {openNav === "rewards" ? (
              <div className="dropdown dropdown-rewards">
                {REWARDS_MENU.map((row) => (
                  <button key={row.title} type="button" className="dd-row">
                    <span className="dd-icon">{row.icon}</span>
                    <span className="dd-text">
                      <span className="dd-title-line">
                        <span className="dd-title">{row.title}</span>
                        {row.badge ? <span className="dd-badge">{row.badge}</span> : null}
                      </span>
                      <span className="dd-sub">{row.sub}</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="nav-dd-wrap">
            <button
              type="button"
              className={`nav-item has-chevron ${openNav === "more" ? "open" : ""}`}
              onClick={() => setOpenNav((v) => (v === "more" ? null : "more"))}
            >
              更多 <span className="chev">{openNav === "more" ? "▲" : "▼"}</span>
            </button>
            {openNav === "more" ? (
              <div className="dropdown dropdown-more">
                <div className="more-head">
                  <span className="more-title">更多</span>
                  <button
                    type="button"
                    className="chain-pill"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenNav("chain");
                    }}
                  >
                    <img src={activeChain.icon} alt="" className="chain-pill-icon" />
                    <span className="chev sm">▼</span>
                  </button>
                </div>
                <div className="more-cols">
                  <div className="more-col">
                    <div className="more-col-title">产品</div>
                    {MORE_PRODUCTS.map((t) => (
                      <button key={t} type="button" className="more-item">
                        <span className="more-item-icon">◇</span>
                        {t}
                      </button>
                    ))}
                  </div>
                  <div className="more-col sep">
                    <div className="more-col-title">资源</div>
                    {MORE_RESOURCES.map((t) => (
                      <button key={t} type="button" className="more-item">
                        <span className="more-item-icon">◇</span>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </nav>

        <div className="header-actions">
          <div className="nav-dd-wrap chain-slot">
            <button
              type="button"
              className="icon-square chain-trigger"
              onClick={() => setOpenNav((v) => (v === "chain" ? null : "chain"))}
            >
              <img src={activeChain.icon} alt="" className="chain-trigger-img" />
              <span className="chev sm">▼</span>
            </button>
            {openNav === "chain" ? (
              <div className="dropdown dropdown-chain">
                {CHAIN_OPTIONS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="chain-row"
                    onClick={() => {
                      setSelectedUiChain(c.id);
                      setOpenNav(null);
                    }}
                  >
                    <img src={c.icon} alt="" className="chain-row-icon" />
                    <span className="chain-row-name">{c.name}</span>
                    {c.id === selectedUiChain ? <span className="chain-dot" /> : <span className="chain-dot empty" />}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {address ? (
            <button type="button" className="wallet-pill" data-connect-wallet="true" onClick={() => setShowWalletList((v) => !v)}>
              {shortAddr(address)}
            </button>
          ) : null}
          <button
            type="button"
            className="connect-btn"
            data-connect-wallet="true"
            onClick={() => {
              setShowWalletList((v) => !v);
              setOpenNav(null);
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

      <div className="symbol-strip" data-nav-chrome="true" onClick={stopNav}>
        <button type="button" className="pair-block">
          <img
            className="btc-ico"
            src="https://assets.coingecko.com/coins/images/1/small/bitcoin.png"
            alt=""
          />
          <span>BTCUSDT 合约</span>
          <span className="chev sm">▼</span>
        </button>
        <div className="stat-block price-main">
          <span className={`big-price ${pct24h >= 0 ? "up" : "down"}`}>{fmtPrice(price)}</span>
          <span className={`pct ${pct24h >= 0 ? "up" : "down"}`}>
            {pct24h >= 0 ? "+" : ""}
            {pct24h.toFixed(2)}%
          </span>
        </div>
        <div className="stat-block">
          <span className="stat-label">标记价格</span>
          <span className="stat-value">{fmtPrice(markPrice)}</span>
        </div>
        <div className="stat-block">
          <span className="stat-label">指数价格</span>
          <span className="stat-value">{fmtPrice(indexPrice)}</span>
        </div>
        <div className="stat-block fund-block">
          <span className="stat-label">资金费率/倒计时</span>
          <span className="stat-value">
            {funding.toFixed(4)}% / {formatCountdown(fundingCountdownMs)}
          </span>
        </div>
        <div className="stat-block vol-block">
          <span className="stat-label">24小时成交</span>
          <span className="stat-value">{fmtPrice(vol24h, 0)} USDT</span>
        </div>
      </div>

      <main className="layout">
        <section className="panel chart-panel">
          <div className="chart-tools chart-tools-row1">
            <div className="timeframe-row">
              {TIME_ITEMS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`time-btn ${item === chartTimeframe ? "active" : ""}`}
                  onClick={() => setChartTimeframe(item)}
                >
                  {item}
                </button>
              ))}
              <button type="button" className="time-chev" aria-label="周期">
                ▼
              </button>
            </div>
            <div className="chart-icon-group">
              <button type="button" className="chart-icon-btn active" title="蜡烛图">
                <span className="ico-candle" />
              </button>
              <button type="button" className="chart-icon-btn" title="指标">
                <span className="ico-ind" />
              </button>
              <button type="button" className="chart-icon-btn" title="设置">
                <span className="ico-gear" />
              </button>
            </div>
            <button type="button" className="chart-latest-price">
              最新价格 <span className="chev sm">▼</span>
            </button>
            <div className="chart-tabline chart-tabline-toolbar">
              <span className="active">图表</span>
              <span>深度</span>
              <span>详情</span>
              <button type="button" className="chart-fs-btn" aria-label="全屏">
                ⛶
              </button>
            </div>
          </div>
          <div className="chart-view" data-chart-interact="true">
            <div className="left-tools">
              <span className="lt" title="十字光标">╋</span>
              <span className="lt" title="趋势线">╱</span>
              <span className="lt" title="斐波那契">⌒</span>
              <span className="lt" title="画笔">✎</span>
              <span className="lt" title="文字">T</span>
              <span className="lt" title="图形">◇</span>
              <span className="lt" title="多空">⇅</span>
              <span className="lt" title="表情">☺</span>
              <span className="lt" title="测量">📐</span>
              <span className="lt" title="放大">＋</span>
              <span className="lt" title="磁铁">🧲</span>
              <span className="lt" title="隐藏">👁</span>
              <span className="lt" title="删除">🗑</span>
              <div className="left-tools-tv" title="TradingView">
                TV
              </div>
            </div>
            <TradingChart timeframe={chartTimeframe} lastPrice={price} className="chart-tv" />
          </div>
          <div className="chart-footer-strip">Aster 永续合约 Tick Size 调整公告 · Aster 星使计划</div>
        </section>

        <section className="panel orderbook-panel">
          <div className="panel-title orderbook-title">
            <span className="active">订单簿</span>
            <span>最新成交</span>
            <span className="ob-tools">⋯ 0.1 ▼</span>
          </div>
          <div className="book-head">
            <span>价格(USDT)</span>
            <span>数量(USDT)</span>
            <span>总额(USDT)</span>
          </div>
          <div className="book-list asks">
            {asks.map((row, idx) => (
              <div key={`ask-${idx}`} className="book-row ask">
                <div className="depth-bar ask" style={{ width: `${(row.amount / askMax) * 100}%` }} />
                <span>{fmtPrice(row.price)}</span>
                <span>{fmtPrice(row.amount, 2)}</span>
                <span>{fmtPrice(row.total, 2)}</span>
              </div>
            ))}
          </div>
          <div className={`mid-price ${priceUp ? "up" : "down"}`}>
            {fmtPrice(price)}
            <span className="mid-sub">{priceUp ? "▲" : "▼"} 标记 {fmtPrice(markPrice)}</span>
          </div>
          <div className="book-list bids">
            {bids.map((row, idx) => (
              <div key={`bid-${idx}`} className="book-row bid">
                <div className="depth-bar bid" style={{ width: `${(row.amount / bidMax) * 100}%` }} />
                <span>{fmtPrice(row.price)}</span>
                <span>{fmtPrice(row.amount, 2)}</span>
                <span>{fmtPrice(row.total, 2)}</span>
              </div>
            ))}
          </div>
        </section>

        <aside className="panel trade-panel">
          <div className="trade-panel-sticky-head">
            <div className="leverage-segment" role="group" aria-label="保证金模式">
              <span className="lev-item active">全仓</span>
              <span className="lev-item">20x</span>
              <span className="lev-item">M</span>
            </div>

            <div className="order-tabs-bar">
              <div className="order-tabs-row">
                <div className="order-tabs">
                <button
                  type="button"
                  className={orderTab === "market" ? "active" : ""}
                  onClick={() => {
                    setOrderTab("market");
                    setOrderTypeMenuOpen(false);
                  }}
                >
                  市价
                </button>
                <button
                  type="button"
                  className={orderTab === "limit" ? "active" : ""}
                  onClick={() => {
                    setOrderTab("limit");
                    setOrderTypeMenuOpen(false);
                  }}
                >
                  限价
                </button>
                <div className="order-tab-dd" data-dropdown-surface="true">
                  <button
                    type="button"
                    className={orderTab === "advanced" ? "active" : ""}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOrderTab("advanced");
                      setOrderTypeMenuOpen((o) => !o);
                    }}
                  >
                    {advancedOrderType}
                    <span className="order-tab-chev">{orderTypeMenuOpen ? "▲" : "▼"}</span>
                  </button>
                  {orderTypeMenuOpen ? (
                    <div className="dropdown dropdown-ordertype">
                      {ADVANCED_ORDER_TYPES.map((t) => (
                        <button
                          key={t}
                          type="button"
                          className={t === advancedOrderType ? "ot-item active" : "ot-item"}
                          onClick={(e) => {
                            e.stopPropagation();
                            setAdvancedOrderType(t);
                            setOrderTab("advanced");
                            setOrderTypeMenuOpen(false);
                          }}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              <button type="button" className="order-type-info" title="订单类型说明" aria-label="订单类型说明">
                <span className="order-type-info-i">i</span>
              </button>
            </div>
            </div>
          </div>

          <div className="field-row avail-row">
            <span>
              可用 <strong>{loadingBal && address ? "…" : usdtAvail}</strong> USDT
            </span>
            <button type="button" className="plus-gold" aria-label="充值">
              +
            </button>
          </div>

          <div className="input-with-suffix input-trigger-split">
            <input className="input inner" readOnly placeholder="触发价格" tabIndex={-1} />
            <button type="button" className="trigger-mark-dd">
              标记价格
              <span className="chev sm">▼</span>
            </button>
          </div>

          <div className="field-row tight">
            <label>价格</label>
            <span className="field-hint">BBO</span>
          </div>
          <div className="input-with-suffix">
            <input
              className="input inner"
              value={limitPriceInput}
              onChange={(e) => setLimitPriceInput(e.target.value)}
              placeholder={fmtPrice(price)}
            />
            <span className="suffix">USDT</span>
          </div>

          <div className="field-row tight">
            <label>数量</label>
            <span className="field-hint dd-hint">
              USDT <span className="chev sm">▼</span>
            </span>
          </div>
          <div className="input-with-suffix">
            <input
              className="input inner"
              inputMode="decimal"
              placeholder="输入存款数量"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
            />
            <span className="suffix muted-suffix">余额 {loadingBal ? "…" : selectedBalance}</span>
          </div>

          <div className="slider-wrap">
            <div className="slider-track">
              {[0, 25, 50, 75, 100].map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`slider-tick ${sliderPct === p ? "on" : ""}`}
                  onClick={() => setSliderPct(p)}
                />
              ))}
            </div>
            <div className="slider-labels">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
          </div>

          <div className="check-row">
            <label>
              <input type="checkbox" /> 止盈/止损
            </label>
            <div className="check-row-split">
              <label>
                <input type="checkbox" /> 只减仓
              </label>
              <button type="button" className="gtc-dd">
                GTC
                <span className="chev sm">▼</span>
              </button>
            </div>
          </div>

          <div className="field-row tight">
            <label>代币</label>
          </div>
          <select className="input full token-select" value={selectedToken} onChange={(e) => setSelectedToken(e.target.value)}>
            {tokenOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {selectedUiChain !== "bnb" ? <div className="chain-warn">当前展示公链为 {activeChain.name}，存款请在钱包内切换至 BNB Chain。</div> : null}

          {address && !onBsc ? (
            <button type="button" className="main-btn" onClick={() => void switchToBsc()}>
              切换到 BSC
            </button>
          ) : (
            <button
              type="button"
              className="main-btn"
              data-connect-wallet="true"
              onClick={() => {
                if (!address) {
                  setShowWalletList(true);
                  askConnectWallet();
                  return;
                }
                void submitDeposit();
              }}
              disabled={pendingDeposit}
            >
              {!address ? "连接钱包" : pendingDeposit ? "处理中..." : "存入资金池"}
            </button>
          )}

          {formError ? <div className="form-error">{formError}</div> : null}
          {lastTx ? (
            <div className="tx-ok">
              存款成功: <span className="mono">{shortAddr(lastTx)}</span>
            </div>
          ) : null}

          <div className="trade-panel-footer">
            <div className="footer-liq-row">
              <span className="footer-liq-label">预估强平价格</span>
              <span className="footer-liq-val">--</span>
            </div>
            <div className="footer-dual-cols">
              <div className="footer-side long">
                <div className="footer-metric">
                  <span className="sum-label">保证金</span>
                  <span className="sum-val">0.00</span>
                </div>
                <div className="footer-metric">
                  <span className="sum-label">可开</span>
                  <span className="sum-val">0.00 USDT</span>
                </div>
              </div>
              <div className="footer-side short">
                <div className="footer-metric">
                  <span className="sum-label">保证金</span>
                  <span className="sum-val">0.00</span>
                </div>
                <div className="footer-metric">
                  <span className="sum-label">可开</span>
                  <span className="sum-val">0.00 USDT</span>
                </div>
              </div>
            </div>
            <div className="footer-close-row">
              <span className="sum-label">可平</span>
              <span className="sum-val-muted">--</span>
            </div>
          </div>
        </aside>
      </main>

      <footer className="bottom-bar" data-nav-chrome="true" onClick={stopNav}>
        <span className="latency">● 已连接 128ms</span>
        <div className="ticker-marquee">
          <span>Aster Chain 质押功能现已正式上线 ✨</span>
          <span> · </span>
          <span>Aster 永续合约 Tick Size 调整公告</span>
        </div>
        <span className="footer-icons">🔔 ⛶ ⚙</span>
      </footer>
    </div>
  );
}
