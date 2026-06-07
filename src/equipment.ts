import { getSupabase } from './supabase';
import type { SupplyType } from './types';

// ─── 类型定义 ────────────────────────────────────────────────────────────────

/** 与数据库 equipment_items 表字段完全对应 */
export interface EquipmentItem {
  id: string;
  user_id: string;
  name: string;
  system_category: string;
  default_plan_type: SupplyType | null;
  quantity: string | null;
  note: string | null;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

/** 新增装备时必须提供的字段（id / created_at / updated_at 由数据库生成） */
export type NewEquipmentItem = {
  user_id: string;           // 当前登录用户的 auth.uid()
  name: string;
  system_category: string;
  default_plan_type?: SupplyType | null;
  quantity?: string | null;
  note?: string | null;
  is_favorite?: boolean;
};

/**
 * 更新装备时可传入的字段。
 * user_id 不允许更新（强制排除），防止误修改数据归属。
 */
export type UpdateEquipmentItem = Partial<Omit<EquipmentItem,
  'id' | 'user_id' | 'created_at' | 'updated_at'
>>;

// ─── 统一错误结果类型 ─────────────────────────────────────────────────────────

export interface EquipmentResult<T> {
  data: T | null;
  error: string | null;
}

// ─── CRUD 函数 ────────────────────────────────────────────────────────────────

/**
 * 查询当前用户的所有装备。
 *
 * - 显式 .eq('user_id', userId)：即使 RLS 已隔离，也保持业务语义清晰。
 * - 排序：常用装备（is_favorite=true）优先，其次按创建时间倒序。
 */
export async function listEquipment(
  userId: string
): Promise<EquipmentResult<EquipmentItem[]>> {
  const db = getSupabase();
  if (!db) return { data: null, error: 'Supabase 未配置' };

  const { data, error } = await db
    .from('equipment_items')
    .select('*')
    .eq('user_id', userId)
    .order('is_favorite', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as EquipmentItem[], error: null };
}

/**
 * 新增一件装备。
 * 调用方必须把当前登录用户的 user_id 传入 input，
 * RLS 会在数据库层二次校验（with check），防止越权写入。
 */
export async function addEquipment(
  input: NewEquipmentItem
): Promise<EquipmentResult<EquipmentItem>> {
  const db = getSupabase();
  if (!db) return { data: null, error: 'Supabase 未配置' };

  const { data, error } = await db
    .from('equipment_items')
    .insert({
      user_id:           input.user_id,
      name:              input.name,
      system_category:   input.system_category,
      default_plan_type: input.default_plan_type ?? null,
      quantity:          input.quantity ?? null,
      note:              input.note ?? null,
      is_favorite:       input.is_favorite ?? false,
    })
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as EquipmentItem, error: null };
}

/**
 * 更新一件装备的部分字段。
 * - user_id 不在 UpdateEquipmentItem 类型里，无法被传入，强制保护。
 * - RLS update policy 在数据库层再次确认只能改自己的行。
 */
export async function updateEquipment(
  id: string,
  patch: UpdateEquipmentItem
): Promise<EquipmentResult<EquipmentItem>> {
  const db = getSupabase();
  if (!db) return { data: null, error: 'Supabase 未配置' };

  const { data, error } = await db
    .from('equipment_items')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as EquipmentItem, error: null };
}

/**
 * 删除一件装备。
 * RLS delete policy 确保只能删除自己的装备。
 */
export async function deleteEquipment(
  id: string
): Promise<{ error: string | null }> {
  const db = getSupabase();
  if (!db) return { error: 'Supabase 未配置' };

  const { error } = await db
    .from('equipment_items')
    .delete()
    .eq('id', id);

  if (error) return { error: error.message };
  return { error: null };
}
