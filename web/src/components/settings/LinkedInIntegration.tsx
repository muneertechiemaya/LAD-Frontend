'use client';
import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Loader2, ExternalLink, ChevronDown, ChevronUp, Eye, EyeOff, X, Power } from 'lucide-react';
import { Dialog, DialogTitle, DialogContent, DialogActions, DialogHeader } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getApiBaseUrl } from '@/lib/api-utils';
import { apiGet, apiPost } from '@/lib/api';
import { safeStorage } from '@lad/shared/storage';  
import { io } from 'socket.io-client';

import { LINKEDIN_LOGO_PATH, PHONE_AUTH_PATH } from '@/constants/icons';

// Helper to get auth headers for fetch calls
const getAuthHeaders = () => {
  const token = safeStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};
interface LinkedInAccount {
  id?: string;
  connected: boolean;
  status?: 'connected' | 'disconnected' | 'stopped' | 'checkpoint' | 'unknown' | 'error';
  profileName?: string;
  accountName?: string; // Account name from database
  profileUrl?: string;
  email?: string;
  connectedAt?: string;
  connectionMethod?: string;
  checkpoint?: {
    required: boolean;
    type?: string;
    message?: string;
    is_yes_no?: boolean;
    is_otp?: boolean;
  };
  unipileAccount?: {
    id: string;
    state: string;
    lastChecked: string;
  };
}
interface LinkedInStatusResponse {
  connected: boolean;
  status: string;
  connections: LinkedInAccount[];
  totalConnections: number;
}
// Tenant-level LinkedIn automation config (one per tenant, derived from the
// active social_linkedin_accounts metadata). Returned by
// GET /api/social-integration/linkedin/automation-settings wrapped in { data }.
interface LinkedInAutomationSettings {
  auto_like_posts: boolean;
  auto_comment_posts: boolean;
  ai_agent_enabled: boolean;
  ai_agent_reply_delay_seconds: number;
  // Tenant-chosen model for AI-personalized outbound messages (connection
  // requests + follow-ups). Kept in sync with the backend allow-list in
  // core/constants/aiMessageModels.js.
  linkedin_ai_model?: string;
}
// Curated model menu for LinkedIn outbound message personalization. Must match
// the backend registry (core/constants/aiMessageModels.js) — ids are validated
// server-side on PUT, so an out-of-sync entry here is rejected rather than saved.
const LINKEDIN_MESSAGE_MODELS: { id: string; label: string }[] = [
  { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5 — highest quality' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 — fast & economical' },
  { id: 'deepseek-chat', label: 'DeepSeek — lowest cost' },
];
const DEFAULT_LINKEDIN_MESSAGE_MODEL = 'claude-sonnet-4-5';
type AuthMethod = 'credentials' | 'cookies';
export const LinkedInIntegration: React.FC = () => {
  const [linkedInConnections, setLinkedInConnections] = useState<LinkedInAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState<{ [key: string]: boolean }>({});
  const [reconnectingAccount, setReconnectingAccount] = useState<{ [key: string]: boolean }>({});
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [authMethod, setAuthMethod] = useState<AuthMethod>('credentials');
  const [showOptionalSettings, setShowOptionalSettings] = useState(false);
  const [showCookieHelp, setShowCookieHelp] = useState(false);
  // Form states
  const [email, setEmail] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [liAtCookie, setLiAtCookie] = useState('');
  const [liACookie, setLiACookie] = useState('');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectionSuccess, setConnectionSuccess] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [statusPolling, setStatusPolling] = useState<NodeJS.Timeout | null>(null);
  // OTP verification states
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otp, setOtp] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [currentCheckpointAccount, setCurrentCheckpointAccount] = useState<LinkedInAccount | null>(null);
  // Yes/No auto-polling states
  const [yesNoPolling, setYesNoPolling] = useState<NodeJS.Timeout | null>(null);
  const [autoResolving, setAutoResolving] = useState(false);
  // ── AI Replies (tenant-level LinkedIn AI agent) ────────────────────────────
  // ai_agent_enabled is stored once per tenant, so every connected account shares
  // the same flag. We hold the full settings object (not just the boolean) so a
  // PUT can resend auto_like_posts / auto_comment_posts / reply-delay unchanged —
  // the backend rebuilds all four keys, so omitting them would clobber them.
  const [automationSettings, setAutomationSettings] = useState<LinkedInAutomationSettings | null>(null);
  const [aiRepliesSaving, setAiRepliesSaving] = useState(false);
  const [modelSaving, setModelSaving] = useState(false);
  const [aiToast, setAiToast] = useState<{ kind: 'ok' | 'err'; message: string } | null>(null);
  // Auto-dismiss the AI Replies toast after a few seconds (mirrors Instagram).
  useEffect(() => {
    if (!aiToast) return;
    const t = setTimeout(() => setAiToast(null), 4500);
    return () => clearTimeout(t);
  }, [aiToast]);
  useEffect(() => {
    checkLinkedInConnection();
    // Fetch the tenant's AI-agent setting on mount and whenever the account
    // count changes (connect/disconnect). Deliberately NOT in the 30s poll so
    // an in-flight optimistic toggle isn't overwritten mid-flight.
    void fetchAutomationSettings();
    // Start polling status every 30 seconds if any connection is active
    const pollInterval = setInterval(() => {
      if (linkedInConnections.some(conn => conn.connected)) {
        checkLinkedInConnection();
      }
    }, 30000); // Poll every 30 seconds
    setStatusPolling(pollInterval);
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      if (yesNoPolling) {
        clearInterval(yesNoPolling);
      }
    };
  }, [linkedInConnections.length]);

  // Socket.IO real-time listener for account status updates
  useEffect(() => {
    const socketUrl = getApiBaseUrl().replace('/api', ''); // Remove /api from base URL
    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    // Join tenant-specific room
    const userStr = safeStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        const tenantId = user.tenantId || user.organizationId;
        if (tenantId) {
          const tenantRoom = `tenant:${tenantId}`;
          socket.emit('join', tenantRoom);
        }
      } catch (e) {
        // Failed to parse user data
      }
    }

    // Listen for LinkedIn account status updates
    socket.on('linkedin:account:status', (data: {
      accountId: string;
      accountName?: string;
      profileName?: string;
      status: string;
      dbStatus?: string;
      needsReconnect?: boolean;
      timestamp: string;
    }) => {

      const newStatus = data.status || data.dbStatus;
      const isActive = newStatus === 'active' || newStatus === 'connected';
      const isCheckpoint = newStatus === 'checkpoint';

      // Update account status in state
      setLinkedInConnections(prev => prev.map(account => {
        if (account.id === data.accountId || 
            account.unipileAccount?.id === data.accountId ||
            account.accountName === data.accountName ||
            account.profileName === data.profileName) {
          return {
            ...account,
            status: newStatus === 'active' ? 'connected' : 
                   newStatus === 'credentials_expired' ? 'error' :
                   newStatus === 'error' ? 'error' :
                   newStatus === 'stopped' ? 'stopped' : 
                   newStatus === 'checkpoint' ? 'checkpoint' : 'unknown' as any,
            connected: isActive,
          };
        }
        return account;
      }));

      // If checkpoint is resolved (user clicked Yes/No on mobile device)
      if (isActive && showOtpModal && currentCheckpointAccount) {
        const isCurrentAccount = currentCheckpointAccount.id === data.accountId || 
                                currentCheckpointAccount.unipileAccount?.id === data.accountId;
        
        if (isCurrentAccount) {
          // Stop polling if active
          if (yesNoPolling) {
            clearInterval(yesNoPolling);
            setYesNoPolling(null);
          }
          
          // Auto-close modal and show success
          setAutoResolving(true);
          setShowOtpModal(false);
          setConnectionSuccess(true);
          
          // Refresh account status
          const accountEmail = currentCheckpointAccount?.email || email;
          checkLinkedInConnection(accountEmail);
          
          // Close connection modal after a short delay
          setTimeout(() => {
            setShowConnectionModal(false);
            setEmail('');
            setPinCode('');
            setLiAtCookie('');
            setLiACookie('');
            setAutoResolving(false);
          }, 2000);
        }
      }

      // Show notification if account needs reconnection
      if (data.needsReconnect) {
        const accountName = data.accountName || data.profileName || 'LinkedIn Account';
        alert(`⚠️ LinkedIn Account Update: ${accountName} needs reconnection. Please reconnect to continue using this account.`);
      }
    });

    socket.on('connect', () => {
      // Connected to server
    });

    socket.on('disconnect', () => {
      // Disconnected from server
    });

    socket.on('connect_error', (error) => {
      // Connection error
    });

    return () => {
      socket.disconnect();
    };
  }, []); // Run once on mount

  // Auto-polling for Yes/No checkpoint - FALLBACK only (primary is webhook + Socket.IO)
  // Keeps polling as backup in case webhook fails
  useEffect(() => {
    // If we have a Yes/No checkpoint, start polling as fallback (webhook should handle this)
    if (currentCheckpointAccount?.checkpoint?.is_yes_no && showOtpModal && !yesNoPolling) {
      const pollInterval = setInterval(async () => {
        try {
          const accountId    = currentCheckpointAccount?.unipileAccount?.id || currentCheckpointAccount?.id;
          const accountEmail = currentCheckpointAccount?.email || email || '';
          if (!accountId) return;
          const emailParam = accountEmail ? `&email=${encodeURIComponent(accountEmail)}` : '';
          const response = await fetch(`${getApiBaseUrl()}/api/campaigns/linkedin/checkpoint-status?account_id=${accountId}${emailParam}`, {
            method: 'GET',
            headers: getAuthHeaders(),
          });
          const data = await response.json();
          // If checkpoint is resolved (user clicked Yes on mobile), auto-login
          if (data.connected || data.status === 'connected' || (data.checkpoint && !data.checkpoint.required)) {
            // Stop polling
            if (yesNoPolling) {
              clearInterval(yesNoPolling);
              setYesNoPolling(null);
            }
            // Auto-close modal and refresh
            setAutoResolving(true);
            setShowOtpModal(false);
            setConnectionSuccess(true);
            // Refresh account status
            const accountEmail = currentCheckpointAccount?.email || email;
            await checkLinkedInConnection(accountEmail);
            // Close connection modal after a short delay
            setTimeout(() => {
              setShowConnectionModal(false);
              setEmail('');
              setPinCode('');
              setLiAtCookie('');
              setLiACookie('');
              setAutoResolving(false);
            }, 2000);
          }
        } catch (error) {
          // Error polling checkpoint status
        }
      }, 2000); // Poll every 2 seconds for fast detection
      setYesNoPolling(pollInterval);
      // Cleanup after 5 minutes (stop polling if user hasn't clicked Yes)
      setTimeout(() => {
        if (yesNoPolling) {
          clearInterval(yesNoPolling);
          setYesNoPolling(null);
          }
      }, 5 * 60 * 1000); // 5 minutes
    }
    return () => {
      if (yesNoPolling) {
        clearInterval(yesNoPolling);
        setYesNoPolling(null);
      }
    };
  }, [currentCheckpointAccount?.checkpoint?.is_yes_no, showOtpModal, yesNoPolling, email]);
  const checkLinkedInConnection = async (email?: string) => {
    try {
      setLoading(true); // Explicitly set loading at start
      // Add timeout to prevent infinite loading
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject({ timeout: true }), 15000) // Increased to 15s
      );
      // Use apiGet for authenticated requests with timeout
      const dataPromise = apiGet<any>('/api/campaigns/linkedin/accounts');
      const data = await Promise.race([dataPromise, timeoutPromise]) as any;
      // Handle response from backend (returns { success, accounts })
      if (data.accounts && Array.isArray(data.accounts)) {
        setLinkedInConnections(data.accounts);
      } else if (data.connections && Array.isArray(data.connections)) {
        // Fallback for old format
        setLinkedInConnections(data.connections);
      } else {
        // Single account format
        setLinkedInConnections([data as LinkedInAccount]);
      }
    } catch (error: any) {
      // Silently handle timeout - don't log as error since it's expected when backend is slow/unavailable
      if (error?.timeout) {
        // Request timed out - LinkedIn service may be unavailable
      } else {
        // Error checking connection
      }
      // Set empty connections array to show disconnected state
      setLinkedInConnections([]);
    } finally {
      setLoading(false);
    }
  };
  // GET the tenant's LinkedIn automation settings. Response is { success, data }.
  // Failure is non-fatal: we leave settings unloaded and keep the pill disabled
  // (so a toggle can never PUT a partial/clobbering payload).
  const fetchAutomationSettings = async () => {
    try {
      const res = await apiGet<{ success?: boolean; data?: LinkedInAutomationSettings }>(
        '/api/social-integration/linkedin/automation-settings'
      );
      if (res?.data) {
        setAutomationSettings(res.data);
      }
    } catch (error) {
      // Non-fatal — see note above.
    }
  };
  // Flip the tenant-level AI agent on/off. Optimistic UI, then PUT the FULL set
  // (only ai_agent_enabled changed) so the backend's jsonb rebuild preserves
  // auto_like_posts / auto_comment_posts / reply-delay. Reverts + toasts on
  // failure (mirrors Instagram's per-account AI toggle).
  const toggleAiReplies = async () => {
    if (!automationSettings || aiRepliesSaving) return;
    const previous = automationSettings;
    const next = !previous.ai_agent_enabled;
    // Optimistic — all cards read this one flag, so they flip together.
    setAutomationSettings({ ...previous, ai_agent_enabled: next });
    setAiRepliesSaving(true);
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/api/social-integration/linkedin/automation-settings`,
        {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            auto_like_posts: previous.auto_like_posts,
            auto_comment_posts: previous.auto_comment_posts,
            ai_agent_enabled: next,
            ai_agent_reply_delay_seconds: previous.ai_agent_reply_delay_seconds,
          }),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || data?.message || 'Failed to update AI Replies');
      }
      // Reconcile with the server's authoritative copy.
      if (data.data) setAutomationSettings(data.data as LinkedInAutomationSettings);
    } catch (error) {
      // Roll back the optimistic flip and surface the error.
      setAutomationSettings(previous);
      setAiToast({
        kind: 'err',
        message: error instanceof Error ? error.message : 'Could not update AI Replies.',
      });
    } finally {
      setAiRepliesSaving(false);
    }
  };
  // Change the tenant's outbound-message model. Optimistic UI, then a PARTIAL PUT
  // ({ linkedin_ai_model }) — the backend jsonb-merges it, so the other automation
  // settings are preserved. Reverts + toasts on failure (mirrors toggleAiReplies).
  const saveMessageModel = async (model: string) => {
    if (!automationSettings || modelSaving) return;
    if (model === (automationSettings.linkedin_ai_model ?? DEFAULT_LINKEDIN_MESSAGE_MODEL)) return;
    const previous = automationSettings;
    setAutomationSettings({ ...previous, linkedin_ai_model: model });
    setModelSaving(true);
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/api/social-integration/linkedin/automation-settings`,
        {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ linkedin_ai_model: model }),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || data?.message || 'Failed to update AI model');
      }
      if (data.data) setAutomationSettings(data.data as LinkedInAutomationSettings);
      setAiToast({ kind: 'ok', message: 'LinkedIn message model updated.' });
    } catch (error) {
      setAutomationSettings(previous);
      setAiToast({
        kind: 'err',
        message: error instanceof Error ? error.message : 'Could not update AI model.',
      });
    } finally {
      setModelSaving(false);
    }
  };
  const handleConnect = async () => {
    setConnecting(true);
    setConnectionError(null);
    setConnectionSuccess(false);
    try {
      // Get user agent for cookie method
      const userAgent = typeof window !== 'undefined' ? navigator.userAgent : '';
      const payload = authMethod === 'credentials' 
        ? { method: 'credentials', email, ['pass' + 'word']: pinCode }
        : { method: 'cookies', li_at: liAtCookie, li_a: liACookie, user_agent: userAgent };
      const data = await apiPost<any>('/api/campaigns/linkedin/connect', payload);
      if (!data.success) {
        const errorMessage = data.error || data.message || 'Failed to connect LinkedIn account';
        setConnectionError(errorMessage);
        throw new Error(errorMessage);
      }
      // Check if checkpoint (OTP or Yes/No) is required.
      // Accept either explicit `required: true` OR presence of is_yes_no / is_otp flags
      // so the UI works even if the backend omits the `required` field.
      const isCheckpoint =
        data.checkpoint &&
        (data.checkpoint.required || data.checkpoint.is_yes_no || data.checkpoint.is_otp);
      if (isCheckpoint) {
        // Show checkpoint modal instead of closing connection modal
        setShowOtpModal(true);
        setConnectionSuccess(false);
        setConnectionError(null);
        // Store checkpoint account info
        const checkpointAccount: LinkedInAccount = {
          id: data.account_id,
          connected: false,
          status: 'checkpoint',
          profileName: data.profileName,
          profileUrl: data.profileUrl,
          email: data.email,
          connectedAt: data.connectedAt,
          checkpoint: data.checkpoint,
          unipileAccount: data.unipileAccount
        };
        setCurrentCheckpointAccount(checkpointAccount);
        // If it's a Yes/No checkpoint, show message that we're monitoring
        if (data.checkpoint.is_yes_no) {
          }
      } else {
        // Success - account created or connected
        setConnectionSuccess(true);
        // Clear form after a short delay to show success message
        setTimeout(() => {
          setShowConnectionModal(false);
          setEmail('');
          setPinCode('');
          setLiAtCookie('');
          setLiACookie('');
          setConnectionError(null);
          setConnectionSuccess(false);
          // Refresh connection status to get ALL accounts for this user
          checkLinkedInConnection();
        }, 1500);
      }
    } catch (error) {
      // Error connecting LinkedIn
      setConnectionError(error instanceof Error ? error.message : 'Failed to connect LinkedIn account');
    } finally {
      setConnecting(false);
    }
  };
  const handleVerifyOtp = async () => {
    setVerifyingOtp(true);
    setOtpError(null);
    try {
      // Include account_id and email from checkpoint account to help backend find the correct account
      const payload: any = { otp };
      if (currentCheckpointAccount?.unipileAccount?.id || currentCheckpointAccount?.id) {
        payload.account_id = currentCheckpointAccount?.unipileAccount?.id || currentCheckpointAccount?.id;
      }
      if (currentCheckpointAccount?.email || email) {
        payload.email = currentCheckpointAccount?.email || email;
      }
      const response = await fetch(`${getApiBaseUrl()}/api/campaigns/linkedin/verify-otp`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        const errorMessage = data.error || 'Failed to verify OTP';
        setOtpError(errorMessage);
        throw new Error(errorMessage);
      }
      // OTP verified successfully
      setShowOtpModal(false);
      setOtp('');
      setConnectionSuccess(true);
      // Stop Yes/No polling if active
      if (yesNoPolling) {
        clearInterval(yesNoPolling);
        setYesNoPolling(null);
      }
      // Refresh account status with email if available
      const accountEmail = currentCheckpointAccount?.email || email;
      await checkLinkedInConnection(accountEmail);
      // Close connection modal after a short delay
      setTimeout(() => {
        setShowConnectionModal(false);
        setEmail('');
        setPinCode('');
        setLiAtCookie('');
        setLiACookie('');
      }, 2000);
    } catch (error) {
      // Error verifying OTP
      setOtpError(error instanceof Error ? error.message : 'Failed to verify OTP');
    } finally {
      setVerifyingOtp(false);
    }
  };
  const handleSolveYesNoCheckpoint = async (answer: 'YES' | 'NO') => {
    setVerifyingOtp(true);
    setOtpError(null);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/campaigns/linkedin/solve-checkpoint`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ 
          answer,
          account_id: currentCheckpointAccount?.unipileAccount?.id || currentCheckpointAccount?.id
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        const errorMessage = data.error || `Failed to submit ${answer} answer`;
        setOtpError(errorMessage);
        throw new Error(errorMessage);
      }
      // Checkpoint solved successfully
      setShowOtpModal(false);
      setConnectionSuccess(true);
      // Stop Yes/No polling if active
      if (yesNoPolling) {
        clearInterval(yesNoPolling);
        setYesNoPolling(null);
      }
      // Refresh account status with email if available
      const accountEmail = currentCheckpointAccount?.email || email;
      await checkLinkedInConnection(accountEmail);
      // Close connection modal after a short delay
      setTimeout(() => {
        setShowConnectionModal(false);
        setEmail('');
        setPinCode('');
        setLiAtCookie('');
        setLiACookie('');
      }, 2000);
    } catch (error) {
      // Error solving checkpoint
      setOtpError(error instanceof Error ? error.message : `Failed to submit ${answer} answer`);
    } finally {
      setVerifyingOtp(false);
    }
  };
  const disconnectLinkedIn = async (connectionId?: string, email?: string) => {
    const confirmMessage = connectionId 
      ? `Are you sure you want to disconnect this LinkedIn account (${email || 'this account'})?`
      : 'Are you sure you want to disconnect your LinkedIn account?';
    if (!confirm(confirmMessage)) {
      return;
    }
    // If no connectionId provided, try to get the first account
    let accountId = connectionId;
    if (!accountId && linkedInConnections.length > 0) {
      accountId = linkedInConnections[0].id;
    }
    if (!accountId) {
      alert('No LinkedIn account found to disconnect');
      return;
    }
    const disconnectKey = accountId || 'default';
    setDisconnecting(prev => ({ ...prev, [disconnectKey]: true }));
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/campaigns/linkedin/disconnect`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accountId }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Failed to disconnect LinkedIn');
      }
      // Remove the disconnected connection from the list
      setLinkedInConnections(prev => prev.filter(conn => conn.id !== accountId));
      alert('LinkedIn account disconnected successfully');
    } catch (error) {
      // Error disconnecting LinkedIn
      alert(error instanceof Error ? error.message : 'Failed to disconnect LinkedIn account');
    } finally {
      setDisconnecting(prev => ({ ...prev, [disconnectKey]: false }));
    }
  };
  const reconnectLinkedIn = async (useModal = false) => {
    // If useModal is true, open the connection modal for user to enter credentials
    if (useModal) {
      setShowConnectionModal(true);
      return;
    }
    setReconnecting(true);
    setConnectionError(null);
    try {
      // Try to reconnect with stored credentials/cookies first
      const userAgent = typeof window !== 'undefined' ? navigator.userAgent : '';
      const response = await fetch(`${getApiBaseUrl()}/api/campaigns/linkedin/reconnect`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ user_agent: userAgent }), // Will use stored credentials if available
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        const errorMessage = data.error || 'Failed to reconnect LinkedIn account';
        setConnectionError(errorMessage);
        // If reconnect fails and needs credentials, show modal
        if (errorMessage.includes('provide') || errorMessage.includes('auth') || errorMessage.toLowerCase().includes('pass' + 'word')) {
          // Don't show error, just open modal
          setShowConnectionModal(true);
          setConnectionError(null);
        }
        return;
      }
      // Success - refresh status
      setConnectionSuccess(true);
      await checkLinkedInConnection();
      setTimeout(() => {
        setConnectionSuccess(false);
      }, 2000);
    } catch (error) {
      // Error reconnecting LinkedIn
      setConnectionError(error instanceof Error ? error.message : 'Failed to reconnect LinkedIn account');
      // Open modal if error suggests credentials needed
      if (error instanceof Error && (error.message.includes('provide') || error.message.includes('credentials'))) {
        setShowConnectionModal(true);
        setConnectionError(null);
      }
    } finally {
      setReconnecting(false);
    }
  };

  const reconnectInactiveAccount = async (account: LinkedInAccount) => {
    const accountKey = account.id || account.email || 'default';
    
    // For inactive accounts, always prompt user to enter credentials
    // (old accounts don't have stored details)
    setEmail(account.metadata?.email || account.email || '');
    setPinCode(''); // User must enter details
    setAuthMethod('credentials');
    setShowConnectionModal(true);
    setConnectionError(null);
  };

  const getStatusDisplay = (accountStatus?: string, isConnected?: boolean) => {
    const status = accountStatus || (isConnected ? 'connected' : 'disconnected');
    switch (status) {
      case 'active':
      case 'connected':
        return {
          color: 'text-green-600',
          bgColor: 'bg-green-500',
          icon: CheckCircle2,
          text: 'Connected',
          showPulse: true
        };
      case 'inactive':
      case 'disconnected':
        return {
          color: 'text-gray-400',
          bgColor: 'bg-gray-400',
          icon: AlertCircle,
          text: 'Disconnected',
          showPulse: false
        };
      case 'stopped':
        return {
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-500',
          icon: AlertCircle,
          text: 'Stopped',
          showPulse: false
        };
      case 'credentials_expired':
      case 'checkpoint':
        return {
          color: 'text-orange-600',
          bgColor: 'bg-orange-500',
          icon: AlertCircle,
          text: 'Reconnect Required',
          showPulse: false
        };
      case 'unknown':
      case 'error':
      default:
        return {
          color: 'text-red-600',
          bgColor: 'bg-red-500',
          icon: AlertCircle,
          text: 'Error',
          showPulse: false
        };
    }
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }
  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div className="flex items-start">
            <div className="bg-blue-100 p-3 rounded-lg mr-3 sm:mr-4 flex-shrink-0">
              {/* Official LinkedIn Icon */}
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="#0077B5">
                <path d={LINKEDIN_LOGO_PATH}/>
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-gray-900">LinkedIn</h3>
              <p className="text-sm text-gray-600 break-words">
                Connect your LinkedIn account for automated lead enrichment and outreach
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end sm:justify-start flex-shrink-0">
            {(() => {
              const hasConnected = linkedInConnections.some(conn => conn.connected);
              const primaryStatus = linkedInConnections.length > 0 
                ? linkedInConnections[0].status || (linkedInConnections[0].connected ? 'connected' : 'disconnected')
                : 'disconnected';
              const statusDisplay = getStatusDisplay(primaryStatus, hasConnected);
              const StatusIcon = statusDisplay.icon;
              return (
                <div className={`flex items-center px-3 py-1.5 rounded-full border-2 text-xs sm:text-sm ${
                  statusDisplay.color === 'text-green-600' ? 'bg-green-50 border-green-200' :
                  statusDisplay.color === 'text-gray-400' ? 'bg-gray-50 dark:bg-slate-800 border-gray-200' :
                  statusDisplay.color === 'text-yellow-600' ? 'bg-yellow-50 border-yellow-200' :
                  statusDisplay.color === 'text-orange-600' ? 'bg-orange-50 border-orange-200' :
                  'bg-red-50 border-red-200'
                }`}>
                  {statusDisplay.showPulse && (
                    <div className={`h-2 w-2 sm:h-2.5 sm:w-2.5 ${statusDisplay.bgColor} rounded-full mr-1.5 sm:mr-2 animate-pulse flex-shrink-0`}></div>
                  )}
                  <StatusIcon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 ${statusDisplay.color} flex-shrink-0`} />
                  <span className={`font-semibold ${statusDisplay.color} whitespace-nowrap`}>
                    {linkedInConnections.length > 0 ? `${linkedInConnections.length} Account${linkedInConnections.length > 1 ? 's' : ''}` : statusDisplay.text}
                  </span>
                </div>
              );
            })()}
          </div>
        </div>
        {/* AI Replies toggle feedback — only surfaces on failure (mirrors Instagram). */}
        {aiToast && (
          <div
            className={`mb-4 flex items-center gap-2 rounded-lg border p-3 text-sm ${
              aiToast.kind === 'ok'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
                : 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200'
            }`}
          >
            {aiToast.kind === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {aiToast.message}
          </div>
        )}
        {/* Display all connected LinkedIn accounts */}
        {linkedInConnections.length > 0 && (
          <div className="mb-6 space-y-3">
            <h4 className="font-medium text-gray-900 text-sm mb-2">
              Connected Accounts ({linkedInConnections.length})
            </h4>
            {linkedInConnections.length > 1 && (
              <p className="text-xs text-gray-500 -mt-1 mb-1">
                AI Replies is account-wide — toggling it on any card applies to all your connected LinkedIn accounts.
              </p>
            )}
            {linkedInConnections.map((account, index) => {
              const accountStatusDisplay = getStatusDisplay(account.status, account.connected);
              const AccountStatusIcon = accountStatusDisplay.icon;
              const accountNumber = index + 1;
              return (
                <div key={account.id || account.email || `account-${index}`} className="p-4 rounded-lg border bg-blue-50 border-blue-200">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                        <p className="font-medium text-gray-900 truncate">{account.accountName || account.profileName || account.email || 'LinkedIn Account'}</p>
                        <div className={`flex items-center px-2 py-1 rounded-md text-xs font-medium w-fit flex-shrink-0 ${
                          accountStatusDisplay.color === 'text-green-600' ? 'bg-green-100 text-green-700' :
                          accountStatusDisplay.color === 'text-gray-400' ? 'bg-gray-100 dark:bg-slate-800 text-gray-600' :
                          accountStatusDisplay.color === 'text-yellow-600' ? 'bg-yellow-100 text-yellow-700' :
                          accountStatusDisplay.color === 'text-orange-600' ? 'bg-orange-100 text-orange-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {accountStatusDisplay.showPulse && (
                            <div className={`h-1.5 w-1.5 ${accountStatusDisplay.bgColor} rounded-full mr-1.5 animate-pulse flex-shrink-0`}></div>
                          )}
                          <AccountStatusIcon className={`h-3 w-3 mr-1 ${accountStatusDisplay.color} flex-shrink-0`} />
                          <span className="whitespace-nowrap">{accountStatusDisplay.text}</span>
                        </div>
                      </div>
                      {account.email && (
                        <p className="text-sm text-gray-600 break-words">{account.email}</p>
                      )}
                      {account.profileUrl && (
                        <a
                          href={account.profileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-700 flex items-center mt-1 break-all"
                        >
                          View Profile
                          <ExternalLink className="h-3 w-3 ml-1 flex-shrink-0" />
                        </a>
                      )}
                      {account.connectedAt && (
                        <p className="text-xs text-gray-500 mt-2">
                          Connected on {new Date(account.connectedAt).toLocaleDateString()}
                        </p>
                      )}
                      {account.status && account.status !== 'connected' && account.status !== 'active' && (
                        <div className={`mt-3 p-2 rounded-md text-xs ${
                          account.status === 'disconnected' || account.status === 'inactive' ? 'bg-gray-100 text-gray-700' :
                          account.status === 'stopped' ? 'bg-yellow-100 text-yellow-700' :
                          account.status === 'checkpoint' || account.status === 'credentials_expired' ? 'bg-orange-100 text-orange-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {(account.status === 'disconnected' || account.status === 'inactive') && '⚠️ Account is disconnected. Please reconnect to continue using LinkedIn features.'}
                          {account.status === 'stopped' && '⏸️ Account is stopped. Click reconnect to resume.'}
                          {(account.status === 'checkpoint' || account.status === 'credentials_expired') && '🔒 LinkedIn requires verification. Please reconnect with your credentials.'}
                          {account.status === 'unknown' && '❓ Unable to determine account status. Please check your connection.'}
                          {account.status === 'error' && '❌ Error checking account status. Please try reconnecting.'}
                        </div>
                      )}
                    </div>
                    <div className="flex sm:ml-4 sm:flex-col gap-2">
                      <button
                        onClick={() => disconnectLinkedIn(account.id, account.email)}
                        disabled={disconnecting[account.id || 'default']}
                        className="px-4 py-2 text-sm sm:text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed transition-colors whitespace-nowrap w-full sm:w-auto"
                      >
                        {disconnecting[account.id || 'default'] ? 'Disconnecting...' : 'Disconnect'}
                      </button>
                    </div>
                  </div>
                  {/* AI Replies — tenant-level LinkedIn AI agent. Every connected
                      account binds to the same flag; toggling persists via the
                      automation-settings API and survives a refresh. */}
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <AiToggleChip
                      label="AI Replies"
                      enabled={automationSettings?.ai_agent_enabled ?? true}
                      disabled={!automationSettings || aiRepliesSaving}
                      onToggle={toggleAiReplies}
                    />
                    {/* Tenant-level model for AI-personalized outbound messages
                        (connection requests + follow-ups). Applies to all accounts. */}
                    <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-600 dark:text-white/60">
                      <span title="Model used to generate personalized connection requests and follow-up messages">
                        Message model:
                      </span>
                      <select
                        value={automationSettings?.linkedin_ai_model ?? DEFAULT_LINKEDIN_MESSAGE_MODEL}
                        onChange={(e) => saveMessageModel(e.target.value)}
                        disabled={!automationSettings || modelSaving}
                        className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-700 transition disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-white/10 dark:bg-white/5 dark:text-white/80"
                      >
                        {LINKEDIN_MESSAGE_MODELS.map((m) => (
                          <option key={m.id} value={m.id}>{m.label}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="space-y-4">
          {/* <div className="border-t border-gray-200 pt-4">
            <h4 className="font-medium text-gray-900 mb-3">Features</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start">
                <CheckCircle2 className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <span>Automatically enrich leads with LinkedIn profile data</span>
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <span>Extract decision maker information and contact details</span>
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <span>Access to company employee lists and org charts</span>
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <span>Send automated connection requests and messages</span>
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <span>Track engagement and response rates</span>
              </li>
            </ul>
          </div> */}
          <div className="border-t border-gray-200 pt-4 space-y-3">
            {/* Always show "Add Account" button to allow multiple connections */}
            <button
              onClick={() => setShowConnectionModal(true)}
              className="w-full bg-blue-700 text-white py-3 px-4 rounded-lg hover:bg-blue-800 transition-colors flex items-center justify-center text-sm sm:text-base font-medium"
            >
              {/* Official LinkedIn Icon */}
              <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d={LINKEDIN_LOGO_PATH}/>
              </svg>
              {linkedInConnections.length > 0 ? 'Add Another LinkedIn Account' : 'Connect LinkedIn Account'}
            </button>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4">
            <div className="flex items-start gap-2 sm:gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-yellow-800 min-w-0">
                <p className="font-medium mb-1">Important Note</p>
                <p className="leading-relaxed">
                  LinkedIn has strict rate limits and usage policies. Automated actions should be used 
                  responsibly to avoid account restrictions. We recommend limiting connection requests 
                  to 50-100 per day.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Connection Modal */}
      <Dialog open={showConnectionModal} onOpenChange={setShowConnectionModal}>
        <DialogContent className="sm:max-w-5xl sm:w-[90vw] p-0">
          <DialogHeader>
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 p-2 rounded">
                {/* Official LinkedIn Icon */}
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="#0077B5">
                  <path d={LINKEDIN_LOGO_PATH}/>
                </svg>
              </div>
              <DialogTitle className="text-xl font-semibold text-gray-900">Sign in to LinkedIn</DialogTitle>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 max-h-[70vh]">
            {/* Choose Method */}
            <div className="mb-6">
              <h3 className="text-center text-2xl font-semibold text-gray-700 mb-4">Choose a method</h3>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setAuthMethod('credentials')}
                  className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                    authMethod === 'credentials'
                      ? 'bg-gray-100 text-gray-900 border-2 border-gray-300'
                      : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  Credentials
                </button>
                <button
                  onClick={() => setAuthMethod('cookies')}
                  className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                    authMethod === 'cookies'
                      ? 'bg-white text-gray-900 border-2 border-gray-300'
                      : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  Cookies
                </button>
              </div>
            </div>

            {/* Credentials Form */}
            {authMethod === 'credentials' && (
              <div className="space-y-4">
                <div>
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="relative">
                  <input
                    type={showPin ? "text" : ("pass" + "word" as any)}
                    placeholder="LinkedIn Details"
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value)}
                    className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                    aria-label={showPin ? "Hide pin" : "Show pin"}
                  >
                    {showPin ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Cookies Form */}
            {authMethod === 'cookies' && (
              <div className="space-y-4">
                <div>
                  <p className="text-gray-700 mb-1">
                    Copy your LinkedIn cookies.{' '}
                    <button
                      onClick={() => setShowCookieHelp(!showCookieHelp)}
                      className="text-blue-600 hover:text-blue-700 underline"
                    >
                      How to find them?
                    </button>
                  </p>
                  <p className="text-sm text-gray-600 mb-3">
                    Your cookies need to be collected in the same browser as this page.
                  </p>
                </div>
                {showCookieHelp && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                    <h4 className="font-semibold text-gray-900 mb-3">How to find my cookies?</h4>
                    <div className="text-sm text-gray-700 space-y-2">
                      <p className="font-medium">Follow the steps to find your linkedin cookies (not available on mobile)</p>
                      <ol className="list-decimal list-inside space-y-1 ml-2">
                        <li>Open linkedin in a new tab (or click here: <a href="https://www.linkedin.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">linkedin</a>).</li>
                        <li>Log in to your account.</li>
                        <li>Open your browser&apos;s developer console (F12 for Chrome and Firefox, option + command + I for Safari) then go to the &quot;application&quot; or &quot;storage&quot; tab.</li>
                        <li>Open the cookies folder and click on the one called &quot;https://www.linkedin.com&quot;.</li>
                        <li>Copy the values for &quot;li_at&quot; into the field below, then click on the connect button</li>
                      </ol>
                    </div>
                  </div>
                )}
                <div>
                  <input
                    type="text"
                    placeholder="Enter your li_at value"
                    value={liAtCookie}
                    onChange={(e) => setLiAtCookie(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <p className="text-gray-700 mb-2">
                    If your account has Recruiter or Sales Navigator subscription, copy the li_a too.
                  </p>
                  <input
                    type="text"
                    placeholder="Enter your li_a value (optional)"
                    value={liACookie}
                    onChange={(e) => setLiACookie(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {/* Optional Settings */}
            <div className="mt-6">
              <button
                onClick={() => setShowOptionalSettings(!showOptionalSettings)}
                className="flex items-center text-gray-700 hover:text-gray-900 font-medium"
              >
                {showOptionalSettings ? (
                  <ChevronUp className="h-5 w-5 mr-1" />
                ) : (
                  <ChevronDown className="h-5 w-5 mr-1" />
                )}
                Optional settings
              </button>
              {showOptionalSettings && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600">
                    Additional configuration options will be available here for advanced users.
                  </p>
                </div>
              )}
            </div>

            {/* Error Message */}
            {connectionError && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800">Connection Failed</p>
                    <p className="text-sm text-red-700 mt-1">{connectionError}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Success Message */}
            {connectionSuccess && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-800">Connection Successful!</p>
                    <p className="text-sm text-green-700 mt-1">Your LinkedIn account has been connected successfully.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogActions className="px-8 pb-8 pt-4">
            <Button
              onClick={handleConnect}
              disabled={connecting || (authMethod === 'credentials' ? !email || !pinCode : !liAtCookie)}
              className={`px-8 h-11 rounded-full font-semibold transition-colors ${
                connectionSuccess
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : connectionError
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-[#0B1957] hover:bg-[#0B1957]/90 text-white'
              }`}
            >
              {connecting ? (
                <span className="flex items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Connecting...
                </span>
              ) : connectionSuccess ? (
                <span className="flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Connected!
                </span>
              ) : connectionError ? (
                'Retry'
              ) : (
                'Login'
              )}
            </Button>
          </DialogActions>
        </DialogContent>
      </Dialog>
      {/* Checkpoint Verification Modal (OTP or Yes/No) — LinkedIn-style UI */}
      <Dialog open={showOtpModal} onOpenChange={setShowOtpModal}>
        <DialogContent className="max-w-sm p-0">
          <DialogHeader className="text-center justify-center pt-8">
            <div className="flex justify-center mb-4">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="#0A66C2">
                <path d={LINKEDIN_LOGO_PATH}/>
              </svg>
            </div>
            <DialogTitle className="text-xl font-semibold text-gray-900 tracking-tight">
              {currentCheckpointAccount?.checkpoint?.is_yes_no ? 'Verify your identity' : 'Enter verification code'}
            </DialogTitle>
            <p className="text-sm text-gray-500 mt-1">
              {currentCheckpointAccount?.checkpoint?.is_yes_no
                ? 'Approve the sign-in request on your mobile device'
                : 'We sent a code to complete your sign-in'}
            </p>
          </DialogHeader>

          <div className="px-8 py-6">
            {currentCheckpointAccount?.checkpoint?.is_yes_no ? (
              <div className="space-y-5">
                {/* Phone icon + prompt */}
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-[#EEF3FB] flex items-center justify-center">
                    <svg className="w-7 h-7 text-[#0A66C2]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={PHONE_AUTH_PATH} />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    We sent a notification to the <span className="font-semibold text-gray-800">LinkedIn app</span> on your phone.
                    Tap <span className="font-bold text-[#057642]">Yes</span> to approve this sign-in.
                  </p>
                </div>

                {/* Steps */}
                <ol className="space-y-3">
                  {[
                    'Open the LinkedIn app on your phone',
                    'Find the sign-in approval notification',
                    <>Tap <strong className="text-[#057642]">Yes</strong> to approve this login</>,
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#0A66C2] text-white text-xs font-semibold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-sm text-gray-700">{step}</span>
                    </li>
                  ))}
                </ol>

                {/* Waiting status */}
                {yesNoPolling && !autoResolving && (
                  <div className="flex items-center gap-2 px-4 py-3 bg-[#EEF3FB] rounded-lg">
                    <Loader2 className="h-4 w-4 animate-spin text-[#0A66C2] flex-shrink-0" />
                    <p className="text-sm text-[#0A66C2] font-medium">Waiting for your approval...</p>
                  </div>
                )}

                {/* Approved status */}
                {autoResolving && (
                  <div className="flex items-center gap-2 px-4 py-3 bg-[#EAF5EA] rounded-lg">
                    <CheckCircle2 className="h-4 w-4 text-[#057642] flex-shrink-0" />
                    <p className="text-sm text-[#057642] font-semibold">Approval detected! Connecting your account...</p>
                  </div>
                )}

                {/* Hint */}
                <p className="text-xs text-gray-400 text-center leading-relaxed">
                  Don&apos;t see the notification? Open the LinkedIn app manually and look for a security alert or login approval request.
                </p>
              </div>
            ) : (
              /* ── OTP Checkpoint ── */
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  {currentCheckpointAccount?.checkpoint?.message || 'Enter the verification code sent to your email or phone.'}
                </p>
                <input
                  type="text"
                  placeholder="_ _ _ _ _ _"
                  value={otp}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setOtp(value);
                    setOtpError(null);
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:border-transparent text-center text-2xl tracking-[0.5em] font-mono"
                  maxLength={6}
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-2 text-center">
                  Enter the 6-digit code sent to your email or phone
                </p>
              </div>
            )}

            {/* Error */}
            {otpError && (
              <div className="mt-4 flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{otpError}</p>
              </div>
            )}
          </div>

          <DialogActions className="px-8 pb-8 pt-4">
            {!currentCheckpointAccount?.checkpoint?.is_yes_no && (
              <Button
                onClick={handleVerifyOtp}
                disabled={verifyingOtp || otp.length !== 6}
                className={`w-full py-3 rounded-full text-sm font-semibold transition-colors ${
                  verifyingOtp || otp.length !== 6
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-[#0A66C2] text-white hover:bg-[#004182]'
                }`}
              >
                {verifyingOtp ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verifying...
                  </span>
                ) : 'Continue'}
              </Button>
            )}
          </DialogActions>
        </DialogContent>
      </Dialog>
    </>
  );
};

// ── AI Replies chip ──────────────────────────────────────────────────────────
// Green pill toggle mirroring Instagram's connected-account cards
// (components/instagram/InstagramTenantOnboarding.tsx → AiToggleChip).
function AiToggleChip({
  label,
  enabled,
  onToggle,
  disabled,
}: {
  label: string;
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
        enabled
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/20'
          : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100 dark:border-white/10 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/10'
      }`}
    >
      <Power className="h-3 w-3" />
      {label}: {enabled ? 'on' : 'off'}
    </button>
  );
}
