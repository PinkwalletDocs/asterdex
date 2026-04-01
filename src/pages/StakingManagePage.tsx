import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import { estimateManageStakingApr, formatAprPct } from "../stakingApr";
import { StakingHeader } from "./StakingHeader";

function fmtBal(s: string | undefined, loading: boolean) {
  if (loading) return "…";
  if (s === undefined || s === "") return "--";
  const n = Number(s);
  if (Number.isNaN(n)) return s.length > 14 ? `${s.slice(0, 14)}…` : s;
  return n.toLocaleString("zh-CN", { maximumFractionDigits: 6 });
}

export function StakingManagePage() {
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
  const [stakeAmount, setStakeAmount] = useState("");
  const [poolErr, setPoolErr] = useState("");
  const [lastPoolTx, setLastPoolTx] = useState("");

  const aprInfo = useMemo(
    () => estimateManageStakingApr(address && onBsc ? balances.ASTER : "0"),
    [address, onBsc, balances.ASTER],
  );

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
    <div className="staking-app staking-manage-app">
      <StakingHeader />

      <main className="staking-main staking-manage-main">
        <section className="staking-my-panel staking-my-panel-only">
          <Link to="/staking" className="staking-back-text">
            ← 返回
          </Link>
          <h2 className="staking-my-title">我的质押</h2>
          <div className="staking-cycles staking-cycles-tight">
            <div>当前周期: 2026/03/30 - 2026/04/06 (UTC+0)</div>
            <div>下一个周期: 2026/04/06 - 2026/04/13 (UTC+0)</div>
          </div>

          <div className="staking-my-rows">
            <div className="staking-my-row">
              <div className="staking-my-label">ASTER</div>
              <div className="staking-my-value">{address && onBsc ? fmtBal(balances.ASTER, loadingBal) : "--"}</div>
              {!address ? (
                <button type="button" className="staking-connect-inline" onClick={() => openConnectModal()}>
                  连接钱包
                </button>
              ) : !onBsc ? (
                <button type="button" className="staking-connect-inline" onClick={() => void switchToBsc()}>
                  切换网络
                </button>
              ) : (
                <button
                  type="button"
                  className="staking-claim-btn"
                  disabled={pendingPoolTx}
                  onClick={() => void onSweep()}
                >
                  {pendingPoolTx ? "处理中…" : "领取"}
                </button>
              )}
            </div>
          </div>

          <div className="staking-apr-manage staking-apy-block staking-apy-block-manage">
            <div className="staking-apy-title-row">
              <span>质押收益（APR）</span>
              <span className="staking-apr-total-pill">
                {address && onBsc && loadingBal ? "…" : formatAprPct(aprInfo.totalApr)}
              </span>
            </div>
            <div className="staking-apy-row">
              <span>基础 APR</span>
              <span>{formatAprPct(aprInfo.baseApr)}</span>
            </div>
            <div className="staking-apy-row">
              <span>忠诚加成</span>
              <span className="staking-apr-pos">+{aprInfo.loyaltyApr.toFixed(2)}%</span>
            </div>
            <div className="staking-apy-row">
              <span>验证者佣金折算</span>
              <span className="staking-apr-neg">{formatAprPct(aprInfo.feeAdjApr)}</span>
            </div>
            <div className="staking-apy-row">
              <span>预估年收益（ASTER）</span>
              <span>
                {address && onBsc && !loadingBal && aprInfo.estYearlyAster != null
                  ? aprInfo.estYearlyAster.toLocaleString("zh-CN", { maximumFractionDigits: 4 })
                  : "--"}
              </span>
            </div>
          </div>

          <div className="staking-pool-section" style={{ marginTop: 20 }}>
            {address && onBsc ? (
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
                    赎回
                  </button>
                </div>
              </>
            ) : null}
            {poolErr ? <div className="staking-form-err">{poolErr}</div> : null}
            {lastPoolTx ? (
              <div className="staking-tx-hash mono" title={lastPoolTx}>
                {lastPoolTx}
              </div>
            ) : null}
          </div>
        </section>
      </main>

      <footer className="bottom-bar staking-bottom-bar">
        <span className="latency">● 已连接 128ms</span>
        <div className="ticker-marquee">
          <span>Aster 质押 · 我的质押</span>
        </div>
        <span className="footer-icons">🔔 ⛶ ⚙</span>
      </footer>
    </div>
  );
}
