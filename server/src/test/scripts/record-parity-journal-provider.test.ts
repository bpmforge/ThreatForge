/**
 * Provider-selection tests for scripts/record-parity-journal.ts.
 *
 * Only `selectProvider` is exercised — it is the pure part of the script (no
 * network, no fs). Client construction and the readiness probe are
 * integration behaviour, out of scope for a unit test.
 */
import { describe, it, expect } from "vitest";
import { selectProvider } from "../../../scripts/record-parity-journal.js";

describe("selectProvider", () => {
  it("defaults to lmstudio with the existing default URLs and model", () => {
    const selection = selectProvider({});
    expect(selection).toEqual({
      provider: "lmstudio",
      primaryUrl: "http://lmstudio-host.internal:1234/v1",
      fallbackUrl: "http://lmstudio-fallback.internal:1234/v1",
      model: "qwen/qwen3-coder-next",
      maxTokens: 3000,
    });
  });

  it("honors LM Studio env overrides", () => {
    const selection = selectProvider({
      LM_STUDIO_URL: "http://localhost:1234/v1",
      LM_STUDIO_MODEL: "custom-model",
    });
    expect(selection).toMatchObject({
      provider: "lmstudio",
      primaryUrl: "http://localhost:1234/v1",
      model: "custom-model",
    });
  });

  it("selects openai with required env present, thinking on by default", () => {
    const selection = selectProvider({
      PARITY_PROVIDER: "openai",
      OPENAI_BASE_URL: "http://127.0.0.1:8000",
      OPENAI_API_KEY: "secret-key",
      OPENAI_MODEL: "Youssofal--Qwen3.8-27B-MTPLX-Optimized-Speed",
    });
    expect(selection).toEqual({
      provider: "openai",
      baseUrl: "http://127.0.0.1:8000",
      apiKey: "secret-key",
      model: "Youssofal--Qwen3.8-27B-MTPLX-Optimized-Speed",
      maxTokens: 3000,
      thinking: true,
    });
  });

  it("turns thinking off with PARITY_THINKING=off", () => {
    const selection = selectProvider({
      PARITY_PROVIDER: "openai",
      OPENAI_BASE_URL: "http://127.0.0.1:8000",
      OPENAI_API_KEY: "k",
      OPENAI_MODEL: "m",
      PARITY_THINKING: "off",
    });
    expect(selection).toMatchObject({ thinking: false });
  });

  it("keeps thinking on with an explicit PARITY_THINKING=on", () => {
    const selection = selectProvider({
      PARITY_PROVIDER: "openai",
      OPENAI_BASE_URL: "http://127.0.0.1:8000",
      OPENAI_API_KEY: "k",
      OPENAI_MODEL: "m",
      PARITY_THINKING: "on",
    });
    expect(selection).toMatchObject({ thinking: true });
  });

  it("throws for an unknown PARITY_THINKING value", () => {
    expect(() =>
      selectProvider({
        PARITY_PROVIDER: "openai",
        OPENAI_BASE_URL: "http://127.0.0.1:8000",
        OPENAI_API_KEY: "k",
        OPENAI_MODEL: "m",
        PARITY_THINKING: "maybe",
      }),
    ).toThrow(/Unknown PARITY_THINKING/);
  });

  it("throws for openai with missing required env", () => {
    expect(() =>
      selectProvider({
        PARITY_PROVIDER: "openai",
        OPENAI_BASE_URL: "http://x",
      }),
    ).toThrow(/requires OPENAI_BASE_URL, OPENAI_API_KEY and OPENAI_MODEL/);
  });

  it("throws for an unknown provider", () => {
    expect(() => selectProvider({ PARITY_PROVIDER: "bogus" })).toThrow(
      /Unknown PARITY_PROVIDER/,
    );
  });

  it("enforces the >=400 max-tokens floor for a reasoning model", () => {
    const selection = selectProvider({
      PARITY_PROVIDER: "openai",
      OPENAI_BASE_URL: "http://127.0.0.1:8000",
      OPENAI_API_KEY: "k",
      OPENAI_MODEL: "m",
      PARITY_MAX_TOKENS: "50",
    });
    expect(selection.maxTokens).toBe(400);
  });

  it("respects a PARITY_MAX_TOKENS above the floor", () => {
    const selection = selectProvider({
      PARITY_PROVIDER: "openai",
      OPENAI_BASE_URL: "http://127.0.0.1:8000",
      OPENAI_API_KEY: "k",
      OPENAI_MODEL: "m",
      PARITY_MAX_TOKENS: "1000",
    });
    expect(selection.maxTokens).toBe(1000);
  });
});
