import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabase } from '../supabase';

export interface AuthState {
  /** 当前登录用户；null = 未登录 */
  user: User | null;
  /** true = getSession() 尚未返回 */
  loading: boolean;
  /** 最近一次内部操作的错误；调用方通常自己管理错误展示 */
  error: string | null;
  /**
   * true = 用户从密码重置邮件跳回，处于 recovery session。
   * 此时 user 非 null，但应展示"设置新密码"表单，而非装备库。
   * updatePassword 成功或 signOut 后自动置 false。
   */
  isRecoveryMode: boolean;

  // ── Magic Link（保留为备选）──
  signInWithEmail: (email: string) => Promise<{ sent: boolean; error: string | null }>;

  // ── 邮箱密码（主登录方式）──
  signUpWithPassword: (email: string, password: string) => Promise<{ success: boolean; error: string | null }>;
  signInWithPassword: (email: string, password: string) => Promise<{ success: boolean; error: string | null }>;
  resetPassword: (email: string) => Promise<{ sent: boolean; error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ success: boolean; error: string | null }>;

  signOut: () => Promise<void>;
}

/**
 * useAuth — 管理 Supabase Auth 状态。
 *
 * 设计原则：
 * - 不进入 AppContext，不影响计划功能。
 * - getSession() 异步执行，不阻塞 App 渲染。
 * - PASSWORD_RECOVERY 事件由 onAuthStateChange 捕获，设置 isRecoveryMode。
 * - Supabase 未配置时所有操作静默降级。
 */
export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);

  useEffect(() => {
    const db = getSupabase();
    if (!db) {
      setLoading(false);
      return;
    }

    // 读取当前 session（异步，不阻塞外层渲染）
    db.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    // 监听登录/登出/token 刷新/密码重置等状态变化
    const { data: { subscription } } = db.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true);
      }
      if (event === 'SIGNED_OUT') {
        setIsRecoveryMode(false);
      }
    });

    return () => { subscription.unsubscribe(); };
  }, []);

  // ── Magic Link ──────────────────────────────────────────────────────────────

  async function signInWithEmail(email: string): Promise<{ sent: boolean; error: string | null }> {
    const db = getSupabase();
    if (!db) return { sent: false, error: 'Supabase 未配置，请联系开发者' };
    setError(null);
    const { error: supaErr } = await db.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (supaErr) {
      const msg = supaErr.message ?? '发送失败，请稍后重试';
      setError(msg);
      return { sent: false, error: msg };
    }
    return { sent: true, error: null };
  }

  // ── 邮箱密码 ────────────────────────────────────────────────────────────────

  async function signUpWithPassword(
    email: string,
    password: string,
  ): Promise<{ success: boolean; error: string | null }> {
    const db = getSupabase();
    if (!db) return { success: false, error: 'Supabase 未配置，请联系开发者' };
    setError(null);
    const { data, error: supaErr } = await db.auth.signUp({ email, password });
    if (supaErr) {
      const msg = supaErr.message ?? '注册失败，请稍后重试';
      setError(msg);
      return { success: false, error: msg };
    }
    // Confirm email 关闭时 session 立即返回；开启时 session = null
    if (!data.session) {
      return { success: false, error: '请检查邮箱，点击确认链接后再登录。' };
    }
    return { success: true, error: null };
  }

  async function signInWithPassword(
    email: string,
    password: string,
  ): Promise<{ success: boolean; error: string | null }> {
    const db = getSupabase();
    if (!db) return { success: false, error: 'Supabase 未配置，请联系开发者' };
    setError(null);
    const { error: supaErr } = await db.auth.signInWithPassword({ email, password });
    if (supaErr) {
      const msg = supaErr.message ?? '登录失败，请稍后重试';
      setError(msg);
      return { success: false, error: msg };
    }
    return { success: true, error: null };
  }

  async function resetPassword(email: string): Promise<{ sent: boolean; error: string | null }> {
    const db = getSupabase();
    if (!db) return { sent: false, error: 'Supabase 未配置，请联系开发者' };
    setError(null);
    const { error: supaErr } = await db.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (supaErr) {
      const msg = supaErr.message ?? '发送失败，请稍后重试';
      setError(msg);
      return { sent: false, error: msg };
    }
    return { sent: true, error: null };
  }

  async function updatePassword(
    newPassword: string,
  ): Promise<{ success: boolean; error: string | null }> {
    const db = getSupabase();
    if (!db) return { success: false, error: 'Supabase 未配置，请联系开发者' };
    setError(null);
    const { error: supaErr } = await db.auth.updateUser({ password: newPassword });
    if (supaErr) {
      const msg = supaErr.message ?? '密码更新失败，请稍后重试';
      setError(msg);
      return { success: false, error: msg };
    }
    // 更新成功：退出 recovery 模式，user 保持非 null，装备库直接可用
    setIsRecoveryMode(false);
    return { success: true, error: null };
  }

  // ── 退出 ────────────────────────────────────────────────────────────────────

  async function signOut(): Promise<void> {
    const db = getSupabase();
    if (!db) return;
    setError(null);
    setIsRecoveryMode(false);
    const { error: supaErr } = await db.auth.signOut();
    if (supaErr) {
      setError(supaErr.message ?? '退出失败');
    }
    // onAuthStateChange 会把 user 置 null
  }

  return {
    user, loading, error, isRecoveryMode,
    signInWithEmail,
    signUpWithPassword, signInWithPassword, resetPassword, updatePassword,
    signOut,
  };
}
