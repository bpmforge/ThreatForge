/**
 * Shared API Client
 *
 * Provides a centralized fetch wrapper with:
 * - Authentication credentials (cookies)
 * - Consistent error handling
 * - Request/response type safety
 */

// API base URL from environment
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

/**
 * Custom API error class with status code and details
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public details?: unknown,
    /** Machine-readable reason from the server, e.g. "READ_ONLY_ACCOUNT". */
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Extended fetch options
 */
interface ApiClientOptions extends Omit<RequestInit, "body"> {
  /** Whether to include authentication credentials (default: true) */
  authenticated?: boolean;
  /**
   * Call a route served by this Next.js app itself (app/api/...), not the
   * backend: skips the NEXT_PUBLIC_API_URL prefix, which may point elsewhere.
   */
  sameOrigin?: boolean;
  /** Request body: FormData is sent as multipart, anything else as JSON */
  body?: unknown;
}

/**
 * Parse error response from API
 */
async function parseErrorResponse(
  response: Response,
): Promise<{ message: string; details?: unknown; code?: string }> {
  try {
    const data = await response.json();
    return {
      message:
        data.message ||
        data.error ||
        `Request failed with status ${response.status}`,
      details: data.details,
      code: typeof data.code === "string" ? data.code : undefined,
    };
  } catch {
    return {
      message: `Request failed with status ${response.status}`,
    };
  }
}

/**
 * Shared API client for making authenticated requests
 *
 * @param endpoint - API endpoint (e.g., '/api/threat-models')
 * @param options - Fetch options with extensions
 * @returns Parsed JSON response
 * @throws ApiError on non-2xx responses
 *
 * Callers use the method helpers below:
 *
 * @example
 * ```typescript
 * const models = await apiGet<ThreatModel[]>("/api/threat-models");
 * const created = await apiPost<ThreatModel>("/api/threat-models", { name: "My Model" });
 * ```
 */
async function apiClient<T>(
  endpoint: string,
  options: ApiClientOptions = {},
): Promise<T> {
  const {
    authenticated = true,
    sameOrigin = false,
    body,
    ...fetchOptions
  } = options;

  const headers: HeadersInit = {
    ...fetchOptions.headers,
  };

  const config: RequestInit = {
    ...fetchOptions,
    headers,
    // Include cookies for authenticated requests
    credentials: authenticated ? "include" : "same-origin",
  };

  // FormData goes as multipart (the browser sets the boundary); anything else as JSON.
  if (body instanceof FormData) {
    config.body = body;
  } else if (body !== undefined) {
    (headers as Record<string, string>)["Content-Type"] = "application/json";
    config.body = JSON.stringify(body);
  }

  const url =
    endpoint.startsWith("http") || sameOrigin
      ? endpoint
      : `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, config);

  if (!response.ok) {
    const errorData = await parseErrorResponse(response);
    throw new ApiError(
      errorData.message,
      response.status,
      errorData.details,
      errorData.code,
    );
  }

  // Handle empty responses (204 No Content)
  if (response.status === 204) {
    return undefined as T;
  }

  const json = await response.json();

  // Server wraps responses in { data: ... } via sendSuccess/sendList/sendCreated.
  // Unwrap automatically so callers get the payload directly.
  // Skip unwrapping for: pagination responses (have both data + pagination),
  // and responses that aren't wrapped objects.
  if (
    json != null &&
    typeof json === "object" &&
    !Array.isArray(json) &&
    "data" in json
  ) {
    // Pagination response: { data: [...], pagination: {...} } — return as-is
    if ("pagination" in json) {
      return json as T;
    }
    // Standard wrapped response: { data: payload } — unwrap
    return json.data as T;
  }

  return json as T;
}

/**
 * GET request helper
 */
export function apiGet<T>(
  endpoint: string,
  options?: Omit<ApiClientOptions, "method" | "body">,
): Promise<T> {
  return apiClient<T>(endpoint, { ...options, method: "GET" });
}

/**
 * POST request helper
 */
export function apiPost<T>(
  endpoint: string,
  body?: unknown,
  options?: Omit<ApiClientOptions, "method" | "body">,
): Promise<T> {
  return apiClient<T>(endpoint, { ...options, method: "POST", body });
}

/**
 * PUT request helper
 */
export function apiPut<T>(
  endpoint: string,
  body?: unknown,
  options?: Omit<ApiClientOptions, "method" | "body">,
): Promise<T> {
  return apiClient<T>(endpoint, { ...options, method: "PUT", body });
}

/**
 * PATCH request helper
 */
export function apiPatch<T>(
  endpoint: string,
  body?: unknown,
  options?: Omit<ApiClientOptions, "method" | "body">,
): Promise<T> {
  return apiClient<T>(endpoint, { ...options, method: "PATCH", body });
}

/**
 * DELETE request helper
 */
export function apiDelete<T = void>(
  endpoint: string,
  options?: Omit<ApiClientOptions, "method">,
): Promise<T> {
  return apiClient<T>(endpoint, { ...options, method: "DELETE" });
}

/**
 * GET a file (CSV, PDF, image ...) as a Blob, with the same credentials and
 * error handling as the JSON helpers.
 */
export async function apiGetBlob(endpoint: string): Promise<Blob> {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    const errorData = await parseErrorResponse(response);
    throw new ApiError(
      errorData.message,
      response.status,
      errorData.details,
      errorData.code,
    );
  }
  return response.blob();
}
