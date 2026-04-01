import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { WalletProvider } from "./context/WalletContext";
import TradingTerminal from "./TradingTerminal";
import { WalletUrlSync } from "./WalletUrlSync";
import { StakingManagePage } from "./pages/StakingManagePage";
import { StakingPage } from "./pages/StakingPage";

export default function App() {
  const base = import.meta.env.BASE_URL;
  const basename = base === "/" ? undefined : base.replace(/\/$/, "");

  return (
    <BrowserRouter basename={basename}>
      <WalletProvider>
        <WalletUrlSync />
        <Routes>
          <Route path="/" element={<TradingTerminal />} />
          <Route path="/staking" element={<StakingPage />} />
          <Route path="/staking/manage" element={<StakingManagePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </WalletProvider>
    </BrowserRouter>
  );
}
