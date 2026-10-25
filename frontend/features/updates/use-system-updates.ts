'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { RELEASE_NOTES } from './release-notes';

export function useSystemUpdates(open: boolean) {
  const user = useAuthStore((state) => state.user);
  const key = user ? `ax-updates-seen:${user.tenantId}:${user.id}` : undefined;
  const latest = RELEASE_NOTES[0].id;
  const [unread, setUnread] = useState(false);
  useEffect(() => {
    if (!key) { setUnread(false); return; }
    try { setUnread(localStorage.getItem(key) !== latest); }
    catch { setUnread(true); }
  }, [key, latest]);
  useEffect(() => {
    if (!open || !key) return;
    setUnread(false);
    try { localStorage.setItem(key, latest); } catch { /* The history also works without browser storage. */ }
  }, [open, key, latest]);
  return { unread };
}
