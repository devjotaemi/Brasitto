import { useCallback, useEffect, useRef, useState } from 'react';
import type { GetApplicationLockStatusUseCase } from '../application/get-application-lock-status/GetApplicationLockStatusUseCase';
import {
  isSupabaseConfigured,
  supabaseClient,
} from '../infrastructure/supabase/supabaseClient';

const APPLICATION_LOCK_POLL_INTERVAL_MS = 60000;
const APPLICATION_LOCK_STORAGE_KEY = 'quinta-da-torta:application-lock-updated';

type ApplicationLockState = {
  isCheckingApplicationLock: boolean;
  isApplicationLocked: boolean;
  refreshApplicationLockStatus: () => Promise<void>;
};

type RefreshOptions = {
  showLoading?: boolean;
};

export function notifyApplicationLockStatusChanged() {
  try {
    window.localStorage.setItem(
      APPLICATION_LOCK_STORAGE_KEY,
      new Date().toISOString(),
    );
  } catch {
    // localStorage can be unavailable in private or restricted contexts.
  }
}

export function useApplicationLockStatus(
  channelName: string,
  getApplicationLockStatusUseCase: GetApplicationLockStatusUseCase,
): ApplicationLockState {
  const isMountedRef = useRef(false);
  const hasLoadedStatusRef = useRef(false);
  const [isCheckingApplicationLock, setIsCheckingApplicationLock] =
    useState(true);
  const [isApplicationLocked, setIsApplicationLocked] = useState(false);

  const refreshApplicationLockStatus = useCallback(
    async (options: RefreshOptions = {}) => {
      if (options.showLoading) {
        setIsCheckingApplicationLock(true);
      }

      try {
        const status = await getApplicationLockStatusUseCase.execute();

        if (isMountedRef.current) {
          setIsApplicationLocked(status.locked);
          hasLoadedStatusRef.current = true;
        }
      } catch {
        if (isMountedRef.current && !hasLoadedStatusRef.current) {
          setIsApplicationLocked(false);
          hasLoadedStatusRef.current = true;
        }
      } finally {
        if (isMountedRef.current) {
          setIsCheckingApplicationLock(false);
        }
      }
    },
    [getApplicationLockStatusUseCase],
  );

  useEffect(() => {
    isMountedRef.current = true;

    void refreshApplicationLockStatus({ showLoading: true });

    const intervalId = window.setInterval(() => {
      void refreshApplicationLockStatus();
    }, APPLICATION_LOCK_POLL_INTERVAL_MS);

    function refreshWhenVisible() {
      if (document.visibilityState === 'visible') {
        void refreshApplicationLockStatus();
      }
    }

    function refreshOnFocus() {
      void refreshApplicationLockStatus();
    }

    function refreshOnStorage(event: StorageEvent) {
      if (event.key === APPLICATION_LOCK_STORAGE_KEY) {
        void refreshApplicationLockStatus();
      }
    }

    window.addEventListener('focus', refreshOnFocus);
    window.addEventListener('storage', refreshOnStorage);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    if (!isSupabaseConfigured || supabaseClient === null) {
      return () => {
        isMountedRef.current = false;
        window.clearInterval(intervalId);
        window.removeEventListener('focus', refreshOnFocus);
        window.removeEventListener('storage', refreshOnStorage);
        document.removeEventListener('visibilitychange', refreshWhenVisible);
      };
    }

    const realtimeClient = supabaseClient;
    const channel = realtimeClient
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_settings',
          filter: 'key=eq.application_lock',
        },
        () => {
          void refreshApplicationLockStatus();
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void refreshApplicationLockStatus();
        }
      });

    return () => {
      isMountedRef.current = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshOnFocus);
      window.removeEventListener('storage', refreshOnStorage);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      void realtimeClient.removeChannel(channel);
    };
  }, [channelName, refreshApplicationLockStatus]);

  return {
    isCheckingApplicationLock,
    isApplicationLocked,
    refreshApplicationLockStatus,
  };
}
