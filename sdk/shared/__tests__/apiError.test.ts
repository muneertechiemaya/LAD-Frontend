/**
 * apiErrorFromResponse — the reason the server gave must survive the trip.
 *
 * `detail` was already read as a plain string and as a 422 validation list. The
 * shape it missed was the one every deliberate refusal in LAD-WABA-Comms uses:
 *
 *     raise HTTPException(409, detail={"error": "...", "message": "..."})
 *
 * An object fell through to `fallback`, so a service that had explained itself
 * precisely was overridden by whatever generic string the call site passed.
 *
 * Observed on stage 2026-10-01: four attempts to message +971 52 685 0791 were
 * refused because the customer last replied 44.1 hours earlier and Meta's
 * 24-hour window had closed. The service named the remedy — send a template.
 * The composer showed "Failed to send message", so the only way to learn the
 * reason was to open DevTools.
 *
 * Run: npx vitest run shared/__tests__/apiError.test.ts
 */
import { describe, expect, it } from 'vitest';
import { ApiError, apiErrorFromResponse, isApiError } from '../apiError';

/** A non-ok Response carrying `body` as JSON. */
function failing(status: number, body: unknown, statusText = ''): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** The exact body that produced the incident. */
const OUTSIDE_WINDOW = {
  detail: {
    error: 'outside_24h_window',
    message:
      'WhatsApp does not deliver free-form messages more than 24 hours after '
      + "the customer's last reply. Send an approved template to re-open the conversation.",
    last_inbound_at: '2026-09-29T15:54:05.059017+00:00',
    hours_since_last_inbound: 44.1,
  },
};

describe('a structured FastAPI detail', () => {
  it('surfaces the sentence instead of the fallback', async () => {
    const err = await apiErrorFromResponse(failing(409, OUTSIDE_WINDOW), 'Failed to send message');
    expect(err.message).toMatch(/Send an approved template/);
    expect(err.message).not.toBe('Failed to send message');
  });

  it('prefers the prose over the machine-readable slug', async () => {
    // `error` is what a caller branches on; `message` is what a person reads.
    // Showing "outside_24h_window" in the composer is barely better than the
    // generic string it replaced.
    const err = await apiErrorFromResponse(failing(409, OUTSIDE_WINDOW), 'fallback');
    expect(err.message).not.toBe('outside_24h_window');
  });

  it('carries the slug through as `code`, so the prose need never be parsed', async () => {
    // The point of ApiError: react to the KIND of refusal. A caller seeing
    // 'outside_24h_window' can open the template picker.
    const err = await apiErrorFromResponse(failing(409, OUTSIDE_WINDOW), 'fallback');
    expect(err.code).toBe('outside_24h_window');
    expect(err.status).toBe(409);
    expect(isApiError(err)).toBe(true);
  });

  it('falls back to the slug when the detail carries no prose', async () => {
    const err = await apiErrorFromResponse(
      failing(409, { detail: { error: 'waba_sending_paused' } }), 'fallback',
    );
    expect(err.message).toBe('waba_sending_paused');
    expect(err.code).toBe('waba_sending_paused');
  });

  it('uses the fallback for a detail with only machine fields', async () => {
    // Must never serialise an object into the message.
    const err = await apiErrorFromResponse(
      failing(409, { detail: { code: 131047, retriable: false } }), 'Failed to send message',
    );
    expect(err.message).toBe('Failed to send message');
    expect(err.message).not.toContain('[object');
  });

  it('trims, so whitespace does not pass as a reason', async () => {
    const err = await apiErrorFromResponse(failing(409, { detail: { message: '  Paused  ' } }), 'fb');
    expect(err.message).toBe('Paused');
  });

  it('ignores a blank message and takes the slug', async () => {
    const err = await apiErrorFromResponse(
      failing(409, { detail: { message: '   ', error: 'account_blocked' } }), 'fb',
    );
    expect(err.message).toBe('account_blocked');
  });
});

describe('the detail shapes that already worked still do', () => {
  it('reads a plain-string detail', async () => {
    // Most HTTPExceptions: `raise HTTPException(400, "Language is required")`.
    const err = await apiErrorFromResponse(failing(400, { detail: 'Language is required' }), 'fb');
    expect(err.message).toBe('Language is required');
  });

  it('reads the 422 validation list', async () => {
    const err = await apiErrorFromResponse(failing(422, {
      detail: [
        { loc: ['body', 'name'], msg: 'field required', type: 'value_error.missing' },
        { loc: ['body', 'language'], msg: 'field required', type: 'value_error.missing' },
      ],
    }), 'fb');
    expect(err.message).toBe('field required; field required');
  });

  it('leaves `code` undefined for a list detail rather than inventing one', async () => {
    const err = await apiErrorFromResponse(failing(422, { detail: [{ msg: 'nope' }] }), 'fb');
    expect(err.code).toBeUndefined();
  });
});

describe('Express bodies are untouched', () => {
  // LAD_backend answers with a flat {error}/{message}/{code}. Teaching this
  // helper about objects must not change the other half of the fleet.
  it('reads a top-level error and code', async () => {
    const err = await apiErrorFromResponse(
      failing(409, { error: 'Campaign name taken', code: 'CAMPAIGN_NAME_TAKEN' }), 'fb',
    );
    expect(err.message).toBe('Campaign name taken');
    expect(err.code).toBe('CAMPAIGN_NAME_TAKEN');
  });

  it('honours prefer: message', async () => {
    const body = { error: 'Bad Request', message: 'Start date must precede end date' };
    expect((await apiErrorFromResponse(failing(400, body), 'fb', 'message')).message)
      .toBe('Start date must precede end date');
    expect((await apiErrorFromResponse(failing(400, body), 'fb')).message)
      .toBe('Bad Request');
  });

  it('a top-level code still wins over a detail slug', async () => {
    // detailToCode is a FALLBACK. A body that sends both is an Express route
    // whose own discriminator must not be displaced.
    const err = await apiErrorFromResponse(
      failing(409, { code: 'EXPRESS_CODE', detail: { error: 'fastapi_slug' } }), 'fb',
    );
    expect(err.code).toBe('EXPRESS_CODE');
  });
});

describe('nothing to say', () => {
  it('uses the fallback for an empty body', async () => {
    const err = await apiErrorFromResponse(failing(500, {}), 'Something went wrong');
    expect(err.message).toBe('Something went wrong');
  });

  it('uses the fallback for a non-JSON body', async () => {
    // A Cloud Run HTML error page. Status is still recoverable.
    const res = new Response('<html>502</html>', { status: 502 });
    const err = await apiErrorFromResponse(res, 'Service unavailable');
    expect(err.message).toBe('Service unavailable');
    expect(err.status).toBe(502);
  });

  it('never produces a bare "HTTP 409:" when statusText is empty', async () => {
    // Cloud Run speaks HTTP/2, where statusText is always empty — which is how
    // a generic fallback degrades into no information at all.
    const err = await apiErrorFromResponse(failing(409, OUTSIDE_WINDOW), 'HTTP 409: ');
    expect(err.message.trim()).not.toBe('HTTP 409:');
  });

  it('is an Error, so existing `catch (e) { toast(e.message) }` sites keep working', async () => {
    const err = await apiErrorFromResponse(failing(409, OUTSIDE_WINDOW), 'fb');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
  });
});
