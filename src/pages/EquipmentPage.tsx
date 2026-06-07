import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { isSupabaseConfigured } from '../supabase';
import {
  listEquipment, addEquipment, updateEquipment, deleteEquipment,
  type EquipmentItem, type NewEquipmentItem, type UpdateEquipmentItem,
} from '../equipment';
import { SYSTEM_CATEGORIES, SUPPLY_TYPE_LABELS, type SupplyType } from '../types';
import Modal from '../components/Modal';

// ─── Prop 接口 ────────────────────────────────────────────────────────────────

interface EquipmentPageProps {
  /** 返回上一级的回调；未接入主路由时可省略（用于 Step B1 独立测试） */
  onBack?: () => void;
}

// ─── 常量 ─────────────────────────────────────────────────────────────────────

const CUSTOM_OPTION = '__custom__';

const PLAN_TYPE_OPTIONS: { value: SupplyType; label: string }[] = [
  { value: 'personal', label: SUPPLY_TYPE_LABELS.personal },
  { value: 'food',     label: SUPPLY_TYPE_LABELS.food     },
  { value: 'gear',     label: SUPPLY_TYPE_LABELS.gear     },
];

/** 按 SYSTEM_CATEGORIES 预设顺序排序，自定义分类排末尾，"其他"永远最后 */
function sortCategories(cats: string[]): string[] {
  return [...cats].sort((a, b) => {
    if (a === '其他') return 1;
    if (b === '其他') return -1;
    const ai = SYSTEM_CATEGORIES.indexOf(a);
    const bi = SYSTEM_CATEGORIES.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b, 'zh');
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

/** 取装备的功能分类，无 system_category 时兜底"其他" */
function getItemCategory(item: EquipmentItem): string {
  return item.system_category || '其他';
}

// ─── 主页面 ───────────────────────────────────────────────────────────────────

export default function EquipmentPage({ onBack }: EquipmentPageProps) {
  const { user, loading: authLoading, signInWithEmail, signOut } = useAuth();

  // ── 登录表单状态 ──
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  // 发送成功后的倒计时（秒），> 0 时禁止再次发送
  const [countdown, setCountdown] = useState(0);

  // 倒计时递减：每秒 -1，降到 0 自然停止
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // ── 退出登录确认 ──
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  // ── 装备列表状态 ──
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // ── 二级分组折叠状态：key = category 名，true = 折叠 ──
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // ── 添加/编辑 Modal 状态 ──
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<EquipmentItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // 删除确认
  const [deleteTarget, setDeleteTarget] = useState<EquipmentItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── 表单字段 ──
  const [fName, setFName] = useState('');
  const [fCategorySelect, setFCategorySelect] = useState<string>(SYSTEM_CATEGORIES[0]);
  const [fCustomCategory, setFCustomCategory] = useState('');
  const [fPlanType, setFPlanType] = useState<SupplyType | ''>('');
  const [fQuantity, setFQuantity] = useState('');
  const [fNote, setFNote] = useState('');
  const [fFavorite, setFFavorite] = useState(false);

  const isCustomCategory = fCategorySelect === CUSTOM_OPTION;

  // ── 登录后加载装备 ──
  const loadItems = useCallback(async (uid: string) => {
    setItemsLoading(true);
    setListError(null);
    const { data, error } = await listEquipment(uid);
    setItemsLoading(false);
    if (error) { setListError(error); return; }
    setItems(data ?? []);
  }, []);

  useEffect(() => {
    if (user) {
      loadItems(user.id);
    } else {
      // 登出时清空本地列表
      setItems([]);
    }
  }, [user, loadItems]);

  // ─── 登录逻辑 ──────────────────────────────────────────────────────────────

  function formatLoginError(msg: string): string {
    const lower = msg.toLowerCase();
    if (
      lower.includes('rate') ||
      lower.includes('too many') ||
      lower.includes('429') ||
      lower.includes('email rate limit')
    ) {
      return '发送太频繁了，请稍等几分钟后再试。';
    }
    return msg;
  }

  async function handleSendMagicLink() {
    const trimmed = email.trim();
    if (!trimmed || countdown > 0 || sending) return;
    setSending(true);
    setLoginError(null);
    const { sent: ok, error } = await signInWithEmail(trimmed);
    setSending(false);
    if (ok) {
      setSent(true);
      setCountdown(60); // 发送成功后 60 秒内禁止重发
    } else {
      setLoginError(formatLoginError(error ?? '发送失败，请稍后重试'));
    }
  }

  // ─── 退出登录 ──────────────────────────────────────────────────────────────

  async function handleSignOut() {
    setShowSignOutConfirm(false);
    await signOut();
    setSent(false);
    setEmail('');
  }

  // ─── 表单操作 ──────────────────────────────────────────────────────────────

  function resolveCategory(): string {
    if (isCustomCategory) return fCustomCategory.trim() || '其他';
    return fCategorySelect;
  }

  function openAdd() {
    setEditItem(null);
    setFName('');
    setFCategorySelect(SYSTEM_CATEGORIES[0]);
    setFCustomCategory('');
    setFPlanType('');
    setFQuantity('');
    setFNote('');
    setFFavorite(false);
    setSaveError(null);
    setShowModal(true);
  }

  function openEdit(item: EquipmentItem) {
    setEditItem(item);
    setFName(item.name);
    const cat = item.system_category || '其他';
    if (SYSTEM_CATEGORIES.includes(cat)) {
      setFCategorySelect(cat);
      setFCustomCategory('');
    } else {
      setFCategorySelect(CUSTOM_OPTION);
      setFCustomCategory(cat);
    }
    setFPlanType((item.default_plan_type as SupplyType) ?? '');
    setFQuantity(item.quantity ?? '');
    setFNote(item.note ?? '');
    setFFavorite(item.is_favorite);
    setSaveError(null);
    setShowModal(true);
  }

  async function handleSave() {
    if (!fName.trim() || !user) return;
    setSaving(true);
    setSaveError(null);

    const sysCategory = resolveCategory();
    const planType = fPlanType || null;

    if (editItem) {
      const patch: UpdateEquipmentItem = {
        name: fName.trim(),
        system_category: sysCategory,
        default_plan_type: planType as SupplyType | null,
        quantity: fQuantity.trim() || null,
        note: fNote.trim() || null,
        is_favorite: fFavorite,
      };
      const { error } = await updateEquipment(editItem.id, patch);
      setSaving(false);
      if (error) { setSaveError(error); return; }
      setItems(prev => prev.map(it =>
        it.id === editItem.id
          ? { ...it, ...patch, updated_at: new Date().toISOString() }
          : it
      ));
    } else {
      const input: NewEquipmentItem = {
        user_id: user.id,
        name: fName.trim(),
        system_category: sysCategory,
        default_plan_type: planType as SupplyType | null,
        quantity: fQuantity.trim() || null,
        note: fNote.trim() || null,
        is_favorite: fFavorite,
      };
      const { data, error } = await addEquipment(input);
      setSaving(false);
      if (error || !data) { setSaveError(error ?? '添加失败'); return; }
      // 新增的装备插入列表最前（is_favorite 排序由后端处理，刷新即生效）
      setItems(prev => [data, ...prev]);
    }
    setShowModal(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await deleteEquipment(deleteTarget.id);
    setDeleting(false);
    if (error) {
      setDeleteTarget(null);
      return;
    }
    setItems(prev => prev.filter(it => it.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  function toggleCollapse(cat: string) {
    setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }));
  }

  // ─── 派生数据 ──────────────────────────────────────────────────────────────

  const categoryNames = sortCategories([...new Set(items.map(getItemCategory))]);

  // ─── 渲染 ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>

      {/* ── Header ── */}
      <header style={{
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        padding: '0 16px',
        height: 'var(--header-height)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        position: 'sticky',
        top: 0,
        zIndex: 400,
        flexShrink: 0,
      }}>
        {onBack && (
          <button className="btn-icon" onClick={onBack} style={{ fontSize: 20, flexShrink: 0 }}>
            ←
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'ZCOOL XiaoWei, serif',
            fontSize: 17,
            color: 'var(--text)',
          }}>
            🎒 装备大本营
          </div>
          {user && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
              {user.email}
            </div>
          )}
        </div>
        {user && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowSignOutConfirm(true)}
            style={{ flexShrink: 0, fontSize: 12 }}
          >
            退出
          </button>
        )}
      </header>

      {/* ── 主内容区 ── */}
      <div className="page-scroll" style={{ padding: '20px 14px 100px' }}>

        {/* ── Supabase 未配置 ── */}
        {!isSupabaseConfigured() && (
          <div style={{
            background: 'var(--primary-dim)', border: '1px solid var(--primary-border)',
            borderRadius: 'var(--radius-sm)', padding: '24px 20px',
            textAlign: 'center', marginTop: 40,
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔧</div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>云端功能暂不可用</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              装备大本营需要云端支持，请联系开发者配置。
            </div>
          </div>
        )}

        {/* ── Auth 初始化 loading ── */}
        {isSupabaseConfigured() && authLoading && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
            <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>加载中…</div>
          </div>
        )}

        {/* ── 未登录：邮件已发送 ── */}
        {isSupabaseConfigured() && !authLoading && !user && sent && (
          <SentScreen
            email={email}
            countdown={countdown}
            onResend={() => { setSent(false); }}
            onChangeEmail={() => { setSent(false); setEmail(''); setCountdown(0); }}
          />
        )}

        {/* ── 未登录：登录引导 ── */}
        {isSupabaseConfigured() && !authLoading && !user && !sent && (
          <LoginGuide
            email={email}
            onEmailChange={setEmail}
            onSend={handleSendMagicLink}
            sending={sending}
            countdown={countdown}
            error={loginError}
          />
        )}

        {/* ── 已登录：装备库 ── */}
        {isSupabaseConfigured() && !authLoading && user && (
          <>
            {/* 装备列表加载中 */}
            {itemsLoading && (
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
                <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>加载装备库…</div>
              </div>
            )}

            {/* 列表错误 */}
            {!itemsLoading && listError && (
              <div style={{
                background: 'var(--red-dim)', border: '1px solid var(--red)',
                borderRadius: 'var(--radius-sm)', padding: '12px 14px',
                fontSize: 13, color: 'var(--red)', marginBottom: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
              }}>
                <span>加载失败：{listError}</span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => loadItems(user.id)}
                  style={{ flexShrink: 0 }}
                >重试</button>
              </div>
            )}

            {/* 空状态 */}
            {!itemsLoading && !listError && items.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">🎒</div>
                <p>还没有保存任何装备<br />点击右下角 ＋ 开始添加</p>
              </div>
            )}

            {/* 分组列表 */}
            {!itemsLoading && items.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {categoryNames.map(cat => {
                  const catItems = items.filter(it => getItemCategory(it) === cat);
                  if (catItems.length === 0) return null;
                  const isCollapsed = !!collapsed[cat];
                  return (
                    <div key={cat}>
                      {/* 分组标题行（整行可点） */}
                      <button
                        onClick={() => toggleCollapse(cat)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center',
                          gap: 8, padding: '7px 10px',
                          background: 'var(--bg-warm)',
                          border: '1px solid var(--border)',
                          borderRadius: isCollapsed
                            ? 'var(--radius-xs)'
                            : 'var(--radius-xs) var(--radius-xs) 0 0',
                          cursor: 'pointer', textAlign: 'left',
                        }}
                      >
                        <span style={{
                          fontSize: 11,
                          transform: isCollapsed ? 'rotate(-90deg)' : 'none',
                          display: 'inline-block',
                          transition: 'transform 0.2s',
                          color: 'var(--text-muted)',
                        }}>▼</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', flex: 1 }}>
                          {cat}
                        </span>
                        <span style={{
                          fontSize: 12, color: 'var(--text-light)',
                          background: 'var(--card)', border: '1px solid var(--border)',
                          borderRadius: 10, padding: '1px 7px',
                        }}>{catItems.length}</span>
                      </button>

                      {/* 分组内容 */}
                      {!isCollapsed && (
                        <div style={{
                          border: '1px solid var(--border)', borderTop: 'none',
                          borderRadius: '0 0 var(--radius-xs) var(--radius-xs)',
                          overflow: 'hidden',
                        }}>
                          {catItems.map((item, idx) => (
                            <div
                              key={item.id}
                              style={{ borderTop: idx > 0 ? '1px solid var(--border)' : 'none' }}
                            >
                              <EquipmentCard
                                item={item}
                                onEdit={() => openEdit(item)}
                                onDelete={() => setDeleteTarget(item)}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── FAB（仅已登录时显示）── */}
      {isSupabaseConfigured() && !authLoading && user && (
        <button
          className="fab"
          onClick={openAdd}
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
        >
          ＋
        </button>
      )}

      {/* ── 退出登录确认 ── */}
      {showSignOutConfirm && (
        <div
          onClick={() => setShowSignOutConfirm(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1001,
            background: 'rgba(44,26,14,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 24px', animation: 'fadeIn 0.2s ease',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--card)', borderRadius: 20,
              padding: '24px 20px', textAlign: 'center',
              animation: 'slideUp 0.25s ease',
              maxWidth: 320, width: '100%',
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 10 }}>👋</div>
            <h3 style={{ fontSize: 16, marginBottom: 6 }}>确认退出登录？</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
              退出后装备库仍保存在云端，<br />下次登录可继续使用
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setShowSignOutConfirm(false)} style={{ flex: 1 }}>
                取消
              </button>
              <button className="btn btn-danger" onClick={handleSignOut} style={{ flex: 1 }}>
                确认退出
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 删除确认 ── */}
      {deleteTarget && (
        <div
          onClick={() => { if (!deleting) setDeleteTarget(null); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 1001,
            background: 'rgba(44,26,14,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 24px', animation: 'fadeIn 0.2s ease',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--card)', borderRadius: 20,
              padding: '24px 20px', textAlign: 'center',
              animation: 'slideUp 0.25s ease',
              maxWidth: 320, width: '100%',
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 10 }}>🗑️</div>
            <h3 style={{ fontSize: 16, marginBottom: 6 }}>确认删除装备？</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
              「{deleteTarget.name}」删除后无法恢复
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn-ghost"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                style={{ flex: 1 }}
              >
                取消
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={deleting}
                style={{ flex: 1 }}
              >
                {deleting ? '删除中…' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 添加/编辑 Modal ── */}
      <Modal
        isOpen={showModal}
        onClose={() => { if (!saving) setShowModal(false); }}
        title={editItem ? '编辑装备' : '添加装备'}
        footer={
          <>
            {saveError && (
              <p style={{ fontSize: 12, color: 'var(--red)', marginBottom: 10, textAlign: 'center' }}>
                {saveError}
              </p>
            )}
            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={handleSave}
              disabled={!fName.trim() || saving}
            >
              {saving ? '保存中…' : editItem ? '保存修改' : '添加装备'}
            </button>
          </>
        }
      >
        {/* 装备名称 */}
        <div className="form-group">
          <label className="form-label">装备名称 *</label>
          <input
            className="input"
            placeholder="例：双人帐篷、头灯、卡式炉"
            value={fName}
            onChange={e => setFName(e.target.value)}
            maxLength={20}
            autoFocus
          />
        </div>

        {/* 功能分类 */}
        <div className="form-group">
          <label className="form-label">功能分类</label>
          <select
            className="input"
            value={fCategorySelect}
            onChange={e => setFCategorySelect(e.target.value)}
          >
            {SYSTEM_CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
            <option value={CUSTOM_OPTION}>自定义分类…</option>
          </select>
          {isCustomCategory && (
            <input
              className="input"
              style={{ marginTop: 8 }}
              placeholder="输入自定义分类名称"
              value={fCustomCategory}
              onChange={e => setFCustomCategory(e.target.value)}
              maxLength={20}
            />
          )}
        </div>

        {/* 默认类型 */}
        <div className="form-group">
          <label className="form-label">默认类型（可选）</label>
          <select
            className="input"
            value={fPlanType}
            onChange={e => setFPlanType(e.target.value as SupplyType | '')}
          >
            <option value="">不指定</option>
            {PLAN_TYPE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 2 }}>
            导入计划时的默认归属（后续版本支持）
          </div>
        </div>

        {/* 默认数量 */}
        <div className="form-group">
          <label className="form-label">默认数量（可选）</label>
          <input
            className="input"
            placeholder="例：1顶、2个、1套"
            value={fQuantity}
            onChange={e => setFQuantity(e.target.value)}
            maxLength={20}
          />
        </div>

        {/* 备注 */}
        <div className="form-group">
          <label className="form-label">备注（可选）</label>
          <input
            className="input"
            placeholder="品牌、注意事项等"
            value={fNote}
            onChange={e => setFNote(e.target.value)}
            maxLength={40}
          />
        </div>

        {/* 常用开关 */}
        <div className="toggle-wrap">
          <div>
            <div style={{ fontSize: 14, color: 'var(--text)' }}>⭐ 常用装备</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              常用装备会优先展示
            </div>
          </div>
          <button
            className={`toggle${fFavorite ? ' on' : ''}`}
            onClick={() => setFFavorite(!fFavorite)}
          />
        </div>
      </Modal>
    </div>
  );
}

// ─── 子组件 ───────────────────────────────────────────────────────────────────

/** 登录引导页 */
function LoginGuide({
  email, onEmailChange, onSend, sending, countdown, error,
}: {
  email: string;
  onEmailChange: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  countdown: number;
  error: string | null;
}) {
  const canSend = !!email.trim() && !sending && countdown <= 0;

  return (
    <div style={{ maxWidth: 380, margin: '0 auto', paddingTop: 32 }}>
      {/* 图标 + 标题 */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 56, marginBottom: 16, lineHeight: 1 }}>🎒</div>
        <h2 style={{
          fontFamily: 'ZCOOL XiaoWei, serif',
          fontSize: 22, color: 'var(--text)', marginBottom: 12,
        }}>
          装备大本营
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.8 }}>
          登录后保存你的常用露营装备<br />
          下次出行不用从零整理
        </p>
      </div>

      {/* 登录表单 */}
      <div className="card" style={{ padding: '20px 16px' }}>
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label className="form-label">邮箱地址</label>
          <input
            className="input"
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={e => onEmailChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && canSend) onSend(); }}
            autoFocus
          />
        </div>

        {error && (
          <div style={{
            fontSize: 13, color: 'var(--red)',
            background: 'var(--red-dim)', borderRadius: 8,
            padding: '8px 12px', marginBottom: 12,
          }}>
            {error}
          </div>
        )}

        <button
          className="btn btn-primary"
          style={{ width: '100%' }}
          onClick={onSend}
          disabled={!canSend}
        >
          {sending ? '发送中…' : countdown > 0 ? `重新发送（${countdown}s）` : '发送登录链接'}
        </button>
      </div>

      <p style={{
        fontSize: 12, color: 'var(--text-light)',
        textAlign: 'center', marginTop: 16, lineHeight: 1.7,
      }}>
        无需设置密码，点击邮件中的链接即可登录<br />
        链接发送后有效期 60 分钟
      </p>
    </div>
  );
}

/** 邮件已发送提示页 */
function SentScreen({
  email, countdown, onResend, onChangeEmail,
}: {
  email: string;
  countdown: number;
  onResend: () => void;
  onChangeEmail: () => void;
}) {
  return (
    <div style={{ maxWidth: 380, margin: '0 auto', paddingTop: 32, textAlign: 'center' }}>
      <div style={{ fontSize: 56, marginBottom: 16, lineHeight: 1 }}>📬</div>
      <h2 style={{
        fontFamily: 'ZCOOL XiaoWei, serif',
        fontSize: 20, color: 'var(--text)', marginBottom: 12,
      }}>
        登录链接已发送
      </h2>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.8, marginBottom: 8 }}>
        链接已发送到
      </p>
      <p style={{
        fontSize: 15, fontWeight: 600, color: 'var(--text)',
        background: 'var(--bg-warm)', borderRadius: 8,
        padding: '8px 16px', display: 'inline-block', marginBottom: 16,
      }}>
        {email}
      </p>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.8, marginBottom: 28 }}>
        请检查收件箱，点击「登录」链接完成登录。<br />
        如果没看到，也可以查看垃圾邮件/广告邮件。<br />
        链接有效期 60 分钟。
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          className="btn btn-primary"
          style={{ width: '100%' }}
          onClick={onResend}
          disabled={countdown > 0}
        >
          {countdown > 0 ? `重新发送（${countdown}s）` : '重新发送'}
        </button>
        <button className="btn btn-ghost" style={{ width: '100%' }} onClick={onChangeEmail}>
          修改邮箱地址
        </button>
      </div>
    </div>
  );
}

/** 单条装备卡片 */
function EquipmentCard({
  item, onEdit, onDelete,
}: {
  item: EquipmentItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div style={{
      background: 'var(--card)',
      borderLeft: `3.5px solid ${item.is_favorite ? 'var(--primary)' : 'var(--border-dark)'}`,
      padding: '11px 12px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    }}>
      {/* 常用星标 */}
      <div style={{ fontSize: 14, flexShrink: 0, opacity: item.is_favorite ? 1 : 0.2 }}>
        ⭐
      </div>

      {/* 内容 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>
          {item.name}
          {item.quantity && (
            <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>
              {item.quantity}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 5, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          {item.default_plan_type && (
            <span className="tag tag-gray">
              {SUPPLY_TYPE_LABELS[item.default_plan_type]}
            </span>
          )}
          {item.note && (
            <span style={{ fontSize: 12, color: 'var(--text-light)' }}>{item.note}</span>
          )}
        </div>
      </div>

      {/* 操作 */}
      <button className="btn-icon" onClick={onEdit} style={{ fontSize: 16 }}>✏️</button>
      <button className="btn-icon" onClick={onDelete} style={{ fontSize: 16 }}>🗑️</button>
    </div>
  );
}
