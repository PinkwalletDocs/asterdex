export type Eip1193Like = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

export type WalletInfo = {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
};

export type AnnouncedWallet = {
  info: WalletInfo;
  provider: Eip1193Like;
};

const ANNOUNCE = "eip6963:announceProvider";
const REQUEST = "eip6963:requestProvider";

export function subscribeWallets(
  onAnnounce: (w: AnnouncedWallet) => void,
): () => void {
  const seen = new Set<string>();

  const handler = (ev: Event) => {
    const ce = ev as CustomEvent<{ info: WalletInfo; provider: Eip1193Like }>;
    const d = ce.detail;
    if (!d?.info?.uuid || !d.provider) return;
    if (seen.has(d.info.uuid)) return;
    seen.add(d.info.uuid);
    onAnnounce({ info: d.info, provider: d.provider });
  };

  window.addEventListener(ANNOUNCE, handler as EventListener);
  window.dispatchEvent(new Event(REQUEST));

  return () => window.removeEventListener(ANNOUNCE, handler as EventListener);
}
