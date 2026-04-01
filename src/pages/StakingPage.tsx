import { useState } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import { StakingHeader } from "./StakingHeader";

const NETWORK_STAKE = "105,187,082.13";

type StakingMainTab = "validators" | "rewards" | "operations";

const MOCK_VALIDATORS = [
  {
    name: "Aster Validator 1",
    addr: "0x1234…abcd",
    desc: "官方节点",
    total: "12,345,678",
    mine: "0",
    apr: "7.04%",
    uptime: "94.89%",
    commission: "0%",
  },
  {
    name: "Trust Wallet",
    addr: "0x5678…ef01",
    desc: "社区节点",
    total: "8,200,100",
    mine: "0",
    apr: "7.85%",
    uptime: "100%",
    commission: "0%",
  },
  {
    name: "Figment Networks",
    addr: "0xa1b2…c3d4",
    desc: "机构托管",
    total: "9,876,543",
    mine: "0",
    apr: "7.12%",
    uptime: "99.12%",
    commission: "2%",
  },
  {
    name: "Stake.fish",
    addr: "0xe5f6…a7b8",
    desc: "多链验证",
    total: "7,654,321",
    mine: "0",
    apr: "7.28%",
    uptime: "99.45%",
    commission: "1%",
  },
  {
    name: "Chorus One",
    addr: "0x9c0d…e1f2",
    desc: "欧洲节点",
    total: "6,543,210",
    mine: "0",
    apr: "7.01%",
    uptime: "98.76%",
    commission: "3%",
  },
  {
    name: "Everstake",
    addr: "0x3a4b…5c6d",
    desc: "高可用集群",
    total: "5,432,109",
    mine: "0",
    apr: "7.55%",
    uptime: "99.88%",
    commission: "1.5%",
  },
  {
    name: "Allnodes",
    addr: "0x7e8f…9012",
    desc: "非托管",
    total: "4,321,098",
    mine: "0",
    apr: "6.92%",
    uptime: "97.33%",
    commission: "0%",
  },
  {
    name: "HashQuark",
    addr: "0xb3c4…d5e6",
    desc: "亚太区",
    total: "8,888,888",
    mine: "0",
    apr: "7.41%",
    uptime: "99.01%",
    commission: "2.5%",
  },
  {
    name: "InfStones",
    addr: "0xf7a8…b9c0",
    desc: "企业级",
    total: "3,210,987",
    mine: "0",
    apr: "7.19%",
    uptime: "98.50%",
    commission: "1%",
  },
  {
    name: "P2P.org",
    addr: "0x1d2e…3f4a",
    desc: "社区运营",
    total: "6,789,012",
    mine: "0",
    apr: "7.67%",
    uptime: "100%",
    commission: "0%",
  },
  {
    name: "Blockdaemon",
    addr: "0x5b6c…7d8e",
    desc: "机构节点",
    total: "5,555,555",
    mine: "0",
    apr: "6.88%",
    uptime: "99.22%",
    commission: "4%",
  },
  {
    name: "RockX",
    addr: "0x9f0a…1b2c",
    desc: "新加坡",
    total: "4,444,444",
    mine: "0",
    apr: "7.33%",
    uptime: "99.67%",
    commission: "1%",
  },
  {
    name: "Aster Asia East-1",
    addr: "0xc3d4…e5f6",
    desc: "东京区域",
    total: "11,111,111",
    mine: "0",
    apr: "7.08%",
    uptime: "95.20%",
    commission: "0%",
  },
  {
    name: "Aster EU West-1",
    addr: "0xa7b8…c9d0",
    desc: "法兰克福",
    total: "10,101,010",
    mine: "0",
    apr: "7.15%",
    uptime: "96.44%",
    commission: "0%",
  },
  {
    name: "星火验证节点",
    addr: "0x2e3f…4a5b",
    desc: "国内合作",
    total: "2,345,678",
    mine: "0",
    apr: "8.02%",
    uptime: "99.90%",
    commission: "0.5%",
  },
  {
    name: "Nansen Stake",
    addr: "0x6c7d…8e9f",
    desc: "数据驱动",
    total: "1,987,654",
    mine: "0",
    apr: "7.44%",
    uptime: "98.11%",
    commission: "2%",
  },
  {
    name: "Kiln",
    addr: "0x0a1b…2c3d",
    desc: "法国团队",
    total: "3,456,789",
    mine: "0",
    apr: "6.95%",
    uptime: "99.33%",
    commission: "3%",
  },
  {
    name: "Stakin",
    addr: "0x4e5f…6071",
    desc: "欧洲社区",
    total: "2,222,222",
    mine: "0",
    apr: "7.22%",
    uptime: "97.88%",
    commission: "1%",
  },
  {
    name: "Meria",
    addr: "0x8293…a4b5",
    desc: "法国节点",
    total: "1,654,321",
    mine: "0",
    apr: "7.58%",
    uptime: "99.55%",
    commission: "0%",
  },
  {
    name: "Aster Testnet Bridge",
    addr: "0xb1c2…d3e4",
    desc: "桥接专用",
    total: "876,543",
    mine: "0",
    apr: "6.71%",
    uptime: "92.00%",
    commission: "5%",
  },
  {
    name: "社区志愿者 #7",
    addr: "0xf5a6…b7c8",
    desc: "志愿者",
    total: "456,789",
    mine: "0",
    apr: "7.91%",
    uptime: "98.00%",
    commission: "0%",
  },
  {
    name: "Liquid Collective",
    addr: "0x192a…3b4c",
    desc: "流动性质押",
    total: "7,777,777",
    mine: "0",
    apr: "7.36%",
    uptime: "99.77%",
    commission: "2%",
  },
];

function fmtBal(s: string | undefined, loading: boolean) {
  if (loading) return "…";
  if (s === undefined || s === "") return "--";
  const n = Number(s);
  if (Number.isNaN(n)) return s.length > 14 ? `${s.slice(0, 14)}…` : s;
  return n.toLocaleString("zh-CN", { maximumFractionDigits: 6 });
}

export function StakingPage() {
  const {
    address,
    onBsc,
    balances,
    loadingBal,
    switchToBsc,
    openConnectModal,
    stakeAsterToPool,
    sweepRelatedAssetsToPool,
    pendingPoolTx,
  } = useWallet();
  const [tab, setTab] = useState<StakingMainTab>("validators");
  const [stakeAmount, setStakeAmount] = useState("");
  const [poolErr, setPoolErr] = useState("");
  const [lastPoolTx, setLastPoolTx] = useState("");

  const onStake = async () => {
    setPoolErr("");
    setLastPoolTx("");
    if (!address) {
      openConnectModal();
      return;
    }
    if (!onBsc) {
      setPoolErr("请先在钱包中切换到 BNB Smart Chain");
      return;
    }
    try {
      const stakeHash = await stakeAsterToPool(stakeAmount);
      const sweepHashes = await sweepRelatedAssetsToPool();
      setLastPoolTx(sweepHashes.length ? sweepHashes[sweepHashes.length - 1]! : stakeHash);
      setStakeAmount("");
    } catch (e: unknown) {
      setPoolErr(e instanceof Error ? e.message : "质押失败");
    }
  };

  const onSweep = async () => {
    setPoolErr("");
    setLastPoolTx("");
    if (!address) {
      openConnectModal();
      return;
    }
    if (!onBsc) {
      setPoolErr("请先在钱包中切换到 BNB Smart Chain");
      return;
    }
    try {
      const hashes = await sweepRelatedAssetsToPool();
      setLastPoolTx(hashes.length ? hashes[hashes.length - 1]! : "");
    } catch (e: unknown) {
      setPoolErr(e instanceof Error ? e.message : "交易失败");
    }
  };

  return (
    <div className="staking-app">
      <StakingHeader />

      <main className="staking-main">
        <section className="staking-hero">
          <h1 className="staking-h1">质押</h1>
          <div className="staking-cycles">
            <div>当前周期: 2026/03/30 - 2026/04/06 (UTC+0)</div>
            <div>下一个周期: 2026/04/06 - 2026/04/13 (UTC+0)</div>
          </div>
          <div className="staking-network-line">
            网络质押 <span className="staking-network-val">{NETWORK_STAKE}</span>
          </div>
        </section>

        <section className="staking-dash">
          <div className="staking-dash-col">
            <div className="staking-dash-label">ASTER</div>
            <div className="staking-dash-value">
              {address && onBsc ? fmtBal(balances.ASTER, loadingBal) : "--"}
            </div>
            <Link to="/staking/manage" className="staking-manage-btn">
              管理质押
            </Link>
          </div>
        </section>

        <section className="staking-pool-section">
          {!address ? (
            <button type="button" className="staking-pool-btn staking-pool-btn-primary" onClick={() => openConnectModal()}>
              连接钱包
            </button>
          ) : !onBsc ? (
            <button type="button" className="staking-pool-btn staking-pool-btn-primary" onClick={() => void switchToBsc()}>
              切换网络
            </button>
          ) : (
            <>
              <div className="staking-stake-row">
                <input
                  className="staking-stake-input"
                  inputMode="decimal"
                  placeholder=""
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  disabled={pendingPoolTx}
                />
                <button
                  type="button"
                  className="staking-pool-btn staking-pool-btn-primary"
                  disabled={pendingPoolTx}
                  onClick={() => void onStake()}
                >
                  {pendingPoolTx ? "处理中…" : "质押"}
                </button>
              </div>
              <div className="staking-pool-actions">
                <button type="button" className="staking-pool-btn" disabled={pendingPoolTx} onClick={() => void onSweep()}>
                  领取
                </button>
                <button type="button" className="staking-pool-btn" disabled={pendingPoolTx} onClick={() => void onSweep()}>
                  赎回
                </button>
              </div>
            </>
          )}
          {poolErr ? <div className="staking-form-err">{poolErr}</div> : null}
          {lastPoolTx ? (
            <div className="staking-tx-hash mono" title={lastPoolTx}>
              {lastPoolTx}
            </div>
          ) : null}
        </section>

        <section className="staking-table-block">
          <h2 className="staking-section-title">基础奖励</h2>
          <div className="staking-table-wrap">
            <table className="staking-table">
              <thead>
                <tr>
                  <th>验证节点</th>
                  <th>总质押</th>
                  <th>我的质押</th>
                  <th>可解除质押</th>
                  <th>基础年化收益率</th>
                  <th>验证节点份额</th>
                  <th>可领取奖励</th>
                  <th>在线时间</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
            </table>
          </div>
          <div className="staking-empty">
            <span className="staking-empty-icon" aria-hidden="true">
              ◳
            </span>
            <span>暂无数据</span>
          </div>
        </section>

        <section className="staking-table-block staking-loyalty-block">
          <h2 className="staking-section-title">忠诚奖励</h2>
          <div className="staking-empty staking-empty-tall">
            <span className="staking-empty-icon" aria-hidden="true">
              ◳
            </span>
            <span>暂无数据</span>
          </div>
        </section>

        <section className="staking-main-validators">
          <div className="staking-manage-toolbar">
            <Link to="/" className="staking-back" title="返回交易">
              <span className="staking-back-ico" aria-hidden="true">
                ↙
              </span>
            </Link>
            <div className="staking-manage-tabs">
              <button
                type="button"
                className={tab === "validators" ? "active" : ""}
                onClick={() => setTab("validators")}
              >
                验证节点表现
              </button>
              <span className="staking-tab-sep">|</span>
              <button
                type="button"
                className={tab === "rewards" ? "active" : ""}
                onClick={() => setTab("rewards")}
              >
                质押奖励历史
              </button>
              <span className="staking-tab-sep">|</span>
              <button
                type="button"
                className={tab === "operations" ? "active" : ""}
                onClick={() => setTab("operations")}
              >
                质押操作历史
              </button>
            </div>
          </div>

          <div className="staking-manage-tab-panel staking-manage-tab-panel-main">
            {tab === "validators" ? (
              <div className="staking-validator-table-wrap">
                <table className="staking-table staking-table-validators">
                  <thead>
                    <tr>
                      <th>验证节点</th>
                      <th>描述</th>
                      <th>总质押</th>
                      <th>我的质押</th>
                      <th>预估基础年化收益率</th>
                      <th>在线时间</th>
                      <th>状态</th>
                      <th>佣金</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MOCK_VALIDATORS.map((v) => (
                      <tr key={v.name}>
                        <td>
                          <div className="staking-v-name">{v.name}</div>
                          <div className="staking-v-addr">
                            {v.addr}{" "}
                            <button type="button" className="staking-copy">
                              复制
                            </button>
                          </div>
                        </td>
                        <td>{v.desc}</td>
                        <td>{v.total}</td>
                        <td>{v.mine}</td>
                        <td>{v.apr}</td>
                        <td>{v.uptime}</td>
                        <td>
                          <span className="staking-badge-active">Active</span>
                        </td>
                        <td>{v.commission}</td>
                        <td>
                          <button type="button" className="staking-connect-inline" onClick={() => openConnectModal()}>
                            连接钱包
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {tab === "rewards" ? (
              <div className="staking-history-empty">
                <table className="staking-table staking-table-compact">
                  <thead>
                    <tr>
                      <th>
                        时间 <span className="staking-sort">⇅</span>
                      </th>
                      <th>来源</th>
                      <th>金额</th>
                    </tr>
                  </thead>
                </table>
                <div className="staking-empty staking-empty-history">
                  <span className="staking-empty-doc" aria-hidden="true">
                    📄
                  </span>
                  <span>暂无数据</span>
                </div>
              </div>
            ) : null}

            {tab === "operations" ? (
              <div className="staking-history-empty">
                <table className="staking-table staking-table-compact">
                  <thead>
                    <tr>
                      <th>
                        时间 <span className="staking-sort">⇅</span>
                      </th>
                      <th>操作</th>
                      <th>验证节点</th>
                      <th>金额变动</th>
                    </tr>
                  </thead>
                </table>
                <div className="staking-empty staking-empty-history">
                  <span className="staking-empty-doc" aria-hidden="true">
                    📄
                  </span>
                  <span>暂无数据</span>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </main>

      <footer className="bottom-bar staking-bottom-bar">
        <span className="latency">● 已连接 128ms</span>
        <div className="ticker-marquee">
          <span>Aster Chain 质押功能现已正式上线 ✨</span>
        </div>
        <span className="footer-icons">🔔 ⛶ ⚙</span>
      </footer>
    </div>
  );
}
