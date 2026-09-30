'use client';

/**
 * Settings → Notifications.
 *
 * Push alerts on this phone/browser for lead acceptances and LinkedIn replies.
 * Turning alerts on is per device (each browser holds its own subscription);
 * which events alert, and whether the message text shows, are per user.
 *
 * Loading vs failed is keyed on `data === undefined` after the query settles,
 * never on `isError` alone (CLAUDE.md, "Failure ≠ emptiness").
 */

import { useCallback, useEffect, useState } from 'react';
import { BellOff, BellRing, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { InstallAppCard } from '@/components/pwa/InstallAppCard';
import {
  usePushConfig,
  useNotificationPreferences,
  useUpdateNotificationPreferences,
  useSavePushSubscription,
  useRemovePushSubscription,
  useSendTestPush,
  type NotificationPreferences,
} from '@lad/frontend-features/notifications';
import {
  PushPermissionDenied,
  currentSubscription,
  getPlatform,
  getPushSupport,
  notificationPermission,
  subscribeThisDevice,
  unsubscribeThisDevice,
  type PushSupport,
} from '@/lib/push/pushClient';

type DeviceState = 'checking' | 'on' | 'off';

const PREFERENCE_ROWS: { key: keyof NotificationPreferences; title: string; detail: string }[] = [
  { key: 'leadAccepted', title: 'Lead accepted', detail: 'When a lead accepts your LinkedIn connection request.' },
  { key: 'messageReceived', title: 'New replies', detail: 'When a lead replies to you on LinkedIn.' },
  { key: 'showPreview', title: 'Show message preview', detail: 'Include the first line of the reply. Turn off to show only who replied.' },
];

export function NotificationSettings() {
  const config = usePushConfig();
  const prefs = useNotificationPreferences();
  const updatePrefs = useUpdateNotificationPreferences();
  const saveSub = useSavePushSubscription();
  const removeSub = useRemovePushSubscription();
  const sendTest = useSendTestPush();

  const [support, setSupport] = useState<PushSupport | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [device, setDevice] = useState<DeviceState>('checking');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const refreshDevice = useCallback(async () => {
    const s = getPushSupport();
    setSupport(s);
    setPermission(notificationPermission());
    if (!s.supported) { setDevice('off'); return; }
    const sub = await currentSubscription();
    setDevice(sub ? 'on' : 'off');
  }, []);

  useEffect(() => { void refreshDevice(); }, [refreshDevice]);

  const configData = config.data;
  // Settled with no data = failed. `isFetching` covers a retry in flight.
  const configFailed = !config.isLoading && !config.isFetching && configData === undefined;
  const serverReady = configData?.configured === true && !!configData.publicKey;

  const turnOn = async () => {
    if (!configData?.publicKey) return;
    setBusy(true);
    setMessage(null);
    try {
      const subscription = await subscribeThisDevice(configData.publicKey);
      await saveSub.mutateAsync(subscription);
      setMessage({ tone: 'ok', text: 'Alerts are on for this device.' });
    } catch (err) {
      setMessage({
        tone: 'error',
        text: err instanceof PushPermissionDenied
          ? 'Notifications are blocked for this site. Allow them in your browser or phone settings, then try again.'
          : 'Could not turn on alerts. Please try again.',
      });
    } finally {
      setBusy(false);
      await refreshDevice();
    }
  };

  const turnOff = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const endpoint = await unsubscribeThisDevice();
      if (endpoint) await removeSub.mutateAsync(endpoint);
      setMessage({ tone: 'ok', text: 'Alerts are off for this device.' });
    } catch {
      setMessage({ tone: 'error', text: 'Could not turn off alerts. Please try again.' });
    } finally {
      setBusy(false);
      await refreshDevice();
    }
  };

  const onTest = async () => {
    setMessage(null);
    try {
      const result = await sendTest.mutateAsync();
      setMessage(result && result.sent > 0
        ? { tone: 'ok', text: `Test sent to ${result.sent} device${result.sent === 1 ? '' : 's'}.` }
        : { tone: 'error', text: 'No device received the test. Turn on alerts on this device first.' });
    } catch {
      setMessage({ tone: 'error', text: 'Could not send a test alert.' });
    }
  };

  const onToggle = (key: keyof NotificationPreferences, value: boolean) => {
    updatePrefs.mutate({ [key]: value }, {
      onError: () => setMessage({ tone: 'error', text: 'Could not save that setting. Please try again.' }),
    });
  };

  const prefsData = prefs.data;
  const prefsFailed = !prefs.isLoading && !prefs.isFetching && prefsData === undefined;
  const isIOS = support !== null && getPlatform() === 'ios';

  return (
    <div className="space-y-6">
      <InstallAppCard emphasis={isIOS && !support?.supported} />

      {/* This device */}
      <div className="bg-white dark:bg-[#071131] rounded-lg border border-gray-200 dark:border-gray-800 p-5 sm:p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Alerts on this device</h3>
        <p className="text-sm text-gray-600 dark:text-slate-300 mt-1 mb-4">
          Get a notification on this phone or browser when a lead accepts your connection or replies — even when Mr LAD is closed.
        </p>

        {config.isLoading || support === null || device === 'checking' ? (
          <p className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Checking this device…
          </p>
        ) : configFailed ? (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            Couldn&apos;t load notification settings. Refresh the page to try again.
          </p>
        ) : !serverReady ? (
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Push alerts aren&apos;t set up on this environment yet. Ask your administrator to enable them.
          </p>
        ) : !support.supported ? (
          <p className="text-sm text-gray-800 dark:text-slate-200">
            {support.reason === 'ios_needs_install'
              ? 'On iPhone and iPad, alerts only work in the installed app. Add Mr LAD to your Home Screen (above), open it from the icon, and come back here.'
              : support.reason === 'ios_too_old'
                ? 'Alerts need iOS 16.4 or later. Update your iPhone to turn them on.'
                : 'This browser can’t receive push alerts. Try Chrome, Edge, Firefox or Safari.'}
          </p>
        ) : permission === 'denied' && device === 'off' ? (
          <p className="text-sm text-gray-800 dark:text-slate-200">
            Notifications are blocked for this site. Allow them in your browser&apos;s site settings
            {isIOS ? ' (Settings → Notifications → Mr LAD)' : ''}, then reload this page.
          </p>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <span className={`inline-flex items-center gap-2 text-sm font-medium ${device === 'on' ? 'text-green-700 dark:text-green-400' : 'text-gray-700 dark:text-slate-300'}`}>
              {device === 'on'
                ? <><BellRing className="h-4 w-4" aria-hidden="true" /> On for this device</>
                : <><BellOff className="h-4 w-4" aria-hidden="true" /> Off for this device</>}
            </span>
            <div className="flex flex-col gap-2 sm:ml-auto sm:flex-row">
              {device === 'on' ? (
                <>
                  <Button variant="outline" onClick={onTest} disabled={sendTest.isPending} className="min-h-11 gap-2">
                    {sendTest.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                    Send test
                  </Button>
                  <Button variant="outline" onClick={turnOff} disabled={busy} className="min-h-11">
                    Turn off
                  </Button>
                </>
              ) : (
                <Button onClick={turnOn} disabled={busy} className="min-h-11 gap-2 bg-[#0B1957] hover:bg-[#0a1540] dark:bg-blue-600 text-white">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <BellRing className="h-4 w-4" aria-hidden="true" />}
                  Turn on alerts
                </Button>
              )}
            </div>
          </div>
        )}

        {serverReady && configData && configData.devices > 0 && (
          <p className="mt-3 text-xs text-gray-600 dark:text-slate-400">
            Alerts are on for {configData.devices} device{configData.devices === 1 ? '' : 's'} on your account.
          </p>
        )}

        {message && (
          <p role={message.tone === 'error' ? 'alert' : 'status'}
             className={`mt-3 text-sm ${message.tone === 'error' ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
            {message.text}
          </p>
        )}
      </div>

      {/* What to alert on (per user, all devices) */}
      <div className="bg-white dark:bg-[#071131] rounded-lg border border-gray-200 dark:border-gray-800 p-5 sm:p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">What to alert me about</h3>
        <p className="text-sm text-gray-600 dark:text-slate-300 mt-1 mb-2">
          Applies to every device where alerts are on. You get alerts for conversations assigned to you, or for your own LinkedIn account.
        </p>

        {prefs.isLoading ? (
          <p className="flex items-center gap-2 py-3 text-sm text-gray-600 dark:text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading…
          </p>
        ) : prefsFailed || !prefsData ? (
          <p role="alert" className="py-3 text-sm text-red-700 dark:text-red-400">
            Couldn&apos;t load your alert preferences. Refresh the page to try again.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {PREFERENCE_ROWS.map((row) => {
              const id = `notif-pref-${row.key}`;
              const disabled = updatePrefs.isPending
                || (row.key === 'showPreview' && !prefsData.messageReceived);
              return (
                <li key={row.key}>
                  <label htmlFor={id} className={`flex min-h-14 items-center gap-4 py-3 ${disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-gray-900 dark:text-white">{row.title}</span>
                      <span className="block text-xs text-gray-600 dark:text-slate-400 mt-0.5">{row.detail}</span>
                    </span>
                    <Switch
                      id={id}
                      checked={prefsData[row.key]}
                      disabled={disabled}
                      onCheckedChange={(v) => onToggle(row.key, v)}
                    />
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export default NotificationSettings;
