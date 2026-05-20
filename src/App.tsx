import { useState, createContext, useContext, useCallback, useEffect, useRef } from 'react';
import type { CampingPlan } from './types';
import { loadPlan, savePlan, setActivePlanId } from './store';
import { isSupabaseConfigured } from './supabase';
import { syncPlanToCloud, subscribeToPlan, unsubscribe, fetchPlanFromCloud } from './sync';
import Home from './pages/Home';
import PlanDetail from './pages/PlanDetail';

export type TabId = 'overview' | 'supplies' | 'expenses' | 'settlement' | 'share';

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
  const [currentTab, setCurrentTab] = useState<TabId>('overview');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const channelRef = useRef<import('@supabase/supabase-js').RealtimeChannel | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup realtime subscription on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) unsubscribe(channelRef.current);
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, []);

  // Re-fetch from cloud when page becomes visible again (e.g. switching back from WeChat chat)
  useEffect(() => {
    if (!plan || !roomCode || !isSupabaseConfigured()) return;
    function handleVisibility() {
      if (document.visibilityState === 'visible' && plan && roomCode) {
        fetchPlanFromCloud(plan.id).then(({ plan: cloudPlan }) => {
          if (cloudPlan) { savePlan(cloudPlan); setPlan(cloudPlan); }
        });
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [plan?.id, roomCode]);

  const openPlan = useCallback((id: string, code?: string) => {
    const p = loadPlan(id);
    if (!p) return;

    // Cleanup previous subscription
    if (channelRef.current) {
      unsubscribe(channelRef.current);
      channelRef.current = null;
    }

    const effectiveCode = code ?? p.roomCode ?? null;
    setPlan(p);
    setRoomCode(effectiveCode);
    setCurrentTab('overview');
    setActivePlanId(id);

    // Subscribe to realtime + fetch latest if cloud plan
    if (effectiveCode && isSupabaseConfigured()) {
      // Always pull latest from cloud on open (don't rely on stale localStorage)
      fetchPlanFromCloud(p.id).then(({ plan: cloudPlan }) => {
        if (cloudPlan) { savePlan(cloudPlan); setPlan(cloudPlan); }
      });

      channelRef.current = subscribeToPlan(p.id, (updated) => {
        savePlan(updated);
        setPlan(updated);
      });
    }
  }, []);

  const updatePlan = useCallback((updated: CampingPlan) => {
    savePlan(updated);
    setPlan(updated);

    // Debounced cloud sync
    if (roomCode && isSupabaseConfigured()) {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(() => {
        syncPlanToCloud(updated);
      }, 800);
    }
  }, [roomCode]);

  const goHome = useCallback(() => {
    if (channelRef.current) {
      unsubscribe(channelRef.current);
      channelRef.current = null;
    }
    setPlan(null);
    setRoomCode(null);
    setActivePlanId(null);
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
        }}>
          <PlanDetail />
        </AppContext.Provider>
      ) : (
        <Home onOpenPlan={openPlan} />
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
