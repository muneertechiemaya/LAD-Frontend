/**
 * Meta Onboarding Feature — Types
 *
 * Covers Meta Embedded Signup through TechieMaya's Tech Provider app.
 * WhatsApp today; Instagram will add its own shapes alongside these.
 */

/** How an account's credentials were obtained. */
export type ConnectionMethod = 'manual' | 'embedded_signup';

/**
 * Browser config for Meta's Embedded Signup dialog.
 * `appId` and `configId` are not secrets — they ship in every Meta JS SDK
 * integration. The app secret never reaches the browser.
 */
export interface WhatsAppSignupConfig {
  appId: string;
  configId: string;
  /** e.g. "v23.0" — must match what the JS SDK is initialised with. */
  graphVersion: string;
  /**
   * Embedded Signup flow version, passed to FB.login as `extras.version`
   * (e.g. "v4"). Distinct from `graphVersion` — conflating the two produces a
   * dialog that fails inside Meta's popup. Server-supplied so a Meta-side
   * version bump is a config change, not a frontend redeploy.
   */
  esVersion: string;
  /**
   * Optional Embedded Signup flow selector, passed through as
   * `extras.featureType`. Its main use is COEXISTENCE — letting a number keep
   * running on the WhatsApp Business App while also reachable over Cloud API.
   *
   * null means "omit the key entirely" and run Meta's DEFAULT onboarding flow,
   * which requires the number not to be on WhatsApp at all and otherwise fails
   * with "#2655122 already registered to a WhatsApp account".
   */
  featureType: string | null;
  /**
   * A SEPARATE extras key from featureType — the dashboard's "Features"
   * multi-select, where coexistence lives as `app_only_install`. Forwarded
   * verbatim because Meta owns the element shape; null omits the key.
   */
  features: unknown[] | null;
  /**
   * False when the environment is missing app ID, config ID, or app secret.
   * The connect button stays disabled: a dialog opened without a config_id
   * fails inside Meta's popup with an error the tenant cannot act on.
   */
  configured: boolean;
}

/** A connected WhatsApp account. Never carries token material. */
export interface WhatsAppAccount {
  id: string;
  tenant_id: string;
  slug: string;
  display_name: string;
  phone_number_id: string | null;
  business_account_id: string | null;
  display_phone_number: string | null;
  meta_business_id: string | null;
  connection_method: ConnectionMethod;
  ai_model: string | null;
  timezone: string | null;
  conversation_flow_template: string | null;
  status: string;
  last_verified_at: string | null;
  token_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

/** What Meta's popup hands back on a successful signup. */
export interface EmbeddedSignupResult {
  code: string;
  waba_id: string;
  phone_number_id: string;
  /** Meta Business portfolio id — display only, absent on older session versions. */
  business_id?: string;
}

export interface ExchangeSignupRequest extends EmbeddedSignupResult {
  ai_model?: string;
}

/**
 * Exchange response. `warnings` is non-empty when the account connected but
 * something non-fatal failed — most commonly phone registration — so the UI
 * can show "connected, but…" instead of a success that hides a broken send path.
 */
export interface ExchangeSignupResponse {
  success: boolean;
  account: WhatsAppAccount;
  warnings: string[];
}

export interface WhatsAppAccountsResponse {
  success: boolean;
  accounts: WhatsAppAccount[];
}

export interface DisconnectResponse {
  success: boolean;
  disconnected: boolean;
  warnings: string[];
}
