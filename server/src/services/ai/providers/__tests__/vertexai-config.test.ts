/**
 * The Vertex client builds its request host from the configured region and
 * sends the platform's Google credentials there, so malformed values must be
 * refused before any request is made.
 */
import { describe, it, expect } from "vitest";
import { VertexAIClient } from "../vertexai.js";

describe("VertexAIClient configuration", () => {
  it("accepts real region, project and model names", () => {
    expect(
      () =>
        new VertexAIClient("my-project-123", {
          location: "europe-west4",
          model: "gemini-1.5-pro-002",
        }),
    ).not.toThrow();
  });

  it.each(["attacker.example/#", "us-central1.evil.com", "US-CENTRAL1", ""])(
    "refuses region %j",
    (location) => {
      expect(
        () =>
          new VertexAIClient("my-project-123", { location: location || "x" }),
      ).toThrow(/region/);
    },
  );

  it("refuses a project id that could change the URL path", () => {
    expect(() => new VertexAIClient("p/../../x")).toThrow(/project/);
  });

  it("refuses a model name with path characters", () => {
    expect(
      () => new VertexAIClient("my-project-123", { model: "../../evil" }),
    ).toThrow(/model/);
  });
});
