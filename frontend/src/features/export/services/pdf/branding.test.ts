import { describe, it, expect } from "vitest";
import { generatePDFHTML } from "./index";
import { getBrandingLogo, getBrandingStyles } from "./branding";

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

describe("PDF branding", () => {
  it("renders logo and colours when branding present", () => {
    const html = generatePDFHTML("M", [], [], [], undefined, {
      logoDataUrl: PNG,
      primaryColor: "#112233",
      accentColor: "#aabbcc",
    });
    expect(html).toContain('class="brand-logo"');
    expect(html).toContain(PNG);
    expect(html).toContain("#112233");
    expect(html).toContain("#aabbcc");
  });

  it("renders no logo or colour overrides when branding absent", () => {
    const html = generatePDFHTML("M", [], [], []);
    expect(html).not.toContain("<img");
    expect(html).not.toContain("h1 { color:");
  });

  it("rejects unsafe colour and logo values", () => {
    expect(getBrandingStyles({ primaryColor: "red;}</style>" })).not.toContain(
      "red",
    );
    expect(getBrandingLogo({ logoDataUrl: 'x" onerror="alert(1)' })).toBe("");
    expect(
      getBrandingLogo({ logoDataUrl: "data:image/svg+xml;base64,AAA" }),
    ).toBe("");
  });
});
