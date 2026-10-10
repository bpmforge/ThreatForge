/**
 * Shared shape of the client wrappers in client-factory (in-flight limiter,
 * usage meter, endpoint guard): replace some members, pass every other one
 * through bound to the wrapped client.
 */
import type { AIProviderClient } from "../../../types/ai.js";

export function overrideClient(
  client: AIProviderClient,
  overrides: Partial<Pick<AIProviderClient, "complete" | "isAvailable">>,
): AIProviderClient {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (Object.hasOwn(overrides, prop)) {
        return overrides[prop as keyof typeof overrides];
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
