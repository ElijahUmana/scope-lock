'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { WaitingMessage } from '../util/loader';
import { PromptUserContainer } from '../util/prompt-user-container';

import type { TokenVaultAuthProps } from './TokenVaultAuthProps';

const POPUP_TIMEOUT_SECONDS = 60;

type PopupStatus =
  | { kind: 'idle' }
  | { kind: 'waiting' }
  | { kind: 'popup-blocked' }
  | { kind: 'timed-out' };

export function TokenVaultConsentPopup({
  interrupt: { connection, requiredScopes, authorizationParams, resume },
  connectWidget: { icon, title, description, action, containerClassName },
  auth: { connectPath = '/auth/connect', returnTo = '/close' } = {},
  onFinish,
  onCancel,
}: TokenVaultAuthProps) {
  const [popupStatus, setPopupStatus] = useState<PopupStatus>({ kind: 'idle' });
  const [remainingSeconds, setRemainingSeconds] = useState(POPUP_TIMEOUT_SECONDS);
  const loginPopupRef = useRef<Window | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // Close popup helper
  const closePopup = useCallback(() => {
    if (loginPopupRef.current && !loginPopupRef.current.closed) {
      loginPopupRef.current.close();
    }
    loginPopupRef.current = null;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  // Poll for the login process until the popup is closed
  // or the user is authorized
  useEffect(() => {
    if (popupStatus.kind !== 'waiting') {
      return;
    }
    const interval = setInterval(() => {
      if (loginPopupRef.current && loginPopupRef.current.closed) {
        closePopup();
        clearInterval(interval);
        setPopupStatus({ kind: 'idle' });
        if (typeof onFinish === 'function') {
          onFinish();
        } else if (typeof resume === 'function') {
          resume();
        }
      }
    }, 1000);
    return () => {
      clearInterval(interval);
    };
  }, [popupStatus, onFinish, resume, closePopup]);

  // Cancel handler: close popup and notify parent
  const handleCancel = useCallback(() => {
    closePopup();
    setPopupStatus({ kind: 'idle' });
    if (typeof onCancel === 'function') {
      onCancel();
    }
  }, [closePopup, onCancel]);

  // Open the login popup
  const startLoginPopup = useCallback(() => {
    const search = new URLSearchParams({
      connection,
      returnTo,
      // Add all extra authorization parameters to the search params, they will be collected and submitted via the
      // authorization_params parameter of the connect account flow.
      ...authorizationParams,
    });
    for (const requiredScope of requiredScopes) {
      search.append('scopes', requiredScope);
    }

    const url = new URL(connectPath, window.location.origin);
    url.search = search.toString();

    const windowFeatures = 'width=800,height=650,status=no,toolbar=no,menubar=no';
    const popup = window.open(url.toString(), '_blank', windowFeatures);

    if (!popup) {
      setPopupStatus({ kind: 'popup-blocked' });
      return;
    }

    loginPopupRef.current = popup;
    setPopupStatus({ kind: 'waiting' });
    setRemainingSeconds(POPUP_TIMEOUT_SECONDS);

    // Countdown timer for UI display
    countdownRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Timeout: auto-expire after 60 seconds
    timeoutRef.current = setTimeout(() => {
      if (loginPopupRef.current && !loginPopupRef.current.closed) {
        loginPopupRef.current.close();
      }
      loginPopupRef.current = null;
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      setPopupStatus({ kind: 'timed-out' });
    }, POPUP_TIMEOUT_SECONDS * 1000);
  }, [connection, requiredScopes, returnTo, authorizationParams, connectPath]);

  if (popupStatus.kind === 'waiting') {
    return <WaitingMessage remainingSeconds={remainingSeconds} onCancel={handleCancel} />;
  }

  if (popupStatus.kind === 'popup-blocked') {
    return (
      <div className="flex flex-col gap-3 w-full">
        <p className="text-sm text-red-400">
          Popup blocked by your browser. Please allow popups for this site and try again.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setPopupStatus({ kind: 'idle' });
              startLoginPopup();
            }}
            className="text-xs font-medium text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-md px-3 py-1.5 transition-colors"
          >
            Try Again
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={handleCancel}
              className="text-xs text-white/50 hover:text-white/80 underline underline-offset-2 px-2 py-1.5 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  if (popupStatus.kind === 'timed-out') {
    return (
      <div className="flex flex-col gap-3 w-full">
        <p className="text-sm text-amber-400">
          Authorization timed out. Try again.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setPopupStatus({ kind: 'idle' });
              startLoginPopup();
            }}
            className="text-xs font-medium text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-md px-3 py-1.5 transition-colors"
          >
            Retry
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={handleCancel}
              className="text-xs text-white/50 hover:text-white/80 underline underline-offset-2 px-2 py-1.5 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <PromptUserContainer
      title={title}
      description={description}
      icon={icon}
      containerClassName={containerClassName}
      action={{
        label: action?.label ?? 'Connect',
        onClick: startLoginPopup,
      }}
    />
  );
}
