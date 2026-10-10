import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { checkZipLimits } from "../zip-guard.js";

async function makeZip(files: Record<string, string>) {
  const zip = new JSZip();
  for (const [name, body] of Object.entries(files)) zip.file(name, body);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

describe("checkZipLimits", () => {
  it("accepts a small archive", async () => {
    expect(checkZipLimits(await makeZip({ "a.txt": "hello" }))).toBeNull();
  });

  it("rejects a highly compressible archive over the size cap", async () => {
    // 60 MiB of zeros deflates to a few tens of KB.
    const bomb = await makeZip({ "word/document.xml": "0".repeat(60 << 20) });
    expect(bomb.length).toBeLessThan(200 * 1024);
    expect(checkZipLimits(bomb)).toMatch(/too much data/);
  });

  it("rejects archives with too many entries", async () => {
    const files: Record<string, string> = {};
    for (let i = 0; i < 20; i++) files[`f${i}`] = "x";
    expect(
      checkZipLimits(await makeZip(files), { maxBytes: 1e6, maxEntries: 10 }),
    ).toMatch(/too many entries/);
  });

  it("rejects data that is not a zip", () => {
    expect(checkZipLimits(Buffer.from("plain text, not a zip file"))).toMatch(
      /valid zip/,
    );
  });
});
