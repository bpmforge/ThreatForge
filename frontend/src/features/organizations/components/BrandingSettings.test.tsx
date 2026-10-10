import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrandingSettings } from "./BrandingSettings";

vi.mock("@/lib/api-client", () => ({
  apiGet: vi.fn().mockResolvedValue({}),
  apiPut: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function renderForm() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <BrandingSettings orgId="org-1" canEdit />
    </QueryClientProvider>,
  );
}

describe("BrandingSettings", () => {
  it("shows the real default colours on blank swatches, not black", () => {
    renderForm();
    const primary = screen.getByLabelText(
      "Primary colour picker",
    ) as HTMLInputElement;
    const accent = screen.getByLabelText(
      "Accent colour picker",
    ) as HTMLInputElement;
    expect(primary.value).toBe("#1d4ed8");
    expect(accent.value).toBe("#2563eb");
    expect(screen.getByPlaceholderText("#1d4ed8")).toBeTruthy();
    expect(screen.getByPlaceholderText("#2563eb")).toBeTruthy();
  });
});
