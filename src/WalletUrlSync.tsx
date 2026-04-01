import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useWallet } from "./context/WalletContext";

/** Opens the global wallet modal when URL has `?wallet=1` (e.g. from staking pages). */
export function WalletUrlSync() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { setShowWalletList } = useWallet();

  useEffect(() => {
    if (searchParams.get("wallet") === "1") {
      setShowWalletList(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, setShowWalletList]);

  return null;
}
