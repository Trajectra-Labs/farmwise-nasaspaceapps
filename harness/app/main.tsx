// HARNESS app shell (stand-in for Shaheem's AppShell) — mounts ONLY Moen's public exports so the
// workstream runs in isolation. The "Harness controls" panel imitates edits that other owners'
// screens (My Farm, Soil & Sensors) make to the central store, so R08 propagation can be tested.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { FarmWiseProvider, useFarmWise, SAMPLE_FARM } from "@fw/core";
import { Select, ToastProvider, Button } from "@fw/ui";
import "../styles/tokens.css";
import "./shell.css";
import { RotationPage } from "../../src/features/rotation";
import { ScenarioPage } from "../../src/features/scenarios";

function HarnessControls() {
  const { state, actions } = useFarmWise();
  const farm = state.farm;
  return (
    <aside className="hx-controls" aria-label="Harness controls (stand-in for other owners' screens)">
      <p className="hx-controls__title">Harness controls</p>
      <Select label="Soil preset (simulated)" value={state.soilPreset} onChange={actions.setSoilPreset}
        options={[{ value: "dry", label: "Dry" }, { value: "normal", label: "Normal" }, { value: "wet", label: "Wet" }]} />
      <Select label="Irrigation" value={farm?.irrigation ?? "rainfed"} disabled={!farm} onChange={(v) => actions.updateFarm({ irrigation: v })}
        options={[{ value: "rainfed", label: "Rainfed" }, { value: "limited", label: "Limited" }, { value: "regular", label: "Regular" }]} />
      <Select label="Budget (KES)" value={String(farm?.budget ?? "none")} disabled={!farm}
        onChange={(v) => actions.updateFarm({ budget: v === "none" ? null : Number(v) })}
        options={[{ value: "none", label: "Not given" }, { value: "40000", label: "40,000" }, { value: "120000", label: "120,000" }, { value: "300000", label: "300,000" }]} />
      <Select label="Theme" value={state.theme} onChange={actions.setTheme} options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
      <div className="hx-controls__row">
        <Button size="sm" onClick={() => actions.setFarm(null)}>No farm</Button>
        <Button size="sm" onClick={() => actions.setFarm(SAMPLE_FARM)}>Sample farm</Button>
      </div>
    </aside>
  );
}

function Shell() {
  return (
    <div className="hx-shell">
      <a href="#main" className="hx-skip">Skip to content</a>
      <header className="hx-top">
        <span className="hx-brand">FarmWise <small>· Moen workstream harness</small></span>
        <nav aria-label="Primary">
          <NavLink to="/rotation">Rotation Planner</NavLink>
          <NavLink to="/scenarios">Scenario Studio</NavLink>
        </nav>
      </header>
      <div className="hx-body">
        <main id="main" className="hx-main">
          <Routes>
            <Route path="/" element={<Navigate to="/rotation" replace />} />
            <Route path="/rotation" element={<RotationPage />} />
            <Route path="/scenarios" element={<ScenarioPage />} />
            <Route path="*" element={<p className="fw-muted">This route belongs to another owner and is not mounted in the Moen harness.</p>} />
          </Routes>
        </main>
        <HarnessControls />
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FarmWiseProvider>
      <ToastProvider>
        <BrowserRouter><Shell /></BrowserRouter>
      </ToastProvider>
    </FarmWiseProvider>
  </StrictMode>,
);
