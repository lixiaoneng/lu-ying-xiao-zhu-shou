import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { isSupabaseConfigured } from '../supabase';
import {
  listEquipment, addEquipment, updateEquipment, deleteEquipment,
  type EquipmentItem, type NewEquipmentItem, type UpdateEquipmentItem,
} from '../equipment';
import { SYSTEM_CATEGORIES, SUPPLY_TYPE_LABELS, type SupplyType } from '../types';
import Modal from '../components/Modal';
import Footer from '../components/Footer';

// ─── 认证视图类型 ──────────────────────────────────────────────────────────────

type AuthView =
  | 'login'
  | 'register'
  | 'forgot'
  | 'reset-sent'
  | 'magic-link'
  | 'magic-link-sent';

/** 视图导航函数；email 可选，用于 sent 页面显示目标邮箱 */
type Navigate = (view: AuthView, email?: string) => void;

// ─── 装备库视图类型 ─────────────────────────────────────────────────────────────

type EquipView = 'overview' | 'category';

// ─── 常量 ─────────────────────────────────────────────────────────────────────

const CUSTOM_OPTION = '__custom__';

const PLAN_TYPE_OPTIONS: { value: SupplyType; label: string }[] = [
  { value: 'personal', label: SUPPLY_TYPE_LABELS.personal },
  { value: 'food',     label: SUPPLY_TYPE_LABELS.food     },
  { value: 'gear',     label: SUPPLY_TYPE_LABELS.gear     },
];

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

/** 取装备的功能分类，无 system_category 时兜底"其他" */
function getItemCategory(item: EquipmentItem): string {
  return item.system_category || '其他';
}

/** 将 Supabase 错误信息转为用户友好的中文提示 */
function formatAuthError(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes('user already registered') || lower.includes('already registered')) {
    return '该邮箱已有账号，请直接登录；如果你之前用过邮箱链接登录，请点击「忘记密码」设置密码。';
  }
  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
    return '邮箱或密码不正确。';
  }
  if (
    lower.includes('rate') ||
    lower.includes('too many') ||
    lower.includes('429') ||
    lower.includes('email rate limit')
  ) {
    return '发送太频繁了，请稍等几分钟后再试。';
  }
  if (
    lower.includes('password should be at least') ||
    lower.includes('password is too short') ||
    lower.includes('at least 6')
  ) {
    return '密码至少需要 6 位。';
  }
  return msg;
}

// ─── Prop 接口 ────────────────────────────────────────────────────────────────

interface EquipmentPageProps {
  onBack?: () => void;
}

// ─── 主页面 ───────────────────────────────────────────────────────────────────

export default function EquipmentPage({ onBack }: EquipmentPageProps) {
  const {
    user, loading: authLoading, isRecoveryMode,
    signInWithEmail, signUpWithPassword, signInWithPassword,
    resetPassword, updatePassword, signOut,
  } = useAuth();

  // ── 退出登录确认 ──
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  // ── 装备列表状态 ──
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // ── 添加/编辑 Modal 状态 ──
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<EquipmentItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── 删除确认 ──
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

  // ── 装备库视图：overview = 分类总览，category = 分类详情 ──
  const [equipView, setEquipView] = useState<EquipView>('overview');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

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
    if (user && !isRecoveryMode) {
      loadItems(user.id);
    } else if (!user) {
      setItems([]);
      setEquipView('overview');
    }
  }, [user, isRecoveryMode, loadItems]);

  // ─── 退出登录 ──────────────────────────────────────────────────────────────

  async function handleSignOut() {
    setShowSignOutConfirm(false);
    await signOut();
    // onAuthStateChange 会把 user 置 null；AuthSection 自动重置到 login 视图
  }

  // ─── 表单操作 ──────────────────────────────────────────────────────────────

  function resolveCategory(): string {
    if (isCustomCategory) return fCustomCategory.trim() || '其他';
    return fCategorySelect;
  }

  function openAdd(prefillCategory?: string) {
    setEditItem(null);
    setFName('');
    const cat = prefillCategory ?? SYSTEM_CATEGORIES[0];
    if (SYSTEM_CATEGORIES.includes(cat)) {
      setFCategorySelect(cat);
      setFCustomCategory('');
    } else {
      setFCategorySelect(CUSTOM_OPTION);
      setFCustomCategory(cat);
    }
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
      setItems(prev => [data, ...prev]);
    }
    setShowModal(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await deleteEquipment(deleteTarget.id);
    setDeleting(false);
    if (error) { setDeleteTarget(null); return; }
    setItems(prev => prev.filter(it => it.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  // ─── 派生数据 ──────────────────────────────────────────────────────────────

  // 总览：SYSTEM_CATEGORIES 全量展示 + 自定义分类（有装备时，排预设之后）
  const itemCategorySet = new Set(items.map(getItemCategory));
  const customCats = [...itemCategorySet]
    .filter(c => !SYSTEM_CATEGORIES.includes(c))
    .sort((a, b) => a.localeCompare(b, 'zh'));
  const overviewCategories = [
    ...SYSTEM_CATEGORIES.filter(c => c !== '其他'),
    ...customCats,
    '其他',
  ];
  const totalFavorites = items.filter(it => it.is_favorite).length;

  // 分类详情：当前选中分类下的装备
  const catItems = equipView === 'category'
    ? items.filter(it => getItemCategory(it) === selectedCategory)
    : [];

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
        {(onBack || (user && !isRecoveryMode && equipView === 'category')) && (
          <button
            className="btn-icon"
            onClick={() => {
              if (user && !isRecoveryMode && equipView === 'category') {
                setEquipView('overview');
              } else {
                onBack?.();
              }
            }}
            style={{ fontSize: 20, flexShrink: 0 }}
          >
            ←
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'ZCOOL XiaoWei, serif', fontSize: 17, color: 'var(--text)' }}>
            {user && !isRecoveryMode && equipView === 'category' ? selectedCategory : '🎒 装备大本营'}
          </div>
          {user && !isRecoveryMode && equipView !== 'category' && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
              {user.email}
            </div>
          )}
        </div>
        {user && !isRecoveryMode && (
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

        {/* ── 密码重置模式：设置新密码 ── */}
        {isSupabaseConfigured() && !authLoading && isRecoveryMode && (
          <SetNewPasswordView updatePassword={updatePassword} />
        )}

        {/* ── 未登录：认证区域 ── */}
        {isSupabaseConfigured() && !authLoading && !user && !isRecoveryMode && (
          <AuthSection
            signInWithPassword={signInWithPassword}
            signUpWithPassword={signUpWithPassword}
            resetPassword={resetPassword}
            signInWithEmail={signInWithEmail}
          />
        )}

        {/* ── 已登录：装备库 ── */}
        {isSupabaseConfigured() && !authLoading && user && !isRecoveryMode && (
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

            {/* ── 分类总览视图 ── */}
            {!itemsLoading && !listError && equipView === 'overview' && (
              <>
                {/* 顶部概览区 */}
                <div style={{
                  background: 'var(--primary-dim)',
                  border: '1px solid var(--primary-border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '14px 16px',
                  marginBottom: 14,
                }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                    已收纳 {items.length} 件装备
                    {totalFavorites > 0 && (
                      <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>
                        · ⭐ {totalFavorites} 件常用
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    按露营系统整理装备，下次出行更省心。
                  </div>
                </div>

                {/* 分类卡片网格 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {overviewCategories.map(cat => {
                    const cardItems = items.filter(it => getItemCategory(it) === cat);
                    const favCount = cardItems.filter(it => it.is_favorite).length;
                    const samples = cardItems.slice(0, 2).map(it => it.name);
                    const isEmpty = cardItems.length === 0;
                    return (
                      <button
                        key={cat}
                        onClick={() => { setSelectedCategory(cat); setEquipView('category'); }}
                        style={{
                          background: isEmpty ? 'var(--bg-warm)' : 'var(--card)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-xs)',
                          padding: '12px 12px',
                          textAlign: 'left',
                          cursor: 'pointer',
                          minHeight: 82,
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>
                            {cat}
                          </span>
                          <span style={{ fontSize: 14, color: 'var(--text-light)', marginLeft: 4, flexShrink: 0 }}>
                            →
                          </span>
                        </div>
                        {isEmpty ? (
                          <div style={{ fontSize: 12, color: 'var(--primary)', marginTop: 10 }}>
                            点击添加第一件
                          </div>
                        ) : (
                          <div style={{ marginTop: 8 }}>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>
                              {cardItems.length} 件{favCount > 0 ? ` · ⭐ ${favCount}` : ''}
                            </div>
                            <div style={{
                              fontSize: 12, color: 'var(--text-light)',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                              {samples.join('、')}{cardItems.length > 2 ? '…' : ''}
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* ── 分类详情视图 ── */}
            {!itemsLoading && !listError && equipView === 'category' && (
              catItems.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🎒</div>
                  <p>{selectedCategory} 还没有装备<br />点击右下角 ＋ 添加第一件</p>
                </div>
              ) : (
                <div style={{
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-xs)',
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
              )
            )}
          </>
        )}

        <Footer />
      </div>

      {/* ── FAB：分类详情页主 FAB（预填分类），总览页轻量 FAB ── */}
      {isSupabaseConfigured() && !authLoading && user && !isRecoveryMode && equipView === 'category' && (
        <button
          className="fab"
          onClick={() => openAdd(selectedCategory)}
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
        >
          ＋
        </button>
      )}
      {isSupabaseConfigured() && !authLoading && user && !isRecoveryMode && equipView === 'overview' && (
        <button
          onClick={() => openAdd()}
          style={{
            position: 'fixed',
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)',
            right: 20,
            width: 42,
            height: 42,
            borderRadius: '50%',
            background: 'var(--bg-warm)',
            border: '1.5px solid var(--border-dark)',
            color: 'var(--text-muted)',
            fontSize: 20,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 500,
            boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
          }}
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

// ─── 认证区域（统一管理视图状态）─────────────────────────────────────────────

interface AuthSectionProps {
  signInWithPassword: (e: string, p: string) => Promise<{ success: boolean; error: string | null }>;
  signUpWithPassword: (e: string, p: string) => Promise<{ success: boolean; error: string | null }>;
  resetPassword: (e: string) => Promise<{ sent: boolean; error: string | null }>;
  signInWithEmail: (e: string) => Promise<{ sent: boolean; error: string | null }>;
}

function AuthSection({
  signInWithPassword, signUpWithPassword, resetPassword, signInWithEmail,
}: AuthSectionProps) {
  const [view, setView] = useState<AuthView>('login');
  // 传给 sent 页面显示目标邮箱 / 提供 resend 功能
  const [sentEmail, setSentEmail] = useState('');

  function navigate(v: AuthView, email?: string) {
    if (email !== undefined) setSentEmail(email);
    setView(v);
  }

  if (view === 'login') {
    return <LoginView signInWithPassword={signInWithPassword} onNavigate={navigate} />;
  }
  if (view === 'register') {
    return <RegisterView signUpWithPassword={signUpWithPassword} onNavigate={navigate} />;
  }
  if (view === 'forgot') {
    return <ForgotView resetPassword={resetPassword} onNavigate={navigate} />;
  }
  if (view === 'reset-sent') {
    return <ResetSentView email={sentEmail} resetPassword={resetPassword} onNavigate={navigate} />;
  }
  if (view === 'magic-link') {
    return <MagicLinkView signInWithEmail={signInWithEmail} onNavigate={navigate} />;
  }
  // magic-link-sent
  return <MagicLinkSentView email={sentEmail} signInWithEmail={signInWithEmail} onNavigate={navigate} />;
}

// ─── 登录视图 ─────────────────────────────────────────────────────────────────

function LoginView({ signInWithPassword, onNavigate }: {
  signInWithPassword: (e: string, p: string) => Promise<{ success: boolean; error: string | null }>;
  onNavigate: Navigate;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password || submitting) return;
    setSubmitting(true);
    setError(null);
    const { error: e } = await signInWithPassword(email.trim(), password);
    setSubmitting(false);
    if (e) setError(formatAuthError(e));
    // 成功时 onAuthStateChange → user 非 null → EquipmentPage 自动展示装备库
  }

  return (
    <div style={{ maxWidth: 380, margin: '0 auto', paddingTop: 32 }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 12 }}>🎒</div>
        <h2 style={{ fontFamily: 'ZCOOL XiaoWei, serif', fontSize: 22, color: 'var(--text)', marginBottom: 8 }}>
          装备大本营
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7 }}>
          登录后保存你的常用露营装备<br />下次出行不用从零整理
        </p>
      </div>

      <div className="card" style={{ padding: '20px 16px' }}>
        <div className="form-group">
          <label className="form-label">邮箱地址</label>
          <input
            className="input"
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoFocus
            autoComplete="email"
          />
        </div>
        <div className="form-group">
          <label className="form-label">密码</label>
          <div style={{ position: 'relative' }}>
            <input
              className="input"
              type={showPwd ? 'text' : 'password'}
              placeholder="请输入密码"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && email.trim() && password) handleLogin(); }}
              autoComplete="current-password"
              style={{ paddingRight: 52 }}
            />
            <button
              type="button"
              onClick={() => setShowPwd(!showPwd)}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, color: 'var(--text-muted)', padding: '4px 6px',
              }}
            >{showPwd ? '隐藏' : '显示'}</button>
          </div>
        </div>

        {error && (
          <div style={{
            fontSize: 13, color: 'var(--red)', background: 'var(--red-dim)',
            borderRadius: 8, padding: '8px 12px', marginBottom: 12, lineHeight: 1.5,
          }}>{error}</div>
        )}

        <button
          className="btn btn-primary"
          style={{ width: '100%' }}
          onClick={handleLogin}
          disabled={!email.trim() || !password || submitting}
        >
          {submitting ? '登录中…' : '登录'}
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
          <button
            className="btn btn-ghost"
            style={{ padding: '4px 0', fontSize: 13, color: 'var(--primary)' }}
            onClick={() => onNavigate('register')}
          >
            注册新账号
          </button>
          <button
            className="btn btn-ghost"
            style={{ padding: '4px 0', fontSize: 13, color: 'var(--text-muted)' }}
            onClick={() => onNavigate('forgot')}
          >
            忘记密码？
          </button>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 20 }}>
        <button
          className="btn btn-ghost"
          style={{ fontSize: 13, color: 'var(--text-light)' }}
          onClick={() => onNavigate('magic-link')}
        >
          或者，用邮箱链接登录
        </button>
      </div>
    </div>
  );
}

// ─── 注册视图 ─────────────────────────────────────────────────────────────────

function RegisterView({ signUpWithPassword, onNavigate }: {
  signUpWithPassword: (e: string, p: string) => Promise<{ success: boolean; error: string | null }>;
  onNavigate: Navigate;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleRegister() {
    if (!email.trim() || !password || submitting) return;
    if (password.length < 6) { setError('密码至少需要 6 位。'); return; }
    if (password !== confirm) { setError('两次输入的密码不一致。'); return; }
    setSubmitting(true);
    setError(null);
    const { error: e } = await signUpWithPassword(email.trim(), password);
    setSubmitting(false);
    if (e) setError(formatAuthError(e));
    // 成功时 onAuthStateChange → user 非 null → 直接进装备库
  }

  return (
    <div style={{ maxWidth: 380, margin: '0 auto', paddingTop: 32 }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 12 }}>🎒</div>
        <h2 style={{ fontFamily: 'ZCOOL XiaoWei, serif', fontSize: 22, color: 'var(--text)' }}>
          创建账号
        </h2>
      </div>

      <div className="card" style={{ padding: '20px 16px' }}>
        <div className="form-group">
          <label className="form-label">邮箱地址</label>
          <input
            className="input"
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoFocus
            autoComplete="email"
          />
        </div>
        <div className="form-group">
          <label className="form-label">密码（至少 6 位）</label>
          <div style={{ position: 'relative' }}>
            <input
              className="input"
              type={showPwd ? 'text' : 'password'}
              placeholder="设置密码"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
              style={{ paddingRight: 52 }}
            />
            <button
              type="button"
              onClick={() => setShowPwd(!showPwd)}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, color: 'var(--text-muted)', padding: '4px 6px',
              }}
            >{showPwd ? '隐藏' : '显示'}</button>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">确认密码</label>
          <input
            className="input"
            type="password"
            placeholder="再次输入密码"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </div>

        {error && (
          <div style={{
            fontSize: 13, color: 'var(--red)', background: 'var(--red-dim)',
            borderRadius: 8, padding: '8px 12px', marginBottom: 12, lineHeight: 1.5,
          }}>{error}</div>
        )}

        <button
          className="btn btn-primary"
          style={{ width: '100%' }}
          onClick={handleRegister}
          disabled={!email.trim() || !password || !confirm || submitting}
        >
          {submitting ? '注册中…' : '注册'}
        </button>

        <button
          className="btn btn-ghost"
          style={{ width: '100%', marginTop: 10, fontSize: 13 }}
          onClick={() => onNavigate('login')}
        >
          已有账号？去登录
        </button>
      </div>

      <div style={{
        marginTop: 14, padding: '10px 14px',
        background: 'var(--primary-dim)', borderRadius: 'var(--radius-xs)',
        fontSize: 12, color: 'var(--primary)', lineHeight: 1.6,
      }}>
        💡 如果你之前曾用邮箱链接登录过，请使用「忘记密码」来设置一个密码。
      </div>
    </div>
  );
}

// ─── 忘记密码视图 ─────────────────────────────────────────────────────────────

function ForgotView({ resetPassword, onNavigate }: {
  resetPassword: (e: string) => Promise<{ sent: boolean; error: string | null }>;
  onNavigate: Navigate;
}) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleReset() {
    if (!email.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    const { sent, error: e } = await resetPassword(email.trim());
    setSubmitting(false);
    if (sent) {
      onNavigate('reset-sent', email.trim());
    } else {
      setError(formatAuthError(e ?? '发送失败，请稍后重试'));
    }
  }

  return (
    <div style={{ maxWidth: 380, margin: '0 auto', paddingTop: 32 }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 48, lineHeight: 1, marginBottom: 12 }}>🔑</div>
        <h2 style={{ fontFamily: 'ZCOOL XiaoWei, serif', fontSize: 20, color: 'var(--text)', marginBottom: 8 }}>
          重置密码
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7 }}>
          输入邮箱，我们发送重置链接给你
        </p>
      </div>

      <div className="card" style={{ padding: '20px 16px' }}>
        <div className="form-group">
          <label className="form-label">邮箱地址</label>
          <input
            className="input"
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && email.trim() && !submitting) handleReset(); }}
            autoFocus
            autoComplete="email"
          />
        </div>

        {error && (
          <div style={{
            fontSize: 13, color: 'var(--red)', background: 'var(--red-dim)',
            borderRadius: 8, padding: '8px 12px', marginBottom: 12,
          }}>{error}</div>
        )}

        <button
          className="btn btn-primary"
          style={{ width: '100%' }}
          onClick={handleReset}
          disabled={!email.trim() || submitting}
        >
          {submitting ? '发送中…' : '发送重置链接'}
        </button>

        <button
          className="btn btn-ghost"
          style={{ width: '100%', marginTop: 10, fontSize: 13 }}
          onClick={() => onNavigate('login')}
        >
          ← 返回登录
        </button>
      </div>
    </div>
  );
}

// ─── 重置邮件已发送视图 ───────────────────────────────────────────────────────

function ResetSentView({ email, resetPassword, onNavigate }: {
  email: string;
  resetPassword: (e: string) => Promise<{ sent: boolean; error: string | null }>;
  onNavigate: Navigate;
}) {
  const [countdown, setCountdown] = useState(60);
  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  async function handleResend() {
    if (countdown > 0 || resending || !email) return;
    setResending(true);
    setResendError(null);
    const { sent, error: e } = await resetPassword(email);
    setResending(false);
    if (sent) {
      setCountdown(60);
    } else {
      setResendError(formatAuthError(e ?? '发送失败'));
    }
  }

  return (
    <div style={{ maxWidth: 380, margin: '0 auto', paddingTop: 32, textAlign: 'center' }}>
      <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 16 }}>📬</div>
      <h2 style={{ fontFamily: 'ZCOOL XiaoWei, serif', fontSize: 20, color: 'var(--text)', marginBottom: 12 }}>
        重置链接已发送
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
      <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.8, marginBottom: 24 }}>
        请检查收件箱，点击链接设置新密码。<br />
        如果没看到，也可以查看垃圾邮件/广告邮件。<br />
        链接有效期 60 分钟。
      </p>

      {resendError && (
        <div style={{
          fontSize: 13, color: 'var(--red)', background: 'var(--red-dim)',
          borderRadius: 8, padding: '8px 12px', marginBottom: 12,
        }}>{resendError}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          className="btn btn-primary"
          style={{ width: '100%' }}
          onClick={handleResend}
          disabled={countdown > 0 || resending}
        >
          {resending ? '发送中…' : countdown > 0 ? `重新发送（${countdown}s）` : '重新发送'}
        </button>
        <button
          className="btn btn-ghost"
          style={{ width: '100%', fontSize: 13 }}
          onClick={() => onNavigate('login')}
        >
          返回登录
        </button>
      </div>
    </div>
  );
}

// ─── Magic Link 视图 ──────────────────────────────────────────────────────────

function MagicLinkView({ signInWithEmail, onNavigate }: {
  signInWithEmail: (e: string) => Promise<{ sent: boolean; error: string | null }>;
  onNavigate: Navigate;
}) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSend() {
    if (!email.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    const { sent, error: e } = await signInWithEmail(email.trim());
    setSubmitting(false);
    if (sent) {
      onNavigate('magic-link-sent', email.trim());
    } else {
      setError(formatAuthError(e ?? '发送失败，请稍后重试'));
    }
  }

  return (
    <div style={{ maxWidth: 380, margin: '0 auto', paddingTop: 32 }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 48, lineHeight: 1, marginBottom: 12 }}>✉️</div>
        <h2 style={{ fontFamily: 'ZCOOL XiaoWei, serif', fontSize: 20, color: 'var(--text)', marginBottom: 8 }}>
          邮箱链接登录
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7 }}>
          无需密码，点击邮件里的链接即可登录
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 4, lineHeight: 1.5 }}>
          ⚠️ 在微信里打开邮件链接可能会跳出当前页面
        </p>
      </div>

      <div className="card" style={{ padding: '20px 16px' }}>
        <div className="form-group">
          <label className="form-label">邮箱地址</label>
          <input
            className="input"
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && email.trim() && !submitting) handleSend(); }}
            autoFocus
            autoComplete="email"
          />
        </div>

        {error && (
          <div style={{
            fontSize: 13, color: 'var(--red)', background: 'var(--red-dim)',
            borderRadius: 8, padding: '8px 12px', marginBottom: 12,
          }}>{error}</div>
        )}

        <button
          className="btn btn-primary"
          style={{ width: '100%' }}
          onClick={handleSend}
          disabled={!email.trim() || submitting}
        >
          {submitting ? '发送中…' : '发送登录链接'}
        </button>

        <button
          className="btn btn-ghost"
          style={{ width: '100%', marginTop: 10, fontSize: 13 }}
          onClick={() => onNavigate('login')}
        >
          ← 返回密码登录
        </button>
      </div>
    </div>
  );
}

// ─── Magic Link 已发送视图 ────────────────────────────────────────────────────

function MagicLinkSentView({ email, signInWithEmail, onNavigate }: {
  email: string;
  signInWithEmail: (e: string) => Promise<{ sent: boolean; error: string | null }>;
  onNavigate: Navigate;
}) {
  const [countdown, setCountdown] = useState(60);
  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  async function handleResend() {
    if (countdown > 0 || resending || !email) return;
    setResending(true);
    setResendError(null);
    const { sent, error: e } = await signInWithEmail(email);
    setResending(false);
    if (sent) {
      setCountdown(60);
    } else {
      setResendError(formatAuthError(e ?? '发送失败'));
    }
  }

  return (
    <div style={{ maxWidth: 380, margin: '0 auto', paddingTop: 32, textAlign: 'center' }}>
      <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 16 }}>📬</div>
      <h2 style={{ fontFamily: 'ZCOOL XiaoWei, serif', fontSize: 20, color: 'var(--text)', marginBottom: 12 }}>
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
      <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.8, marginBottom: 24 }}>
        请检查收件箱，点击「登录」链接完成登录。<br />
        如果没看到，也可以查看垃圾邮件/广告邮件。<br />
        链接有效期 60 分钟。
      </p>

      {resendError && (
        <div style={{
          fontSize: 13, color: 'var(--red)', background: 'var(--red-dim)',
          borderRadius: 8, padding: '8px 12px', marginBottom: 12,
        }}>{resendError}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          className="btn btn-primary"
          style={{ width: '100%' }}
          onClick={handleResend}
          disabled={countdown > 0 || resending}
        >
          {resending ? '发送中…' : countdown > 0 ? `重新发送（${countdown}s）` : '重新发送'}
        </button>
        <button
          className="btn btn-ghost"
          style={{ width: '100%', fontSize: 13 }}
          onClick={() => onNavigate('magic-link')}
        >
          修改邮箱地址
        </button>
        <button
          className="btn btn-ghost"
          style={{ width: '100%', fontSize: 13 }}
          onClick={() => onNavigate('login')}
        >
          返回密码登录
        </button>
      </div>
    </div>
  );
}

// ─── 设置新密码视图（PASSWORD_RECOVERY 后展示）────────────────────────────────

function SetNewPasswordView({ updatePassword }: {
  updatePassword: (p: string) => Promise<{ success: boolean; error: string | null }>;
}) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleUpdate() {
    if (!password || submitting) return;
    if (password.length < 6) { setError('密码至少需要 6 位。'); return; }
    if (password !== confirm) { setError('两次输入的密码不一致。'); return; }
    setSubmitting(true);
    setError(null);
    const { error: e } = await updatePassword(password);
    setSubmitting(false);
    if (e) setError(formatAuthError(e));
    // 成功：useAuth 把 isRecoveryMode 置 false → EquipmentPage 自动展示装备库
  }

  return (
    <div style={{ maxWidth: 380, margin: '0 auto', paddingTop: 32 }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 48, lineHeight: 1, marginBottom: 12 }}>🔐</div>
        <h2 style={{ fontFamily: 'ZCOOL XiaoWei, serif', fontSize: 20, color: 'var(--text)', marginBottom: 8 }}>
          设置新密码
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7 }}>
          设置完成后直接进入装备大本营
        </p>
      </div>

      <div className="card" style={{ padding: '20px 16px' }}>
        <div className="form-group">
          <label className="form-label">新密码（至少 6 位）</label>
          <div style={{ position: 'relative' }}>
            <input
              className="input"
              type={showPwd ? 'text' : 'password'}
              placeholder="设置新密码"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
              autoComplete="new-password"
              style={{ paddingRight: 52 }}
            />
            <button
              type="button"
              onClick={() => setShowPwd(!showPwd)}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, color: 'var(--text-muted)', padding: '4px 6px',
              }}
            >{showPwd ? '隐藏' : '显示'}</button>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">确认新密码</label>
          <input
            className="input"
            type="password"
            placeholder="再次输入新密码"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </div>

        {error && (
          <div style={{
            fontSize: 13, color: 'var(--red)', background: 'var(--red-dim)',
            borderRadius: 8, padding: '8px 12px', marginBottom: 12, lineHeight: 1.5,
          }}>{error}</div>
        )}

        <button
          className="btn btn-primary"
          style={{ width: '100%' }}
          onClick={handleUpdate}
          disabled={!password || !confirm || submitting}
        >
          {submitting ? '保存中…' : '设置密码并进入'}
        </button>
      </div>
    </div>
  );
}

// ─── 装备卡片 ─────────────────────────────────────────────────────────────────

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
      <div style={{ fontSize: 14, flexShrink: 0, opacity: item.is_favorite ? 1 : 0.2 }}>
        ⭐
      </div>
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
      <button className="btn-icon" onClick={onEdit} style={{ fontSize: 16 }}>✏️</button>
      <button className="btn-icon" onClick={onDelete} style={{ fontSize: 16 }}>🗑️</button>
    </div>
  );
}
