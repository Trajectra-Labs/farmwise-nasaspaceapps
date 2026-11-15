import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderRotation } from "./helpers";

const nasa = vi.hoisted(() => ({ fail: true, calls: 0 }));
vi.mock("@fw/nasa", async (orig) => {
  const real = await orig<typeof import("@fw/nasa")>();
  return {
    ...real,
    getClimateContext: vi.fn(async (farm: Parameters<typeof real.getClimateContext>[0]) => {
      nasa.calls += 1;
      if (nasa.fail) throw new Error("NASA snapshot could not be read.");
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

  it("shows a skeleton while climate is loading", async () => {
    nasa.fail = false;
    renderRotation();
    expect(screen.getByLabelText("Loading climate evidence")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByLabelText("Loading climate evidence")).toBeNull());
  });
});
