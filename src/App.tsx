import { useState, createContext, useContext, useCallback, useEffect, useRef } from 'react';
import type { CampingPlan } from './types';
import { loadPlan, savePlan, setActivePlanId } from './store';
import { isSupabaseConfigured } from './supabase';
import { syncPlanToCloud, subscribeToPlan, unsubscribe, fetchPlanFromCloud } from './sync';
import Home from './pages/Home';
import PlanDetail from './pages/PlanDetail';
import EquipmentPage from './pages/EquipmentPage';

export type TabId = 'overview' | 'supplies' | 'expenses' | 'settlement' | 'share';
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

interface Toast {
  id: number;
  msg: string;
  type: 'success' | 'error';
}

interface AppCtx {
  plan: CampingPlan;
  roomCode: string | null;
  isCloudPlan: boolean;
  updatePlan: (p: CampingPlan) => void;
  goHome: () => void;
  currentTab: TabId;
  setCurrentTab: (t: TabId) => void;
  toast: (msg: string, type?: 'success' | 'error') => void;
  syncStatus: SyncStatus;
  forceSync: () => void;
}

const AppContext = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp outside provider');
  return ctx;
}

export default function App() {
  const [plan, setPlan] = useState<CampingPlan | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  // 无 plan 时的二级视图；plan 存在时始终显示 PlanDetail，与此无关
  const [view, setView] = useState<'home' | 'equipment'>('home');
  const [currentTab, setCurrentTab] = useState<TabId>('overview');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const channelRef = useRef<import('@supabase/supabase-js').RealtimeChannel | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Always-current ref so event handlers (visibilitychange, online) get latest plan value
  const planRef = useRef<CampingPlan | null>(null);
  useEffect(() => { planRef.current = plan; }, [plan]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        // console.log('[App] unmount cleanup: unsubscribing channel');
        unsubscribe(channelRef.current);
      }
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      if (syncStatusTimerRef.current) clearTimeout(syncStatusTimerRef.current);
    };
  }, []);

  // Re-fetch from cloud when page becomes visible (e.g. switching back from WeChat)
  // Dep array excludes updatedAt so this doesn't re-register on every edit;
  // planRef gives us the latest plan value inside the handler without stale closure.
  useEffect(() => {
    if (!plan?.id || !roomCode || !isSupabaseConfigured()) return;
    function handleVisibility() {
      if (document.visibilityState !== 'visible') return;
      const current = planRef.current;
      if (!current) return;
      fetchPlanFromCloud(current.id).then(({ plan: cloudPlan }) => {
        if (!cloudPlan) return;
        setPlan(prev => {
          if (prev && cloudPlan.updatedAt > prev.updatedAt) {
            savePlan(cloudPlan);
            return cloudPlan;
          }
          return prev;
        });
      });
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [plan?.id, roomCode]);

  const openPlan = useCallback((id: string, code?: string) => {
    const p = loadPlan(id);
    if (!p) return;

    // Cleanup previous subscription
    if (channelRef.current) {
      // console.log('[App] openPlan: cleaning up previous channel before re-subscribe');
      unsubscribe(channelRef.current);
      channelRef.current = null;
    }

    const effectiveCode = code ?? p.roomCode ?? null;
    setPlan(p);
    setRoomCode(effectiveCode);
    setCurrentTab('overview');
    setActivePlanId(id);
    setSyncStatus('idle');

    // console.log(`[App] openPlan: id=${id} effectiveCode=${effectiveCode} supabaseConfigured=${isSupabaseConfigured()}`);

    if (effectiveCode && isSupabaseConfigured()) {
      // Fetch latest from cloud; use functional setPlan so the comparison is never stale
      // even if the network round-trip takes longer than expected
      fetchPlanFromCloud(p.id).then(({ plan: cloudPlan }) => {
        if (!cloudPlan) return;
        setPlan(prev => {
          const current = prev ?? p;
          if (cloudPlan.updatedAt > current.updatedAt) {
            // console.log('[App] openPlan fetch: cloud is newer, updating local state');
            savePlan(cloudPlan);
            return cloudPlan;
          }
          return current;
        });
      });

      // Realtime: fires only when another user pushes a change; still check timestamp
      // so a late-arriving push doesn't roll back a local edit the current user just made
      // console.log(`[App] openPlan: subscribing to Realtime for plan ${p.id}`);
      channelRef.current = subscribeToPlan(p.id, (updated) => {
        // console.log('[App] Realtime callback fired, updated.updatedAt:', updated.updatedAt);
        setPlan(prev => {
          const willUpdate = !prev || updated.updatedAt > prev.updatedAt;
          // console.log(`[App] Realtime: prev.updatedAt=${prev?.updatedAt} updated.updatedAt=${updated.updatedAt} willUpdate=${willUpdate}`);
          if (willUpdate) {
            savePlan(updated);
            return updated;
          }
          return prev;
        });
      });
    }
  }, []);

  const setSyncDone = useCallback((error: boolean) => {
    setSyncStatus(error ? 'error' : 'synced');
    if (syncStatusTimerRef.current) clearTimeout(syncStatusTimerRef.current);
    syncStatusTimerRef.current = setTimeout(() => setSyncStatus('idle'), 3000);
  }, []);

  const updatePlan = useCallback((updated: CampingPlan) => {
    // Stamp the timestamp ONCE so localStorage and cloud are always identical
    const stamped = { ...updated, updatedAt: new Date().toISOString() };
    savePlan(stamped);
    setPlan(stamped);

    if (roomCode && isSupabaseConfigured()) {
      setSyncStatus('syncing');
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(() => {
        // Use planRef.current rather than the closure's `stamped`.
        // If Realtime delivered a newer version from another device within
        // the debounce window, we sync *that* version instead of overwriting
        // it with our stale local snapshot.
        const toSync = planRef.current;
        if (!toSync) return;
        syncPlanToCloud(toSync)
          .then(({ error }) => setSyncDone(!!error))
          .catch(() => setSyncDone(true));
      }, 300);
    }
  }, [roomCode, setSyncDone]);

  const forceSync = useCallback(() => {
    // Use planRef.current so we always push the *latest* plan state,
    // and so `plan` doesn't have to be in the deps (preventing cascading
    // re-renders of all context consumers on every plan mutation).
    const toSync = planRef.current;
    if (!toSync || !roomCode || !isSupabaseConfigured()) return;
    setSyncStatus('syncing');
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncPlanToCloud(toSync)
      .then(({ error }) => setSyncDone(!!error))
      .catch(() => setSyncDone(true));
  }, [roomCode, setSyncDone]);

  // Auto-retry sync when network comes back online (placed after setSyncDone is defined)
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    function handleOnline() {
      const current = planRef.current;
      if (current && roomCode) {
        setSyncStatus('syncing');
        syncPlanToCloud(current)
          .then(({ error }) => setSyncDone(!!error))
          .catch(() => setSyncDone(true));
      }
    }
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [roomCode, setSyncDone]);

  const goHome = useCallback(() => {
    if (channelRef.current) {
      // console.log('[App] goHome: unsubscribing channel');
      unsubscribe(channelRef.current);
      channelRef.current = null;
    }
    setPlan(null);
    setRoomCode(null);
    setActivePlanId(null);
    setSyncStatus('idle');
  }, []);

  const toast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2800);
  }, []);

  return (
    <>
      {plan ? (
        <AppContext.Provider value={{
          plan,
          roomCode,
          isCloudPlan: !!roomCode,
          updatePlan,
          goHome,
          currentTab,
          setCurrentTab,
          toast,
          syncStatus,
          forceSync,
        }}>
          <PlanDetail />
        </AppContext.Provider>
      ) : view === 'equipment' ? (
        <EquipmentPage onBack={() => setView('home')} />
      ) : (
        <Home onOpenPlan={openPlan} onOpenEquipment={() => setView('equipment')} />
      )}

      {/* Toast stack */}
      <div style={{
        position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
        zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8,
        width: 'calc(100% - 32px)', maxWidth: 420, pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: t.type === 'success' ? '#3D6B4F' : '#C0392B',
            color: 'white', padding: '12px 18px', borderRadius: 10,
            fontSize: 14, fontWeight: 500,
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            textAlign: 'center',
            animation: 'toastIn 0.25s ease forwards',
          }}>
            {t.msg}
          </div>
        ))}
      </div>
    </>
  );
}
