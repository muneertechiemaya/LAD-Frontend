/**
 * Meta Onboarding — useWhatsAppEmbeddedSignup
 *
 * Drives Meta's Embedded Signup dialog end-to-end and hands the result to the
 * backend. Everything non-render lives here so the component stays presentational.
 *
 * ── Why this needs two independent inputs ───────────────────────────────────
 * Meta delivers the signup result over TWO channels that complete in an
 * unpredictable order:
 *
 *   1. A `postMessage` from facebook.com carrying `{ waba_id, phone_number_id,
 *      business_id }` — WHICH account was onboarded.
 *   2. The `FB.login` callback carrying `authResponse.code` — the authorization
 *      code that proves the user consented.
 *
 * Neither is sufficient alone, and the popup can emit the message before or
 * after the callback fires. So both are collected into refs and the exchange
 * fires from whichever arrives second. Refs rather than state deliberately:
 * these are read inside callbacks registered once, where a state closure would
 * capture stale values.
 *
 * ── Cancellation ────────────────────────────────────────────────────────────
 * A user who closes the popup produces a CANCEL event (or a callback with no
 * code). Both are treated as a benign abort — no error surface, no partial
 * state — because a closed popup is a decision, not a failure.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { exchangeWhatsAppSignup, metaOnboardingKeys } from '../api';
import type { WhatsAppAccount, WhatsAppSignupConfig } from '../types';

/** Origins Meta's Embedded Signup popup posts from. */
const META_ORIGINS = ['https://www.facebook.com', 'https://web.facebook.com'];

const SDK_SCRIPT_ID = 'facebook-jssdk';

interface SessionInfo {
  waba_id: string;
  phone_number_id: string;
  business_id?: string;
}

export interface UseWhatsAppEmbeddedSignupOptions {
  config: WhatsAppSignupConfig | null;
  onSuccess?: (account: WhatsAppAccount, warnings: string[]) => void;
}

export interface UseWhatsAppEmbeddedSignupReturn {
  /** Open Meta's signup dialog. No-op unless the SDK is ready. */
  launch: () => void;
  /** SDK script downloaded and FB.init called. */
  isSdkReady: boolean;
  /** Dialog open, or exchange in flight. */
  isConnecting: boolean;
  error: string | null;
  warnings: string[];
  account: WhatsAppAccount | null;
  reset: () => void;
}

/** Load the Meta JS SDK once per page and initialise it. */
function loadFacebookSdk(appId: string, version: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Not in a browser'));
      return;
    }

    const w = window as any;

    const init = () => {
      try {
        w.FB.init({ appId, autoLogAppEvents: true, xfbml: true, version });
        resolve();
      } catch (err) {
        reject(err as Error);
      }
    };

    // The SDK may already be present from an earlier mount — init is idempotent.
    if (w.FB) { init(); return; }

    const existing = document.getElementById(SDK_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      // Another mount is mid-download. fbAsyncInit has already been claimed by
      // that mount, so poll instead of overwriting its handler.
      const started = Date.now();
      const poll = window.setInterval(() => {
        if (w.FB) { window.clearInterval(poll); init(); }
        else if (Date.now() - started > 15000) {
          window.clearInterval(poll);
          reject(new Error('Timed out loading the Meta SDK'));
        }
      }, 100);
      return;
    }

    w.fbAsyncInit = init;

    const script = document.createElement('script');
    script.id    = SDK_SCRIPT_ID;
    script.src   = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.onerror = () => reject(new Error('Failed to load the Meta SDK. Check for an ad blocker.'));
    document.body.appendChild(script);
  });
}

export function useWhatsAppEmbeddedSignup(options: UseWhatsAppEmbeddedSignupOptions): UseWhatsAppEmbeddedSignupReturn {
  const { config, onSuccess } = options;
  const queryClient = useQueryClient();

  const [isSdkReady, setIsSdkReady] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<SessionInfo | null>(null);
  const codeRef    = useRef<string | null>(null);

  const mutation = useMutation({
    mutationFn: exchangeWhatsAppSignup,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: metaOnboardingKeys.whatsappAccounts() });
      onSuccess?.(data.account, data.warnings ?? []);
    },
  });

  // Keep the mutation reachable from the listener/callback without making them
  // depend on a value that changes every render.
  const mutateRef = useRef(mutation.mutate);
  mutateRef.current = mutation.mutate;

  const clearHandshake = useCallback(() => {
    sessionRef.current = null;
    codeRef.current    = null;
  }, []);

  /** Fire the exchange once BOTH halves of the handshake have arrived. */
  const tryExchange = useCallback(() => {
    const session = sessionRef.current;
    const code    = codeRef.current;
    if (!session || !code) return;

    setIsDialogOpen(false);
    mutateRef.current({
      code,
      waba_id:         session.waba_id,
      phone_number_id: session.phone_number_id,
      business_id:     session.business_id,
    });
    clearHandshake();
  }, [clearHandshake]);

  // ── Load the SDK ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!config?.configured || !config.appId) return;
    let cancelled = false;

    loadFacebookSdk(config.appId, config.graphVersion)
      .then(() => { if (!cancelled) setIsSdkReady(true); })
      .catch((err: Error) => { if (!cancelled) setError(err.message); });

    return () => { cancelled = true; };
  }, [config?.configured, config?.appId, config?.graphVersion]);

  // ── Listen for the popup's session-info message ────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handler = (event: MessageEvent) => {
      // Origin check first — this listener is on window, so anything can post.
      if (!META_ORIGINS.includes(event.origin)) return;

      let payload: any;
      try {
        payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return; // Meta also posts non-JSON chatter on these origins.
      }
      if (payload?.type !== 'WA_EMBEDDED_SIGNUP') return;

      if (payload.event === 'FINISH' || payload.event === 'FINISH_ONLY_WABA') {
        const data = payload.data || {};
        if (data.waba_id && data.phone_number_id) {
          sessionRef.current = {
            waba_id:         String(data.waba_id),
            phone_number_id: String(data.phone_number_id),
            business_id:     data.business_id ? String(data.business_id) : undefined,
          };
          tryExchange();
        } else {
          setIsDialogOpen(false);
          clearHandshake();
          setError(
            'Signup finished without a phone number. Add a number to your ' +
            'WhatsApp Business Account and connect again.'
          );
        }
        return;
      }

      if (payload.event === 'CANCEL') {
        // Closing the popup is a decision, not an error.
        setIsDialogOpen(false);
        clearHandshake();
        return;
      }

      if (payload.event === 'ERROR') {
        setIsDialogOpen(false);
        clearHandshake();
        setError(payload.data?.error_message || 'Meta reported an error during signup.');
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [tryExchange, clearHandshake]);

  // ── Launch ─────────────────────────────────────────────────────────────────
  const launch = useCallback(() => {
    const w = window as any;
    if (!isSdkReady || !w.FB || !config?.configId) return;

    setError(null);
    clearHandshake();
    setIsDialogOpen(true);

    w.FB.login(
      (response: any) => {
        const code = response?.authResponse?.code;
        if (!code) {
          // User dismissed the dialog, or denied consent. Benign either way.
          setIsDialogOpen(false);
          clearHandshake();
          return;
        }
        codeRef.current = code;
        tryExchange();
      },
      {
        config_id: config.configId,
        // Must be 'code' — the System User access token is minted server-side
        // by exchanging this code, never handed to the browser.
        response_type: 'code',
        override_default_response_type: true,
        // Matches the snippet Meta's App Dashboard generates for our app's flow
        // version. NOT the pre-v4 `{ setup, featureType, sessionInfoVersion }`
        // shape, and NOT the Graph API version — the backend supplies the value
        // so a Meta-side bump is a config change rather than a redeploy.
        //
        // featureType selects a non-default flow (coexistence, which lets a
        // number stay on the WhatsApp Business App while also reachable over
        // Cloud API). The key is OMITTED when unset rather than sent empty:
        // Meta distinguishes the two, and an unrecognised value makes it reject
        // the dialog. Absent → default onboarding, which rejects any number
        // already on WhatsApp with error #2655122.
        extras: {
          version: config.esVersion,
          ...(config.featureType ? { featureType: config.featureType } : {}),
          ...(config.features ? { features: config.features } : {}),
        },
      }
    );
  }, [isSdkReady, config?.configId, tryExchange, clearHandshake]);

  const reset = useCallback(() => {
    setError(null);
    setIsDialogOpen(false);
    clearHandshake();
    mutation.reset();
  }, [clearHandshake, mutation]);

  const mutationError = mutation.error
    ? ((mutation.error as any)?.response?.data?.error ?? (mutation.error as Error).message)
    : null;

  return {
    launch,
    isSdkReady,
    isConnecting: isDialogOpen || mutation.isPending,
    error: error ?? mutationError,
    warnings: mutation.data?.warnings ?? [],
    account:  mutation.data?.account ?? null,
    reset,
  };
}
