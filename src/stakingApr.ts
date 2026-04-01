/** 管理页质押收益（APR）估算：按持仓档位与忠诚加成推算，非链上真实利率。 */

export type ManageAprBreakdown = {
  baseApr: number;
  loyaltyApr: number;
  feeAdjApr: number;
  totalApr: number;
  estYearlyAster: number | null;
};

function parseAsterHuman(s: string | undefined): number {
  if (!s) return 0;
  const n = Number(String(s).replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function baseAprFromStake(aster: number): number {
  if (aster <= 0) return 6.18;
  if (aster < 500) return 6.28;
  if (aster < 5_000) return 6.45;
  if (aster < 50_000) return 6.72;
  if (aster < 500_000) return 6.95;
  return 7.12;
}

function loyaltyAprFromStake(aster: number): number {
  if (aster <= 0) return 0.32;
  return Math.min(2.28, 0.38 + (aster / 95_000) * 1.85);
}

/** 混合验证者佣金与协议费折算为年化扣减，约 −0.35%～−0.55% */
function feeAdjustmentApr(aster: number): number {
  const spread = aster >= 100_000 ? -0.35 : -0.48;
  return spread;
}

export function estimateManageStakingApr(asterBalanceRaw: string | undefined): ManageAprBreakdown {
  const aster = parseAsterHuman(asterBalanceRaw);
  const baseApr = baseAprFromStake(aster);
  const loyaltyApr = loyaltyAprFromStake(aster);
  const feeAdjApr = feeAdjustmentApr(aster);
  const totalApr = Math.max(0, baseApr + loyaltyApr + feeAdjApr);
  const estYearlyAster = aster > 0 ? (aster * totalApr) / 100 : null;
  return { baseApr, loyaltyApr, feeAdjApr, totalApr, estYearlyAster };
}

export function formatAprPct(n: number): string {
  return `${n.toFixed(2)}%`;
}
