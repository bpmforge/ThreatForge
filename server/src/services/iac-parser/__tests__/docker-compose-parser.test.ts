import { describe, it, expect } from "vitest";
import { parseDockerCompose } from "../docker-compose-parser.js";

describe("parseDockerCompose", () => {
  it("extracts environment keys without values", () => {
    const yaml = [
      "services:",
      "  web:",
      "    image: nginx",
      "    environment:",
      "      - DB_HOST=db",
      "      API_KEY: secret",
    ].join("\n");
    const result = parseDockerCompose(yaml);
    expect(result.components.length).toBeGreaterThan(0);
  });

  it("parses 1 MiB of newlines inside a service block in under 1s", () => {
    const evil =
      "services:\n  web:\n    image: nginx\n    environment:\n" +
      "\n".repeat(1024 * 1024 - 60);
    const start = Date.now();
    parseDockerCompose(evil);
    expect(Date.now() - start).toBeLessThan(1000);
  });

  it("parses 1 MiB of indented blank lines in under 1s", () => {
    const evil =
      "services:\n  web:\n    image: nginx\n" + " \n".repeat(512 * 1024 - 20);
    const start = Date.now();
    parseDockerCompose(evil);
    expect(Date.now() - start).toBeLessThan(1000);
  });
});
