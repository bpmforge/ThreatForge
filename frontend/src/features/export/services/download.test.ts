/**
 * Tests for download utilities.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  sanitizeFilename,
  escapeHtml,
  downloadBlob,
  downloadDataUrl,
} from "./download";

describe("sanitizeFilename", () => {
  it("replaces spaces with underscores", () => {
    expect(sanitizeFilename("my file name")).toBe("my_file_name");
  });

  it("removes special characters", () => {
    expect(sanitizeFilename("file:name/with\\special?chars")).toBe(
      "file_name_with_special_chars",
    );
  });

  it("converts to lowercase", () => {
    expect(sanitizeFilename("MyFileName")).toBe("myfilename");
  });

  it("handles empty string", () => {
    expect(sanitizeFilename("")).toBe("");
  });

  it("preserves numbers", () => {
    expect(sanitizeFilename("file123")).toBe("file123");
  });

  it("handles unicode characters", () => {
    expect(sanitizeFilename("café résumé")).toBe("caf__r_sum_");
  });
});

describe("escapeHtml", () => {
  it("escapes HTML tags", () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert("xss")&lt;/script&gt;',
    );
  });

  it("escapes ampersands", () => {
    expect(escapeHtml("foo & bar")).toBe("foo &amp; bar");
  });

  it("escapes quotes", () => {
    expect(escapeHtml('"quoted"')).toBe('"quoted"');
  });

  it("handles empty string", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("preserves normal text", () => {
    expect(escapeHtml("Hello World")).toBe("Hello World");
  });
});

describe("downloadBlob", () => {
  let mockCreateObjectURL: ReturnType<typeof vi.fn>;
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
  let mockAppendChild: ReturnType<typeof vi.fn>;
  let mockRemoveChild: ReturnType<typeof vi.fn>;
  let mockClick: ReturnType<typeof vi.fn>;
  let mockLink: {
    href: string;
    download: string;
    click: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockCreateObjectURL = vi.fn().mockReturnValue("blob:test-url");
    mockRevokeObjectURL = vi.fn();
    mockAppendChild = vi.fn().mockReturnValue({} as Node);
    mockRemoveChild = vi.fn().mockReturnValue({} as Node);
    mockClick = vi.fn();
    mockLink = { href: "", download: "", click: mockClick };

    global.URL.createObjectURL =
      mockCreateObjectURL as typeof URL.createObjectURL;
    global.URL.revokeObjectURL =
      mockRevokeObjectURL as typeof URL.revokeObjectURL;

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

  it("creates object URL from blob", () => {
    const blob = new Blob(["test"], { type: "text/plain" });
    downloadBlob(blob, "test.txt");

    expect(mockCreateObjectURL).toHaveBeenCalledWith(blob);
  });

  it("sets download filename", () => {
    const blob = new Blob(["test"], { type: "text/plain" });
    downloadBlob(blob, "myfile.json");

    expect(mockLink.download).toBe("myfile.json");
  });

  it("triggers click on link", () => {
    const blob = new Blob(["test"], { type: "text/plain" });
    downloadBlob(blob, "test.txt");

    expect(mockClick).toHaveBeenCalled();
  });

  it("cleans up URL after download", () => {
    const blob = new Blob(["test"], { type: "text/plain" });
    downloadBlob(blob, "test.txt");

    expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:test-url");
  });
});

describe("downloadDataUrl", () => {
  let mockAppendChild: ReturnType<typeof vi.fn>;
  let mockRemoveChild: ReturnType<typeof vi.fn>;
  let mockClick: ReturnType<typeof vi.fn>;
  let mockLink: {
    href: string;
    download: string;
    click: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockAppendChild = vi.fn().mockReturnValue({} as Node);
    mockRemoveChild = vi.fn().mockReturnValue({} as Node);
    mockClick = vi.fn();
    mockLink = { href: "", download: "", click: mockClick };

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

  it("sets href to data URL", () => {
    const dataUrl = "data:image/png;base64,abc123";
    downloadDataUrl(dataUrl, "image.png");

    expect(mockLink.href).toBe(dataUrl);
  });

  it("sets download filename", () => {
    downloadDataUrl("data:image/png;base64,abc123", "screenshot.png");

    expect(mockLink.download).toBe("screenshot.png");
  });

  it("triggers click on link", () => {
    downloadDataUrl("data:image/png;base64,abc123", "image.png");

    expect(mockClick).toHaveBeenCalled();
  });
});
