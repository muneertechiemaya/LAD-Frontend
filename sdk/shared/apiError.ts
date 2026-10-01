/**
 * Typed API error - carries the backend's HTTP status and machine-readable
 * `code` through to the UI.
 *
 * Every HTTP client in this repo used to throw a bare `Error` whose only
 * payload was a message string, which meant a caller could not tell a 409 from
 * a 500 without regex-matching prose. Backends already send a stable
 * discriminator (e.g. `{ error, code: 'CAMPAIGN_NAME_TAKEN' }`); this class
 * preserves it so a call site can react to the *kind* of failure rather than
 * just print it.
 *
 * `message` is deliberately unchanged from what the clients threw before
 * (backend `error`/`message`, falling back to `VERB /path <status>`), so the
 * many `catch (e) { toast(e.message) }` sites keep working untouched.
 */

export class ApiError extends Error {
  /** HTTP status of the failed response (0 when the request never completed). */
  readonly status: number;
  /** Backend's machine-readable discriminator, when it sent one. */
  readonly code?: string;
  /** Parsed response body, when it was JSON. */
  readonly body?: any;

  constructor(message: string, status: number, code?: string, body?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.body = body;
    // Required for `instanceof` to survive the ES5 downlevel target.
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/** Narrow an unknown catch-binding to an ApiError. */
export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

/** The backend `code` of a failure, or undefined for non-API errors. */
export function apiErrorCode(err: unknown): string | undefined {
  return isApiError(err) ? err.code : undefined;
}

/** The HTTP status of a failure, or undefined for non-API errors. */
export function apiErrorStatus(err: unknown): number | undefined {
  return isApiError(err) ? err.status : undefined;
}

/**
 * FastAPI/Pydantic error bodies (LAD-Master-Agent) use `{detail: ...}`
 * instead of Express's `{error, message}` (LAD_backend) — `detail` is either
 * a plain string (raised HTTPException) or an array of validation-error
 * objects (automatic query/body validation), e.g.
 * `{detail: [{loc: [...], msg: "...", type: "..."}]}`. Without this, any
 * Master-Agent 4xx/5xx with no `error`/`message` field fell through to the
 * generic `HTTP {status}: {statusText}` fallback — and `statusText` is
 * commonly empty over HTTP/2 (Cloud Run), producing a bare "HTTP 422:" with
 * no information at all.
 */
function detailToMessage(detail: unknown): string | undefined {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((d) => (typeof d === 'string' ? d : d?.msg))
      .filter((m): m is string => typeof m === 'string' && m.length > 0);
    return msgs.length ? msgs.join('; ') : undefined;
  }
  // A STRUCTURED detail — `raise HTTPException(409, detail={error, message, ...})`.
  // This is how every deliberate refusal in LAD-WABA-Comms is raised, and it was
  // the one `detail` shape not read here: an object fell through to `fallback`,
  // so the service's own sentence was replaced by whatever string the call site
  // happened to pass.
  //
  // Measured on stage 2026-10-01: four attempts to message +971 52 685 0791
  // were refused because the customer last replied 44.1 hours earlier and
  // Meta's 24-hour window had closed. The service said exactly that and named
  // the remedy — send a template. The composer showed "Failed to send message",
  // so the reason was only readable in the network tab.
  //
  // `message` wins over `error`: `error` is the slug a caller branches on
  // ("outside_24h_window"), `message` is the sentence written for a person.
  // The slug is not lost — detailToCode hands it to ApiError.code.
  if (detail && typeof detail === 'object') {
    const d = detail as Record<string, unknown>;
    for (const key of ['message', 'error'] as const) {
      const v = d[key];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
  }
  return undefined;
}

/**
 * The machine-readable discriminator inside a structured FastAPI detail.
 *
 * Express routes put it at `body.code`; the Python services put it at
 * `detail.error`. Surfacing it as `ApiError.code` is what lets a call site
 * branch on the KIND of refusal — `code === 'outside_24h_window'` can offer the
 * template picker — instead of regex-matching prose, which is the thing this
 * whole module exists to stop.
 */
function detailToCode(detail: unknown): string | undefined {
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return undefined;
  const err = (detail as Record<string, unknown>).error;
  return typeof err === 'string' && err.trim() ? err.trim() : undefined;
}

/**
 * Build an ApiError from a failed `fetch` Response, reading the backend's
 * `error`/`message`/`code` out of the JSON body when there is one.
 *
 * `prefer` exists because the two HTTP clients disagreed about which body field
 * wins, and both are load-bearing: the SDK client read `error` first, while
 * web/src/lib/api.ts read `message` first (routes that send both use `error` for
 * the headline and `message` for the detail, so flipping it would swap a
 * diagnostic string for a generic one). Each caller keeps its own order.
 *
 * @param res       the non-ok Response
 * @param fallback  message to use when the body carries none
 * @param prefer    which body field wins when both are present
 */
export async function apiErrorFromResponse(
  res: Response,
  fallback: string,
  prefer: 'error' | 'message' = 'error'
): Promise<ApiError> {
  let body: any;
  try {
    body = await res.json();
  } catch {
    // Non-JSON (HTML error page, empty body) - the fallback message stands.
  }
  const message =
    (prefer === 'message'
      ? body?.message || body?.error
      : body?.error || body?.message) ||
    detailToMessage(body?.detail) ||
    fallback;
  return new ApiError(message, res.status, body?.code ?? detailToCode(body?.detail), body);
}
