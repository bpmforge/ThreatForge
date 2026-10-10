import { describe, it, expect } from "vitest";
import { staleNameUpdates } from "../backfill-normalized-names.js";
import { normalizeThreatName } from "../../services/threat-review/normalize-threat-name.js";

describe("staleNameUpdates", () => {
  it("recomputes only rows whose stored key differs", () => {
    const name = "Spoofing of Gateway by Attacker";
    const fresh = normalizeThreatName(name);
    const rows = [
      { id: "a", name, normalizedName: "attacker gateway spoofing" },
      { id: "b", name, normalizedName: fresh },
      {
        id: "c",
        name: "SQL injection",
        normalizedName: normalizeThreatName("SQL injection"),
      },
    ];
    expect(staleNameUpdates(rows)).toEqual([
      { id: "a", normalizedName: fresh },
    ]);
  });

  it("keeps A-by-B and B-by-A distinct", () => {
    const [x, y] = staleNameUpdates([
      {
        id: "1",
        name: "Spoofing of gateway by attacker",
        normalizedName: null,
      },
      {
        id: "2",
        name: "Spoofing of attacker by gateway",
        normalizedName: null,
      },
    ]);
    expect(x.normalizedName).not.toBe(y.normalizedName);
  });
});
