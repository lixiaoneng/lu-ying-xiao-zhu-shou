import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabase } from '../supabase';

export interface AuthState {
  /** 当前登录用户；null = 未登录；undefined 表示尚未完成初始化（不对外暴露，内部用 loading 表示） */
  user: User | null;
  /** true = getSession() 尚未返回，页面应展示 loading 状态 */
  loading: boolean;
  /** 最近一次操作的错误信息；null = 无错误 */
  error: string | null;
  /**
   * 发送魔法链接登录邮件。
   * 成功返回 { sent: true, error: null }；
   * 失败返回 { sent: false, error: '...' }。
   */
  signInWithEmail: (email: string) => Promise<{ sent: boolean; error: string | null }>;
  /** 退出登录。退出后 user 变为 null。 */
  signOut: () => Promise<void>;
}

/**
 * useAuth — 管理 Supabase Auth 登录状态。
 *
 * 设计原则：
 * - 不进入 AppContext，不影响计划功能主流程。
 * - getSession() 异步执行，初始 user = null + loading = true，
 *   不阻塞 App 渲染。
 * - 组件卸载时自动 unsubscribe onAuthStateChange 监听器。
 * - Supabase 未配置时（本地无 env），所有操作静默降级，不抛异常。
 */
export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const db = getSupabase();

    if (!db) {
      // Supabase 未配置（如缺少 env），直接结束 loading，user 保持 null
      setLoading(false);
      return;
    }

    // 1. 读取当前 session（异步，不阻塞外层渲染）
    db.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    // 2. 监听后续登录/登出/token 刷新等状态变化
    const { data: { subscription } } = db.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      // loading 在 getSession 回调里已置 false；
      // 后续 onAuthStateChange 触发时不需要再管 loading
    });

    // 3. 组件卸载时取消监听
    return () => {
      subscription.unsubscribe();
    };
  }, []); // 仅在 mount 时执行一次，无依赖项

  async function signInWithEmail(email: string): Promise<{ sent: boolean; error: string | null }> {
    const db = getSupabase();
    if (!db) {
      return { sent: false, error: 'Supabase 未配置，请联系开发者' };
    }

    setError(null);

    const { error: supaErr } = await db.auth.signInWithOtp({
      email,
      options: {
        // 魔法链接点击后跳回当前站点根路径
        // Supabase 会把 token 参数附加到 URL，client 自动解析并建立 session
        emailRedirectTo: window.location.origin,
      },
    });

    if (supaErr) {
      const msg = supaErr.message ?? '发送失败，请稍后重试';
      setError(msg);
      return { sent: false, error: msg };
    }

    return { sent: true, error: null };
  }

  async function signOut(): Promise<void> {
    const db = getSupabase();
    if (!db) return;

    setError(null);
    const { error: supaErr } = await db.auth.signOut();
    if (supaErr) {
      setError(supaErr.message ?? '退出失败');
    }
    // onAuthStateChange 会自动把 user 置为 null，无需手动 setUser
  }

  return { user, loading, error, signInWithEmail, signOut };
}
