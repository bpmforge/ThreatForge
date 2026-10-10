import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NvdApiKeyCard } from "./NvdApiKeyCard";
import { nvdApiKeyPayload, type AdminSettings } from "./useAdminSettings";

const base = {
  nvdApiKeyInput: "",
  nvdApiKeyClear: false,
  nvdApiKeySource: "none",
} as AdminSettings;

describe("nvdApiKeyPayload", () => {
  it("sends nothing when the admin did not touch the key", () => {
    expect(nvdApiKeyPayload(base)).toEqual({});
  });
  it("sends a newly typed key, trimmed", () => {
    expect(nvdApiKeyPayload({ ...base, nvdApiKeyInput: " abc " })).toEqual({
      nvdApiKey: "abc",
    });
  });
  it("sends an empty key to remove the stored one", () => {
    expect(nvdApiKeyPayload({ ...base, nvdApiKeyClear: true })).toEqual({
      nvdApiKey: "",
    });
  });
});

describe("NvdApiKeyCard", () => {
  it("says when there is no key and never shows a stored one", () => {
    render(<NvdApiKeyCard settings={base} onUpdate={vi.fn()} />);
    expect(screen.getByText("No key: rate limited")).toBeTruthy();
    expect((screen.getByLabelText("API key") as HTMLInputElement).value).toBe(
      "",
    );
  });

  it("offers to remove a saved key", () => {
    const onUpdate = vi.fn();
    render(
      <NvdApiKeyCard
        settings={{ ...base, nvdApiKeySource: "settings" }}
        onUpdate={onUpdate}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove saved key" }));
    expect(onUpdate).toHaveBeenCalledWith({
      nvdApiKeyInput: "",
      nvdApiKeyClear: true,
    });
  });
});
