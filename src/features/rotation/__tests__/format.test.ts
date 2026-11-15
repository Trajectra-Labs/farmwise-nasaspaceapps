import { describe, expect, it } from "vitest";
import { evidenceValue } from "../WhyDrawer";
import { waterText } from "../format";

describe("rotation display formatting", () => {
  it("REV-3: never doubles a unit and formats KES with the shared formatter", () => {
    expect(evidenceValue({ value: "120,000 KES", unit: "KES" })).toBe("120,000 KES");
    expect(evidenceValue({ value: 120000, unit: "KES" })).toBe("KES 120,000");
    expect(evidenceValue({ value: 45000, unit: "KES/ha" })).toBe("KES 45,000/ha");
    expect(evidenceValue({ value: 1631, unit: "mm/yr" })).toBe("1,631 mm/yr");
    expect(evidenceValue({ value: 15.43, unit: "°C" })).toBe("15.4 °C");
    expect(evidenceValue({ value: "2 ha", unit: "ha" })).toBe("2 ha");
    expect(evidenceValue({ value: "limited", unit: undefined })).toBe("limited");
    expect(evidenceValue({ value: null, unit: "mm" })).toBe("Unknown");
  });
  it("REV-6: water is a rotation total in mm, not per ha", () => {
    expect(waterText(2350)).toBe("≈ 2,350 mm");
    expect(waterText(null)).toBe("Unknown");
  });
});
