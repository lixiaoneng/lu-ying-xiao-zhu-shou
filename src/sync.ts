import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from './supabase';
import type { CampingPlan } from './types';
import { migratePlan } from './store';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(): string {
  return Array.from({ length: 6 }, () =>
    CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  ).join('');
}

export async function createPlanInCloud(
  plan: CampingPlan,
  roomCode: string
): Promise<{ error: string | null }> {
  const db = getSupabase();
  if (!db) return { error: 'Supabase 未配置' };
  const { error } = await db
    .from('plans')
    .insert({ id: plan.id, room_code: roomCode, data: plan });
  return { error: error?.message ?? null };
}

export async function syncPlanToCloud(
  plan: CampingPlan
): Promise<{ error: string | null }> {
  const db = getSupabase();
  if (!db) return { error: 'Supabase 未配置' };
  // Use upsert so the row is created if it was never inserted (e.g. first sync or DB reset)
  const { error } = await db
    .from('plans')
    .upsert({ id: plan.id, room_code: plan.roomCode, data: plan, updated_at: plan.updatedAt });
  return { error: error?.message ?? null };
}

export async function fetchPlanFromCloud(
  planId: string
): Promise<{ plan: CampingPlan | null; error: string | null }> {
  const db = getSupabase();
  if (!db) return { plan: null, error: 'Supabase 未配置' };
  const { data, error } = await db
    .from('plans')
    .select('data')
    .eq('id', planId)
    .single();
  if (error || !data) return { plan: null, error: error?.message ?? '获取失败' };
  return { plan: migratePlan(data.data as CampingPlan), error: null };
}

export async function loadPlanByRoomCode(
  code: string
): Promise<{ plan: CampingPlan | null; roomCode: string | null; error: string | null }> {
  const db = getSupabase();
  if (!db) return { plan: null, roomCode: null, error: 'Supabase 未配置' };
  const { data, error } = await db
    .from('plans')
    .select('data, room_code')
    .eq('room_code', code.toUpperCase().trim())
    .single();
  if (error || !data) {
    return { plan: null, roomCode: null, error: '找不到该房间码，请确认后重试' };
  }
  return { plan: migratePlan(data.data as CampingPlan), roomCode: data.room_code as string, error: null };
}

export function subscribeToPlan(
  planId: string,
  onUpdate: (plan: CampingPlan) => void
): RealtimeChannel | null {
  const db = getSupabase();
  if (!db) {
    console.warn('[Realtime] ❌ getSupabase() returned null — Supabase not configured');
    return null;
  }

  // Use a unique suffix so Supabase client never reuses a stale channel object
  const channelName = `plan:${planId}:${Date.now()}`;
  console.log(`[Realtime] 🔌 Creating channel "${channelName}"`);

  const channel = db
    .channel(channelName)
    .on(
      'postgres_changes',
      // Listen for ALL events (INSERT + UPDATE) so upsert's insert path is also caught
      { event: '*', schema: 'public', table: 'plans', filter: `id=eq.${planId}` },
      payload => {
        console.log('[Realtime] 📨 postgres_changes event received:', {
          eventType: payload.eventType,
          schema: (payload as { schema?: string }).schema,
          table: (payload as { table?: string }).table,
          new: payload.new,
        });

        const row = payload.new as { data?: CampingPlan } | null;
        const updated = row?.data;

        if (updated) {
          console.log('[Realtime] ✅ Calling onUpdate, plan updatedAt:', updated.updatedAt);
          onUpdate(migratePlan(updated));
        } else {
          console.warn(
            '[Realtime] ⚠️ payload.new.data is null/undefined.',
            'Check: 1) Realtime enabled for plans table in Supabase Dashboard → Database → Replication',
            '2) Table has REPLICA IDENTITY FULL (run: ALTER TABLE public.plans REPLICA IDENTITY FULL;)',
            'Raw payload.new:', payload.new,
          );
        }
      }
    )
    .subscribe((status, err) => {
      if (err) {
        console.error(`[Realtime] ❌ Channel "${channelName}" error:`, err);
      } else {
        console.log(`[Realtime] Channel "${channelName}" status: ${status}`);
      }
      if (status === 'SUBSCRIBED') {
        console.log('[Realtime] ✅ Subscription active — waiting for changes...');
      } else if (status === 'CHANNEL_ERROR') {
        console.error(
          '[Realtime] ❌ CHANNEL_ERROR — most likely cause: Realtime is NOT enabled for the plans table.',
          'Fix: Supabase Dashboard → Database → Replication → enable "plans" table',
        );
      } else if (status === 'TIMED_OUT') {
        console.error('[Realtime] ❌ Subscription TIMED_OUT — check network or Supabase project status');
      } else if (status === 'CLOSED') {
        console.log(`[Realtime] Channel "${channelName}" closed`);
      }
    });

  return channel;
}

export function unsubscribe(channel: RealtimeChannel): void {
  console.log('[Realtime] 🔌 Unsubscribing channel:', channel.topic);
  getSupabase()?.removeChannel(channel);
}
