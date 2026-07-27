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
