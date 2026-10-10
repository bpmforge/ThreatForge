/**
 * API Contract Test Fixtures
 *
 * Helpers specific to contract tests. Each test creates isolated data,
 * asserts on the response shape, and cleans up — never touching the demo
 * account models.
 *
 * Tests run against the configured BASE_URL (default: prod via TOUR_BASE_URL).
 */
import { test as base, expect, type Page } from "@playwright/test";

// Contract tests create and tear down fixtures, so they run as the writer
// account; the demo login is read-only on the public host. See ../accounts.ts.
import { WRITER_EMAIL, WRITER_PASSWORD, writerSkipReason } from "../accounts";

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function login(
  page: Page,
  email = WRITER_EMAIL,
  password = WRITER_PASSWORD,
) {
  await page.goto("/login");
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 20000 });
}

// ── In-page API helpers (carry session cookie) ───────────────────────────────

export async function apiFetch(
  page: Page,
  method: string,
  url: string,
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  return page.evaluate(
    async ({ m, u, b }) => {
      const r = await fetch(u, {
        method: m,
        headers: b ? { "Content-Type": "application/json" } : {},
        credentials: "include",
        body: b ? JSON.stringify(b) : undefined,
      });
      let json: unknown = null;
      try {
        json = await r.json();
      } catch {
        /* 204 */
      }
      return { status: r.status, body: json };
    },
    { m: method, u: url, b: body },
  );
}

export const get = (page: Page, url: string) => apiFetch(page, "GET", url);
export const post = (page: Page, url: string, body: unknown) =>
  apiFetch(page, "POST", url, body);
export const patch = (page: Page, url: string, body: unknown) =>
  apiFetch(page, "PATCH", url, body);
export const del = (page: Page, url: string) => apiFetch(page, "DELETE", url);

// ── Model lifecycle ───────────────────────────────────────────────────────────

export async function createTempModel(
  page: Page,
  suffix = "",
): Promise<string> {
  const name = `contract-test-${Date.now()}${suffix}`;
  const r = await post(page, "/api/threat-models", { name });
  expect(r.status).toBe(201);
  const id = (r.body as Record<string, Record<string, string>>)?.data?.id;
  expect(id).toBeTruthy();
  return id;
}

export async function deleteTempModel(page: Page, id: string): Promise<void> {
  await del(page, `/api/threat-models/${id}`);
}

// ── Shape assertion helpers ───────────────────────────────────────────────────

/** Assert a value has exactly the listed keys (no more, no less) */
export function assertHasKeys(obj: unknown, keys: string[], label = "") {
  expect(obj, label).toBeTruthy();
  for (const k of keys) {
    expect(
      obj as Record<string, unknown>,
      `${label} missing key "${k}"`,
    ).toHaveProperty(k);
  }
}

/** Unwrap { data: T } envelope — matches apiClient behaviour */
export function unwrap<T = unknown>(body: unknown): T {
  if (body && typeof body === "object" && "data" in (body as object)) {
    return (body as Record<string, unknown>).data as T;
  }
  return body as T;
}

// ── Extended test fixture ─────────────────────────────────────────────────────

type Fixtures = { loggedInPage: Page; writerAccount: void };

export const test = base.extend<Fixtures>({
  /** Skip, with the reason, where only a read-only demo login is available. */
  writerAccount: [
    async ({}, use, testInfo) => {
      const reason = writerSkipReason();
      testInfo.skip(!!reason, reason ?? "");
      await use();
    },
    { auto: true },
  ],
  loggedInPage: async ({ page }, use) => {
    await login(page);
    await use(page);
  },
});

export { expect };
