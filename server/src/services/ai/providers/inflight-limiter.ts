/**
 * bound the number of completion requests in flight per provider.
 *
 * A local model server (MTPLX, LM Studio, Ollama) holds KV cache for every
 * request it is serving, so its memory footprint grows with concurrency. The
 * agentic framework runners and the flow children fan out with Promise.all /
 * parallel workers, which is how a recording pushed MTPLX into HTTP 507.
 *
 * One semaphore per endpoint (provider + base URL), shared by every client in
 * the process, so two jobs against the same local server share one budget.
 * Local endpoints default to 1 in flight; hosted APIs are left unbounded
 * unless MAX_INFLIGHT_PER_PROVIDER is set. MAX_INFLIGHT_PER_PROVIDER=0 turns
 * the limit off everywhere.
 */
import type {
  AIProviderClient,
  AICompletionOptions,
  AICompletionResponse,
} from "../../../types/ai.js";
import {
  retryOnInsufficientMemory,
  type InsufficientMemoryRetryOptions,
} from "./insufficient-memory-retry.js";
import { overrideClient } from "./override-client.js";

const LOCAL_PROVIDERS = new Set(["lmstudio", "ollama"]);

/** True for loopback, *.local, *.internal and RFC 1918 hosts. */
export function isLocalEndpoint(baseUrl: string | undefined): boolean {
  if (!baseUrl) return false;
  let host: string;
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    return false;
  }
  return (
    host === "localhost" ||
    host === "::1" ||
    host === "[::1]" ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  );
}

/**
 * The in-flight limit for an endpoint, or null for unbounded.
 * `env` is injectable for tests.
 */
export function inflightLimitFor(
  provider: string,
  baseUrl: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): number | null {
  const raw = env.MAX_INFLIGHT_PER_PROVIDER;
  if (raw !== undefined && raw !== "") {
    const n = Number(raw);
    if (Number.isInteger(n) && n >= 0) return n === 0 ? null : n;
  }
  const local =
    LOCAL_PROVIDERS.has(provider) ||
    // lmstudio/ollama clients default to localhost when no URL is set.
    isLocalEndpoint(baseUrl);
  return local ? 1 : null;
}

class Semaphore {
  private active = 0;
  private waiters: Array<() => void> = [];

  constructor(readonly max: number) {}

  get inFlight(): number {
    return this.active;
  }

  get queued(): number {
    return this.waiters.length;
  }

  /** Resolves once a slot is held; rejects if `signal` aborts while queued. */
  acquire(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return Promise.reject(abortReason(signal));
    if (this.active < this.max) {
      this.active++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      const grant = () => {
        signal?.removeEventListener("abort", onAbort);
        this.active++;
        resolve();
      };
      const onAbort = () => {
        this.waiters = this.waiters.filter((w) => w !== grant);
        reject(abortReason(signal as AbortSignal));
      };
      signal?.addEventListener("abort", onAbort, { once: true });
      this.waiters.push(grant);
    });
  }

  release(): void {
    this.active--;
    const next = this.waiters.shift();
    if (next) next();
  }
}

function abortReason(signal: AbortSignal): unknown {
  return (
    signal.reason ?? new Error("Aborted while waiting for a provider slot")
  );
}

const semaphores = new Map<string, Semaphore>();

function semaphoreFor(key: string, max: number): Semaphore {
  let s = semaphores.get(key);
  if (!s || s.max !== max) {
    s = new Semaphore(max);
    semaphores.set(key, s);
  }
  return s;
}

/** Test-only: drop the shared semaphores. */
export function resetInflightLimiters(): void {
  semaphores.clear();
}

/**
 * Wrap `client` so `complete()` holds a slot of its endpoint's semaphore
 * and, inside that slot, backs off and retries an HTTP 507. Every
 * other member is passed through untouched. Returns the client itself when
 * the endpoint is unbounded.
 */
export function limitInflight(
  client: AIProviderClient,
  baseUrl: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
  retry: Pick<InsufficientMemoryRetryOptions, "sleep"> = {},
): AIProviderClient {
  const max = inflightLimitFor(client.provider, baseUrl, env);
  if (max === null) return client;
  const sem = semaphoreFor(`${client.provider}|${baseUrl ?? "default"}`, max);
  const complete = async (
    options: AICompletionOptions,
  ): Promise<AICompletionResponse> => {
    await sem.acquire(options.signal);
    try {
      return await retryOnInsufficientMemory(() => client.complete(options), {
        ...retry,
        signal: options.signal,
      });
    } finally {
      sem.release();
    }
  };
  return overrideClient(client, { complete });
}
