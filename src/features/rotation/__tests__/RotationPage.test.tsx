import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_FARM } from "@fw/core";
import { card, radioFor, renderRotation, waitForPlans } from "./helpers";

afterEach(() => { vi.restoreAllMocks(); });

const PLAN_IDS = ["current", "minimum", "resilience"] as const;
const INFEASIBLE_ROTATION = [
  { season: "Long rains", cropId: "rice", yearOffset: 0 },
  { season: "Short rains", cropId: "maize", yearOffset: 0 },
];

describe("Rotation Planner", () => {
  it("R01: renders three plans with crop-by-season sequences", async () => {
    renderRotation();
    await waitForPlans();
    for (const id of PLAN_IDS) {
      const c = card(id);
      const seq = within(c).getByRole("list", { name: /crop sequence/i });
      const items = within(seq).getAllByRole("listitem");
      expect(items.length).toBe(SAMPLE_FARM.rotation.length);
      expect(items[0]).toHaveTextContent(/Year 1 · Long rains/);
    }
    // the three sequences are not all identical
    const texts = PLAN_IDS.map((id) => within(card(id)).getByRole("list", { name: /crop sequence/i }).textContent);
    expect(new Set(texts).size).toBeGreaterThan(1);
  });

  it("R02: selecting a plan updates highlight, store and details; arrow keys move selection", async () => {
    const { user } = renderRotation();
    await waitForPlans();
    expect(screen.getByRole("radiogroup", { name: /choose a rotation plan/i })).toBeInTheDocument();
    await user.click(radioFor("minimum"));
    expect(radioFor("minimum")).toHaveAttribute("aria-checked", "true");
    expect(card("minimum")).toHaveClass("fw-card--selected");
    expect(card("current")).not.toHaveClass("fw-card--selected");
    expect(screen.getByTestId("probe-active")).toHaveTextContent("minimum");
    const details = screen.getByTestId("plan-details");
    expect(within(details).getByRole("heading", { level: 2 })).toHaveTextContent(/Details:/);
    expect(within(details).getByRole("heading", { name: /feasibility checks/i })).toBeInTheDocument();
    expect(within(details).getByRole("table")).toBeInTheDocument();
    const minimumTitle = within(card("minimum")).getByRole("heading", { level: 3 }).textContent ?? "";
    expect(details).toHaveTextContent(minimumTitle);

    radioFor("minimum").focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByTestId("probe-active")).toHaveTextContent("resilience");
    expect(radioFor("resilience")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByTestId("probe-active")).toHaveTextContent("current");
  });

  it("R03: Compare all opens an accessible shared dialog with all plans and closes via button and Escape", async () => {
    const { user } = renderRotation();
    await waitForPlans();
    const trigger = screen.getByRole("button", { name: "Compare all" });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: /compare all plans/i });
    expect(dialog).toHaveClass("fw-dialog--xl");
    const table = within(dialog).getByRole("table");
    expect(within(table).getAllByRole("columnheader")).toHaveLength(4);
    for (const label of ["Crop sequence", "Feasible", "Change size", "Score", "Confidence", "Recommended", "Budget fit (per season)"]) {
      expect(within(table).getByRole("rowheader", { name: label })).toBeInTheDocument();
    }
    expect(within(table).getByRole("rowheader", { name: /Input cost range \(KES\)/ })).toBeInTheDocument();
    expect(within(table).getByRole("rowheader", { name: "Water need (rotation total)" })).toBeInTheDocument();
    expect(within(table).getAllByText("(changed)", { exact: false }).length).toBeGreaterThan(0);
    await user.click(within(dialog).getAllByRole("button", { name: "Close" })[0]);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("R04 + R09: Why this plan? drawer cites evidence, rule sources, risks, unknowns and separates score from confidence", async () => {
    const { user } = renderRotation();
    await waitForPlans();
    const trigger = within(card("resilience")).getByRole("button", { name: /why this plan/i });
    await user.click(trigger);
    const drawer = screen.getByRole("dialog", { name: /why this plan/i });
    expect(drawer).toHaveClass("fw-drawer");
    for (const h of [/reasons/i, /^risks$/i, /unknowns/i, /all evidence used/i, /score versus confidence/i]) {
      expect(within(drawer).getByRole("heading", { name: h })).toBeInTheDocument();
    }
    // linked evidence with provenance badge and descriptive external link
    const evidenceLinks = within(drawer).getAllByRole("link");
    expect(evidenceLinks.length).toBeGreaterThan(0);
    expect(evidenceLinks[0]).toHaveAttribute("target", "_blank");
    expect(evidenceLinks[0].textContent).toMatch(/external site/i);
    expect(drawer.querySelector("[data-source]")).not.toBeNull();
    expect(within(drawer).getByText(/Confidence/, { selector: "strong" })).toBeInTheDocument();
    expect(within(drawer).getByText(/not a certified soil test/i)).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("R09: score and confidence are labelled separately on each card", async () => {
    renderRotation();
    await waitForPlans();
    for (const id of PLAN_IDS) {
      const c = card(id);
      expect(within(c).getByText("Score")).toBeInTheDocument();
      expect(within(c).getByText("Confidence")).toBeInTheDocument();
      expect(within(c).getByTestId(`confidence-${id}`).textContent).toMatch(/^(Low|Medium|High) confidence$/);
      expect(within(c).getByTestId(`score-${id}`).textContent).toMatch(/\/ 100$|Not scored/);
    }
  });

  it("R05: an infeasible current rotation is not scored and never carries the Recommended badge", async () => {
    // "rice" is not in the regional crop manifest, so the current rotation fails a blocking check.
    renderRotation({ soilPreset: "wet", farm: { ...SAMPLE_FARM, irrigation: "regular", budget: null, rotation: INFEASIBLE_ROTATION } });
    await waitForPlans();
    expect(within(card("current")).getByText("Not feasible")).toBeInTheDocument();
    expect(within(card("current")).queryByTestId("recommended-badge")).toBeNull();
    expect(screen.getByTestId("score-current")).toHaveTextContent("Not scored — infeasible");
    const badges = screen.getAllByTestId("recommended-badge");
    expect(badges).toHaveLength(1);
    const recCard = badges[0].closest("[data-plan-id]")!;
    expect(within(recCard as HTMLElement).getByText("Feasible")).toBeInTheDocument();
  });

  it("R05: when every plan is infeasible nothing is recommended", async () => {
    renderRotation({ soilPreset: "dry", farm: { ...SAMPLE_FARM, irrigation: "rainfed", budget: 40000 } });
    await waitForPlans();
    expect(screen.queryAllByTestId("recommended-badge")).toHaveLength(0);
    expect(screen.getByText(/No plan is recommended/)).toBeInTheDocument();
    for (const id of PLAN_IDS) expect(screen.getByTestId(`score-${id}`)).toHaveTextContent("Not scored — infeasible");
  });

  it("R06: Use in scenarios keeps the selected plan id and navigates to /scenarios", async () => {
    const { user } = renderRotation();
    await waitForPlans();
    // pick a feasible non-current plan
    const target = PLAN_IDS.find((id) => id !== "current" && !within(card(id)).queryByText("Not feasible")) ?? "current";
    await user.click(radioFor(target));
    await user.click(within(screen.getByTestId("plan-details")).getByRole("button", { name: "Use in scenarios" }));
    expect(await screen.findByRole("heading", { name: "Scenario Studio route" })).toBeInTheDocument();
    expect(screen.getByTestId("probe-active")).toHaveTextContent(target);
    expect(await screen.findByText(/in Scenario Studio\./)).toBeInTheDocument();
  });

  it("R07: Keep my current rotation selects the current plan and confirms", async () => {
    const { user } = renderRotation({ activePlanId: "resilience" });
    await waitForPlans();
    expect(radioFor("resilience")).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("button", { name: "Keep my current rotation" }));
    expect(radioFor("current")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("probe-active")).toHaveTextContent("current");
    expect(await screen.findByText(/Keeping your current rotation/)).toBeInTheDocument();
  });

  it("R08: soil preset and irrigation changes in the shared store recalculate the cards", async () => {
    const { user } = renderRotation();
    await waitForPlans();
    const snapshot = () => PLAN_IDS.map((id) => `${screen.getByTestId(`score-${id}`).textContent}|${screen.getByTestId(`confidence-${id}`).textContent}|${screen.getByTestId(`water-${id}`).textContent}`).join(";")
      + screen.getByTestId("prov-soil").textContent + screen.getByTestId("prov-farmer").textContent;
    const before = snapshot();
    await user.click(screen.getByRole("button", { name: "probe: soil dry" }));
    expect(screen.getByTestId("prov-soil")).toHaveTextContent(/11% moisture/);
    const afterSoil = snapshot();
    expect(afterSoil).not.toBe(before);
    const scoresBefore = PLAN_IDS.map((id) => screen.getByTestId(`score-${id}`).textContent).join();
    await user.click(screen.getByRole("button", { name: "probe: rainfed" }));
    expect(screen.getByTestId("prov-farmer")).toHaveTextContent(/Rainfed/);
    const scoresAfter = PLAN_IDS.map((id) => screen.getByTestId(`score-${id}`).textContent).join();
    expect(scoresAfter).not.toBe(scoresBefore);
  });

  it("R10: costs are KES ranges in whole thousands, with no profit promises", async () => {
    const { container } = renderRotation();
    await waitForPlans();
    const text = container.textContent ?? "";
    const costs = text.match(/KES [\d,]+ – [\d,]+/g) ?? [];
    expect(costs.length).toBeGreaterThanOrEqual(3);
    for (const c of costs) {
      for (const n of c.replace("KES ", "").split(" – ")) {
        const v = Number(n.replace(/,/g, ""));
        expect(Number.isInteger(v)).toBe(true);
        expect(v % 1000).toBe(0);
        expect(v).toBeGreaterThan(0);
      }
    }
    expect(text).not.toMatch(/guarantee(d)? profit|profit guaranteed/i);
    expect(text).not.toMatch(/\$|USD|mm per ha/);
    expect(screen.getByTestId("prov-climate")).toHaveTextContent(/\d{1,3}(,\d{3})* mm\/yr rain/);
    expect(screen.getByTestId("prov-farmer")).toHaveTextContent("budget KES 120,000");
  });

  it("REV-5: budget fit is a per-season model judgement", async () => {
    renderRotation();
    await waitForPlans();
    const c = card("current");
    const dd = within(c).getByText(/budget per season/).closest("dd")!;
    expect(dd).toHaveTextContent(/May exceed budget per season|Within budget per season/);
    expect(dd).not.toHaveTextContent(/Over budget/);
    expect(dd.querySelector("[data-source='MODEL_ESTIMATE']")).not.toBeNull();
    expect(dd.querySelector("[data-source='FARMER_REPORTED']")).toBeNull();
  });

  it("REV-11: the plan radio is named by the plan title regardless of selection", async () => {
    const { user } = renderRotation();
    await waitForPlans();
    const title = within(card("minimum")).getByRole("heading", { level: 3 }).textContent ?? "";
    expect(radioFor("minimum")).toHaveAccessibleName(title);
    await user.click(radioFor("minimum"));
    expect(radioFor("minimum")).toHaveAccessibleName(title);
    expect(radioFor("minimum")).toHaveAttribute("aria-checked", "true");
  });

  it("R12: plan cards, dialog and drawer behave like the shared components (roles, modal, close, focus return)", async () => {
    const { user } = renderRotation();
    await waitForPlans();
    // cards are labelled regions with source badges next to model numbers
    for (const id of PLAN_IDS) {
      const title = within(card(id)).getByRole("heading", { level: 3 }).textContent ?? "";
      expect(screen.getByRole("region", { name: title })).toBe(card(id));
      expect(card(id).querySelector("[data-source='MODEL_ESTIMATE']")).not.toBeNull();
    }
    expect(screen.getByTestId("prov-climate").querySelector("[data-source^='NASA']")).not.toBeNull();
    expect(screen.getByTestId("prov-soil").querySelector("[data-source='SIMULATED_IOT']")).not.toBeNull();
    expect(screen.getByTestId("prov-farmer").querySelector("[data-source='FARMER_REPORTED']")).not.toBeNull();

    for (const open of [
      () => screen.getByRole("button", { name: "Compare all" }),
      () => within(card("current")).getByRole("button", { name: /why this plan/i }),
    ]) {
      const trigger = open();
      await user.click(trigger);
      const dlg = screen.getByRole("dialog");
      expect(dlg).toHaveAttribute("aria-modal", "true");
      expect(dlg).toHaveAccessibleName();
      expect(dlg).toContainElement(document.activeElement as HTMLElement);
      const closeIcon = within(dlg).getAllByRole("button", { name: "Close" })[0];
      await user.click(closeIcon);
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(trigger).toHaveFocus();
    }
  });

  it("R08: budget and priorities edits in the shared store recalculate the cards", async () => {
    const { user } = renderRotation();
    await waitForPlans();
    const scores = () => PLAN_IDS.map((id) => screen.getByTestId(`score-${id}`).textContent).join("|");
    const fits = () => screen.getAllByText(/budget per season|Budget not given/).map((e) => e.textContent).join("|");
    const s0 = scores(), f0 = fits();
    await user.click(screen.getByRole("button", { name: "probe: budget 300k" }));
    expect(screen.getByTestId("prov-farmer")).toHaveTextContent("budget KES 300,000");
    expect(fits()).not.toBe(f0);
    expect(scores()).not.toBe(s0);
    const s1 = scores();
    await user.click(screen.getByRole("button", { name: "probe: priorities cost" }));
    expect(scores()).not.toBe(s1);
  });

  it("alias crop ids: an identical crop written as 'bean' is not marked as changed", async () => {
    renderRotation({ farm: { ...SAMPLE_FARM, rotation: SAMPLE_FARM.rotation.map((r) => (r.cropId === "beans" ? { ...r, cropId: "bean" } : r)) } });
    await waitForPlans();
    const seq = within(card("minimum")).getByRole("list", { name: /crop sequence/i });
    for (const li of within(seq).getAllByRole("listitem")) {
      if (/Common beans/.test(li.textContent ?? "") && /Year 2 · Short rains/.test(li.textContent ?? "")) {
        expect(li).not.toHaveTextContent("(changed)");
      }
    }
    const changed = within(seq).queryAllByText("(changed)", { exact: false }).length;
    expect(changed).toBe(Number(/(\d+) of/.exec(within(card("minimum")).getByText(/change ·|No change/).textContent ?? "")?.[1] ?? 0));
  });

  it("shows a USER_SOIL_TEST badge when the farm has its own soil test", async () => {
    renderRotation({ farm: { ...SAMPLE_FARM, knownSoil: { ph: 6.8, moisturePct: 20, source: "USER_SOIL_TEST" } } });
    await waitForPlans();
    expect(screen.getByTestId("prov-soil").querySelector("[data-source='USER_SOIL_TEST']")).not.toBeNull();
  });

  it("Copy summary writes to the clipboard and toasts", async () => {
    const { user } = renderRotation();
    await waitForPlans();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await user.click(screen.getByRole("button", { name: "Copy summary" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(String(writeText.mock.calls[0][0]).length).toBeGreaterThan(20);
    expect(await screen.findByText(/summary copied/i)).toBeInTheDocument();
  });

  it("Copy summary falls back to execCommand and reports failure honestly", async () => {
    const { user } = renderRotation();
    await waitForPlans();
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) }, configurable: true });
    const exec = vi.fn().mockReturnValue(false);
    Object.defineProperty(document, "execCommand", { value: exec, configurable: true });
    await user.click(screen.getByRole("button", { name: "Copy summary" }));
    await waitFor(() => expect(exec).toHaveBeenCalledWith("copy"));
    expect(await screen.findByText(/could not copy/i)).toBeInTheDocument();
  });

  it("Download JSON creates a farm-named JSON file", async () => {
    const { user } = renderRotation();
    await waitForPlans();
    const blobs: Blob[] = [];
    const create = vi.fn((b: Blob) => { blobs.push(b); return "blob:mock"; });
    Object.defineProperty(URL, "createObjectURL", { value: create, configurable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), configurable: true });
    let downloaded = "";
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { downloaded = this.download; });
    await user.click(screen.getByRole("button", { name: "Download JSON" }));
    expect(create).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalled();
    expect(downloaded).toBe(`farmwise-rotations-${SAMPLE_FARM.id}.json`);
    expect(blobs[0].type).toBe("application/json");
    const text = await new Promise<string>((resolve) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.readAsText(blobs[0]); });
    const parsed = JSON.parse(text);
    expect(parsed.plans).toHaveLength(3);
    expect(parsed.currency).toBe("KES");
    expect(await screen.findByText(/Downloaded farmwise-rotations/)).toBeInTheDocument();
  });

  it("no farm: shows the empty state with a working link to onboarding", async () => {
    const { user } = renderRotation({ farm: null });
    expect(screen.getByRole("heading", { name: "Set up a farm first" })).toBeInTheDocument();
    expect(screen.queryByTestId("plan-card-current")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Set up a farm first" }));
    expect(await screen.findByRole("heading", { name: "Onboarding route" })).toBeInTheDocument();
  });

  it("disables Use in scenarios with an explanation when the selected plan is infeasible", async () => {
    renderRotation({ soilPreset: "wet", farm: { ...SAMPLE_FARM, irrigation: "regular", budget: null, rotation: INFEASIBLE_ROTATION } });
    await waitForPlans();
    act(() => { fireEvent.click(radioFor("current")); });
    const btn = within(screen.getByTestId("plan-details")).getByRole("button", { name: "Use in scenarios" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAccessibleDescription(/turned off for this plan/);
  });
});
