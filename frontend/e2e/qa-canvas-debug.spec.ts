/**
 * Canvas debug — captures console logs and network failures.*/
import { test } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const BASE = process.env.BASE_URL || "https://threatforge.bpmforge.com";
const AUTH_FILE = path.join(__dirname, "../../.auth/prod-user.json");
const SCREENSHOTS = path.join(__dirname, "screenshots/qa-prod");

test.use({ baseURL: BASE, ignoreHTTPSErrors: true });

test("canvas load debug", async ({ browser }) => {
  if (!fs.existsSync(AUTH_FILE)) {
    console.log("No auth file — sign in and save the auth state first");
    return;
  }

  const ctx = await browser.newContext({
    ignoreHTTPSErrors: true,
    baseURL: BASE,
    storageState: AUTH_FILE,
  });
  const page = await ctx.newPage();

  const errors: string[] = [];
  const networkFails: string[] = [];
  const errors500: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("requestfailed", (req) => {
    networkFails.push(
      `${req.method()} ${req.url()} — ${req.failure()?.errorText}`,
    );
  });
  page.on("response", (resp) => {
    if (resp.status() >= 500) errors500.push(`${resp.status()} ${resp.url()}`);
  });

  // Find the model id from the API
  const pr = await page.request.get(`${BASE}/api/projects`, {
    ignoreHTTPSErrors: true,
  });
  let modelId = "";
  if (pr.ok()) {
    const d = await pr.json();
    const projects = d?.data || d || [];
    if (Array.isArray(projects) && projects.length) {
      const projectId = projects[0].id;
      const mr = await page.request.get(
        `${BASE}/api/threat-models?projectId=${projectId}`,
        { ignoreHTTPSErrors: true },
      );
      if (mr.ok()) {
        const md = await mr.json();
        const models = md?.data || md || [];
        if (Array.isArray(models) && models.length) modelId = models[0].id;
      }
    }
  }
  console.log("modelId:", modelId);

  await page.goto(`/models/${modelId}`);
  // Wait longer for canvas to fully render
  await page.waitForTimeout(8000);

  await page.screenshot({
    path: path.join(SCREENSHOTS, "debug-canvas-8s.png"),
    fullPage: false,
  });

  console.log("JS Errors:", errors.length ? errors.join("\n") : "none");
  console.log(
    "Network failures:",
    networkFails.length ? networkFails.join("\n") : "none",
  );
  console.log("500 errors:", errors500.length ? errors500.join("\n") : "none");

  // Also take a screenshot of the full page to see sidebar
  await page.screenshot({
    path: path.join(SCREENSHOTS, "debug-canvas-full.png"),
    fullPage: true,
  });

  await ctx.close();
});
