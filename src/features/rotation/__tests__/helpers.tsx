import type { ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { FarmWiseProvider, SAMPLE_FARM, useFarmWise } from "@fw/core";
import { ToastProvider } from "@fw/ui";
import type { FarmWiseState } from "@fw/contracts";
import { RotationPage } from "../RotationPage";

/** Exposes central-store values and actions so tests can simulate other owners' edits (R08). */
export function StoreProbe() {
  const { state, actions } = useFarmWise();
  return (
    <div>
      <output data-testid="probe-active">{state.activePlanId}</output>
      <button type="button" onClick={() => actions.setSoilPreset("dry")}>probe: soil dry</button>
      <button type="button" onClick={() => actions.setSoilPreset("wet")}>probe: soil wet</button>
      <button type="button" onClick={() => actions.updateFarm({ irrigation: "rainfed" })}>probe: rainfed</button>
      <button type="button" onClick={() => actions.updateFarm({ irrigation: "regular" })}>probe: regular</button>
      <button type="button" onClick={() => actions.updateFarm({ budget: 40000 })}>probe: budget 40k</button>
    </div>
  );
}

export function renderRotation(initialState: Partial<FarmWiseState> = {}, extra?: ReactNode) {
  const user = userEvent.setup();
  const utils = render(
    <FarmWiseProvider initialState={{ farm: SAMPLE_FARM, ...initialState }}>
      <ToastProvider>
        <MemoryRouter initialEntries={["/rotation"]}>
          <Routes>
            <Route path="/rotation" element={<RotationPage />} />
            <Route path="/scenarios" element={<h1>Scenario Studio route</h1>} />
            <Route path="/onboarding" element={<h1>Onboarding route</h1>} />
          </Routes>
          <StoreProbe />
          {extra}
        </MemoryRouter>
      </ToastProvider>
    </FarmWiseProvider>,
  );
  return { user, ...utils };
}

export const card = (id: string) => screen.getByTestId(`plan-card-${id}`);
export const radioFor = (id: string) => within(card(id)).getByRole("radio");
export async function waitForPlans() {
  await screen.findByTestId("plan-card-current");
  // climate settles (resolved or failed) so state no longer changes under the test
  await waitFor(() => expect(screen.queryByLabelText("Loading climate evidence")).toBeNull());
}
