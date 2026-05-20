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
  const { error } = await db
    .from('plans')
    .update({ data: plan, updated_at: new Date().toISOString() })
    .eq('id', plan.id);
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
  if (!db) return null;
  const channel = db
    .channel(`plan:${planId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'plans', filter: `id=eq.${planId}` },
      payload => {
        const updated = (payload.new as { data: CampingPlan }).data;
        if (updated) onUpdate(migratePlan(updated));
      }
    )
    .subscribe();
  return channel;
}

export function unsubscribe(channel: RealtimeChannel): void {
  getSupabase()?.removeChannel(channel);
}
