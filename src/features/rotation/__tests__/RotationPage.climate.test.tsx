import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderRotation } from "./helpers";

const nasa = vi.hoisted(() => ({ fail: true, hold: false, calls: 0 }));
vi.mock("@fw/nasa", async (orig) => {
  const real = await orig<typeof import("@fw/nasa")>();
  return {
    ...real,
    getClimateContext: vi.fn(async (farm: Parameters<typeof real.getClimateContext>[0]) => {
      nasa.calls += 1;
      if (nasa.fail) throw new Error("NASA snapshot could not be read.");
      if (nasa.hold) return new Promise<never>(() => {});
      return real.getClimateContext(farm);
    }),
  };
});

describe("Rotation Planner climate states", () => {
  it("shows loading, then an inline error with Retry while plans still render; Retry recovers", async () => {
    nasa.fail = true;
    const { user } = renderRotation();
    // plans render even while climate is unavailable
    expect(await screen.findByTestId("plan-card-current")).toBeInTheDocument();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/Climate evidence could not load/);
    expect(alert).toHaveTextContent(/NASA snapshot could not be read/);
    expect(alert).toHaveTextContent(/confidence is lower/);
    expect(screen.getByTestId("plan-card-resilience")).toBeInTheDocument();
    const callsBefore = nasa.calls;
    nasa.fail = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(nasa.calls).toBeGreaterThan(callsBefore);
    expect(screen.getByTestId("prov-climate").querySelector("[data-source='NASA_OFFLINE_SNAPSHOT']")).not.toBeNull();
  });

  it("REV-8: a budget or irrigation edit does not refetch or blank climate", async () => {
    nasa.fail = false;
    const { user } = renderRotation();
    await waitFor(() => expect(screen.getByTestId("prov-climate").querySelector("[data-source='NASA_OFFLINE_SNAPSHOT']")).not.toBeNull());
    const calls = nasa.calls;
    await user.click(screen.getByRole("button", { name: "probe: budget 300k" }));
    await user.click(screen.getByRole("button", { name: "probe: rainfed" }));
    expect(screen.getByTestId("prov-farmer")).toHaveTextContent("budget KES 300,000");
    expect(screen.queryByLabelText("Loading climate evidence")).toBeNull();
    expect(screen.getByTestId("prov-climate").querySelector("[data-source='NASA_OFFLINE_SNAPSHOT']")).not.toBeNull();
    expect(nasa.calls).toBe(calls);
  });

  it("REV-20: after a location change, climate for the old coordinates is not used while refetching", async () => {
    nasa.fail = false; nasa.hold = false;
    const { user } = renderRotation();
    await waitFor(() => expect(screen.getByTestId("prov-climate").querySelector("[data-source='NASA_OFFLINE_SNAPSHOT']")).not.toBeNull());
    nasa.hold = true;
    await user.click(screen.getByRole("button", { name: "probe: move farm" }));
    expect(screen.getByLabelText("Loading climate evidence")).toBeInTheDocument();
    expect(screen.getByTestId("prov-climate").querySelector("[data-source^='NASA']")).toBeNull();
    nasa.hold = false;
  });

  it("shows a skeleton while climate is loading", async () => {
    nasa.fail = false;
    renderRotation();
    expect(screen.getByLabelText("Loading climate evidence")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByLabelText("Loading climate evidence")).toBeNull());
  });
});
