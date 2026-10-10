/**
 * Tests for YAML export service.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/** Helper to read blob content - works in JSDOM */
async function readBlobAsText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

describe("YAML export", () => {
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
  let mockAppendChild: ReturnType<typeof vi.fn>;
  let mockRemoveChild: ReturnType<typeof vi.fn>;
  let capturedBlob: Blob | null = null;

  beforeEach(() => {
    capturedBlob = null;
    mockRevokeObjectURL = vi.fn();
    mockAppendChild = vi.fn().mockReturnValue({} as Node);
    mockRemoveChild = vi.fn().mockReturnValue({} as Node);

    global.URL.createObjectURL = vi.fn().mockImplementation((blob: Blob) => {
      capturedBlob = blob;
      return "blob:test-url";
    }) as typeof URL.createObjectURL;
    global.URL.revokeObjectURL =
      mockRevokeObjectURL as typeof URL.revokeObjectURL;

    const mockLink = { href: "", download: "", click: vi.fn() };
    vi.spyOn(document, "createElement").mockReturnValue(
      mockLink as unknown as HTMLElement,
    );
    vi.spyOn(document.body, "appendChild").mockImplementation(
      mockAppendChild as typeof document.body.appendChild,
    );
    vi.spyOn(document.body, "removeChild").mockImplementation(
      mockRemoveChild as typeof document.body.removeChild,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports threat model to YAML format", async () => {
    const { exportToYAML } = await import("./yaml-export");

    exportToYAML(
      "model-1",
      "Test Model",
      [
        {
          id: "node-1",
          type: "component",
          position: { x: 0, y: 0 },
          data: { label: "Server" },
        },
      ],
      [{ id: "edge-1", source: "node-1", target: "node-2" }],
      [
        {
          id: "threat-1",
          name: "SQL Injection",
          strideCategories: ["TAMPERING"],
          severity: "HIGH",
          status: "OPEN",
          mitigations: [],
        },
      ],
    );

    expect(capturedBlob).not.toBeNull();
    const yamlContent = await readBlobAsText(capturedBlob!);

    // Check YAML structure
    expect(yamlContent).toContain("version: 1.0");
    expect(yamlContent).toContain("model:");
    expect(yamlContent).toContain("id: model-1");
    expect(yamlContent).toContain("name: Test Model");
    expect(yamlContent).toContain("canvas:");
    expect(yamlContent).toContain("nodes:");
    expect(yamlContent).toContain("edges:");
    expect(yamlContent).toContain("threats:");
    expect(yamlContent).toContain("SQL Injection");
  });

  it("handles empty arrays", async () => {
    const { exportToYAML } = await import("./yaml-export");

    exportToYAML("model-1", "Empty Model", [], [], []);

    expect(capturedBlob).not.toBeNull();
    const yamlContent = await readBlobAsText(capturedBlob!);

    expect(yamlContent).toContain("nodes: []");
    expect(yamlContent).toContain("edges: []");
    expect(yamlContent).toContain("threats: []");
  });

  it("escapes special characters in strings", async () => {
    const { exportToYAML } = await import("./yaml-export");

    exportToYAML(
      "model-1",
      "Model: With Special#Chars",
      [],
      [],
      [
        {
          id: "threat-1",
          name: "Threat with: special chars",
          description: "Line 1\nLine 2",
          strideCategories: ["SPOOFING"],
          severity: "MEDIUM",
          status: "OPEN",
          mitigations: [],
        },
      ],
    );

    expect(capturedBlob).not.toBeNull();
    const yamlContent = await readBlobAsText(capturedBlob!);

    // Special chars should be quoted
    expect(yamlContent).toContain('"Model: With Special#Chars"');
    expect(yamlContent).toContain('"Threat with: special chars"');
  });

  it("handles null values", async () => {
    const { exportToYAML } = await import("./yaml-export");

    exportToYAML(null, "Unsaved Model", [], [], []);

    expect(capturedBlob).not.toBeNull();
    const yamlContent = await readBlobAsText(capturedBlob!);

    expect(yamlContent).toContain("id: null");
  });

  it("includes exportedAt timestamp", async () => {
    const { exportToYAML } = await import("./yaml-export");

    const beforeExport = new Date().toISOString().substring(0, 10);
    exportToYAML("model-1", "Test", [], [], []);

    expect(capturedBlob).not.toBeNull();
    const yamlContent = await readBlobAsText(capturedBlob!);

    // Should contain today's date in the timestamp
    expect(yamlContent).toContain("exportedAt:");
    expect(yamlContent).toContain(beforeExport);
  });
});
