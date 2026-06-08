import { useState, useEffect } from 'react';
import type { Supply, SupplyType } from '../../types';

import { SUPPLY_TYPE_LABELS, SUPPLY_TYPE_ICONS, SYSTEM_CATEGORIES } from '../../types';
import { useApp } from '../../App';
import { generateId } from '../../store';
import Modal from '../../components/Modal';
import { useAuth } from '../../hooks/useAuth';
import { listEquipment } from '../../equipment';
import type { EquipmentItem } from '../../equipment';

/** 只允许数字 + 最多一个小数点 + 最多两位小数 */
function sanitizeAmount(val: string): string {
  let v = val.replace(/[^\d.]/g, '');
  const dotIndex = v.indexOf('.');
  if (dotIndex !== -1) {
    v = v.slice(0, dotIndex + 1) + v.slice(dotIndex + 1).replace(/\./g, '');
    const parts = v.split('.');
    if (parts[1].length > 2) v = parts[0] + '.' + parts[1].slice(0, 2);
  }
  return v;
}

/** 取物资的功能分类，优先 system_category，其次 category，最后兜底"其他" */
function getItemSystemCategory(s: Supply): string {
  return s.system_category || s.category || '其他';
}

/** 按 SYSTEM_CATEGORIES 预设顺序排序分类名，自定义分类排末尾，"其他"永远最后 */
function sortCategories(cats: string[]): string[] {
  return [...cats].sort((a, b) => {
    const ai = SYSTEM_CATEGORIES.indexOf(a);
    const bi = SYSTEM_CATEGORIES.indexOf(b);
    if (a === '其他') return 1;
    if (b === '其他') return -1;
    if (ai === -1 && bi === -1) return a.localeCompare(b, 'zh');
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

/**
 * 合并装备大本营的 quantity（默认数量）和 note（备注）
 * → 计划物资的 quantity（数量/备注）字段
 */
function mergeEquipmentQuantity(eq: EquipmentItem): string {
  const qty = (eq.quantity ?? '').trim();
  const note = (eq.note ?? '').trim();
  if (qty && note) return `${qty}；${note}`;
  if (qty) return qty;
  if (note) return note;
  return '';
}

const SUPPLY_ACCENT: Record<SupplyType, string> = {
  personal: '#C8651A',
  food: '#3D6B4F',
  gear: '#5B7FA8',
};

const FAMILY_COLORS: { bg: string; text: string; border: string }[] = [
  { bg: '#FDEBD0', text: '#A84E10', border: '#F0C090' },
  { bg: '#E0EFE6', text: '#2E6B48', border: '#A8D4B8' },
  { bg: '#E0EAF5', text: '#3A5F8A', border: '#A8C0E0' },
  { bg: '#F5E6E0', text: '#8A3A2E', border: '#E0A898' },
  { bg: '#EDE8F5', text: '#5A3A8A', border: '#C0A8E0' },
  { bg: '#EBF0DC', text: '#4A5E28', border: '#C0D098' },
  { bg: '#DCF0EF', text: '#226060', border: '#98D0CE' },
  { bg: '#F0EAE0', text: '#6A5040', border: '#D0B898' },
];

const CUSTOM_OPTION = '__custom__';

export default function SuppliesTab() {
  const { plan, updatePlan, toast, setCurrentTab } = useApp();
  const { user } = useAuth();

  const [showNoFamilyGuide, setShowNoFamilyGuide] = useState(false);
  const [activeType, setActiveType] = useState<SupplyType>('personal');
  const [filterFamily, setFilterFamily] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editSupply, setEditSupply] = useState<Supply | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supply | null>(null);

  // 折叠状态：key = `${type}::${categoryName}`，值为 true 表示折叠
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Form state
  const [fName, setFName] = useState('');
  const [fSystemCategorySelect, setFSystemCategorySelect] = useState(SYSTEM_CATEGORIES[0]);
  const [fCustomCategory, setFCustomCategory] = useState('');
  const [fAssignee, setFAssignee] = useState('');
  const [fQty, setFQty] = useState('');
  const [fNeedsAA, setFNeedsAA] = useState(false);
  const [fPrice, setFPrice] = useState('');

  // ── 装备大本营导入状态 ────────────────────────────────────────────────────────
  const [showUnauthGuide, setShowUnauthGuide] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importItems, setImportItems] = useState<EquipmentItem[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importAssigneeId, setImportAssigneeId] = useState('');
  const [importSelected, setImportSelected] = useState<Set<string>>(new Set());
  /**
   * 未指定 default_plan_type 的装备导入时使用的 fallback 类型。
   * 空字符串表示用户尚未选择。
   */
  const [importFallbackType, setImportFallbackType] = useState<SupplyType | ''>('');

  const isCustom = fSystemCategorySelect === CUSTOM_OPTION;

  const familyMap = Object.fromEntries(plan.families.map(f => [f.id, f.name]));
  const familyColorMap = Object.fromEntries(
    plan.families.map((f, i) => [f.id, FAMILY_COLORS[i % FAMILY_COLORS.length]])
  );

  const filtered = plan.supplies
    .filter(s => s.type === activeType)
    .filter(s => filterFamily === 'all' || s.assigneeId === filterFamily);

  const readyCount = filtered.filter(s => s.isReady).length;
  const accent = SUPPLY_ACCENT[activeType];

  // 按功能分类分组
  const categoryNames = sortCategories([...new Set(filtered.map(getItemSystemCategory))]);

  // ── 导入弹窗派生值 ──────────────────────────────────────────────────────────
  /** 装备库中是否存在未指定类型的装备 */
  const hasAnyUntypedInLibrary = importItems.some(eq => !eq.default_plan_type);
  /** 已勾选装备中是否包含未指定类型的装备 */
  const hasUntypedSelected = importSelected.size > 0 &&
    [...importSelected].some(id => !importItems.find(e => e.id === id)?.default_plan_type);
  /** 是否需要用户先选择 fallback 类型才能导入 */
  const needsFallbackChoice = hasUntypedSelected && !importFallbackType;

  // 负责人、装备列表、fallback 类型任一变更时，重新计算默认选中项：
  // 非疑似重复的装备默认勾选；疑似重复的装备默认不勾选。
  // 若某装备类型未知（无 default_plan_type 且 fallback 未选），视为非重复项预选。
  useEffect(() => {
    if (!importAssigneeId || importItems.length === 0) {
      setImportSelected(new Set());
      return;
    }
    const newSelected = new Set<string>(
      importItems
        .filter(eq => {
          const etype = eq.default_plan_type ?? (importFallbackType || null);
          // 类型未知时，无法判断重复，预选该装备
          if (!etype) return true;
          return !plan.supplies.some(s =>
            s.assigneeId === importAssigneeId &&
            s.name === eq.name &&
            (s.system_category || s.category) === eq.system_category &&
            s.type === etype
          );
        })
        .map(eq => eq.id)
    );
    setImportSelected(newSelected);
  }, [importAssigneeId, importItems, plan.supplies, importFallbackType]);

  function toggleCollapse(type: SupplyType, cat: string) {
    const key = `${type}::${cat}`;
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function isCollapsed(type: SupplyType, cat: string) {
    return !!collapsed[`${type}::${cat}`];
  }

  function resolveFSystemCategory(): string {
    if (isCustom) return fCustomCategory.trim() || '其他';
    return fSystemCategorySelect;
  }

  function openAdd() {
    setEditSupply(null);
    setFName('');
    const defaultCat = SYSTEM_CATEGORIES[0];
    setFSystemCategorySelect(defaultCat);
    setFCustomCategory('');
    setFAssignee(plan.families[0]?.id ?? '');
    setFQty('');
    setFNeedsAA(activeType === 'food');
    setFPrice('');
    setShowModal(true);
  }

  function openEdit(s: Supply) {
    setEditSupply(s);
    setFName(s.name);
    const cat = s.system_category || s.category || SYSTEM_CATEGORIES[0];
    if (SYSTEM_CATEGORIES.includes(cat)) {
      setFSystemCategorySelect(cat);
      setFCustomCategory('');
    } else {
      setFSystemCategorySelect(CUSTOM_OPTION);
      setFCustomCategory(cat);
    }
    setFAssignee(s.assigneeId);
    setFQty(s.quantity);
    setFNeedsAA(s.needsAA);
    setFPrice(s.price != null ? String(s.price) : '');
    setShowModal(true);
  }

  function saveSupply() {
    if (!fName.trim() || !fAssignee) return;
    const price = fPrice.trim() ? parseFloat(fPrice) : undefined;
    const sysCategory = resolveFSystemCategory();
    if (editSupply) {
      updatePlan({
        ...plan,
        supplies: plan.supplies.map(s => s.id === editSupply.id
          ? { ...s, name: fName.trim(), system_category: sysCategory, category: sysCategory, assigneeId: fAssignee, quantity: fQty.trim(), needsAA: fNeedsAA, price }
          : s),
      });
      toast('物品已更新');
    } else {
      const newSupply: Supply = {
        id: generateId(),
        name: fName.trim(),
        category: sysCategory,
        system_category: sysCategory,
        assigneeId: fAssignee,
        quantity: fQty.trim(),
        isReady: false,
        needsAA: fNeedsAA,
        type: activeType,
        price,
      };
      updatePlan({ ...plan, supplies: [...plan.supplies, newSupply] });
      toast('物品已添加');
    }
    setShowModal(false);
  }

  function toggleReady(id: string) {
    updatePlan({
      ...plan,
      supplies: plan.supplies.map(s => s.id === id ? { ...s, isReady: !s.isReady } : s),
    });
  }

  function confirmDeleteSupply() {
    if (!deleteTarget) return;
    updatePlan({ ...plan, supplies: plan.supplies.filter(s => s.id !== deleteTarget.id) });
    toast('已删除');
    setDeleteTarget(null);
  }

  // ── 装备大本营导入逻辑 ────────────────────────────────────────────────────────

  /** 入口：依次检查参与者 → 登录状态 → 打开弹窗 */
  function handleOpenImport() {
    if (plan.families.length === 0) {
      setShowNoFamilyGuide(true);
      return;
    }
    if (!user) {
      setShowUnauthGuide(true);
      return;
    }
    openImportModal();
  }

  function openImportModal() {
    setImportAssigneeId('');
    setImportItems([]);
    setImportSelected(new Set());
    setImportFallbackType('');
    setImportLoading(true);
    setImportError(null);
    setShowImportModal(true);
    listEquipment(user!.id).then(({ data, error }) => {
      setImportLoading(false);
      if (error || !data) {
        setImportError(error ?? '加载失败，请稍后重试');
        return;
      }
      setImportItems(data);
    });
  }

  function closeImportModal() {
    setShowImportModal(false);
    setImportItems([]);
    setImportSelected(new Set());
    setImportAssigneeId('');
    setImportFallbackType('');
    setImportError(null);
  }

  /**
   * 判断装备是否疑似已在当前计划中。
   * 使用最终导入 type：有 default_plan_type 用它，没有则用 fallback。
   * fallback 未选时无法判断，返回 false（不标记为重复）。
   */
  function isPossibleDuplicate(eq: EquipmentItem, assigneeId: string): boolean {
    if (!assigneeId) return false;
    const etype = eq.default_plan_type ?? (importFallbackType || null);
    if (!etype) return false;
    return plan.supplies.some(s =>
      s.assigneeId === assigneeId &&
      s.name === eq.name &&
      (s.system_category || s.category) === eq.system_category &&
      s.type === etype
    );
  }

  function toggleImportItem(id: string) {
    setImportSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function doImport() {
    if (!importAssigneeId || importSelected.size === 0 || needsFallbackChoice) return;
    const newSupplies: Supply[] = [...importSelected].map(id => {
      const eq = importItems.find(e => e.id === id)!;
      const sysCategory = eq.system_category || '其他';
      // 有 default_plan_type 用装备自己的类型；否则使用用户选择的 fallback
      const supplyType = (eq.default_plan_type ?? importFallbackType) as SupplyType;
      return {
        id: generateId(),
        name: eq.name,
        category: sysCategory,
        system_category: sysCategory,
        assigneeId: importAssigneeId,
        quantity: mergeEquipmentQuantity(eq),
        isReady: false,
        needsAA: false,
        type: supplyType,
      };
    });
    updatePlan({ ...plan, supplies: [...plan.supplies, ...newSupplies] });
    toast(`已导入 ${newSupplies.length} 件装备`);
    closeImportModal();
  }

  return (
    <div style={{ padding: '14px 14px 0' }}>
      {/* Segment control */}
      <div className="segment-control" style={{ marginBottom: 12 }}>
        {(['personal', 'food', 'gear'] as SupplyType[]).map(t => (
          <button
            key={t}
            className={`segment-btn${activeType === t ? ' active' : ''}`}
            onClick={() => setActiveType(t)}
          >
            <span>{SUPPLY_TYPE_ICONS[t]}</span>
            <span>{SUPPLY_TYPE_LABELS[t]}</span>
          </button>
        ))}
      </div>

      {/* Filter + stats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <select
          className="input input-sm"
          value={filterFamily}
          onChange={e => setFilterFamily(e.target.value)}
          style={{ flex: 1, fontSize: 14 }}
        >
          <option value="all">全部人员</option>
          {plan.families.map(f => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
        {filtered.length > 0 && (
          <div style={{
            flexShrink: 0, fontSize: 13, color: 'var(--text-muted)',
            background: 'var(--card)', padding: '6px 12px',
            borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)',
          }}>
            {readyCount}/{filtered.length} 已备
          </div>
        )}
      </div>

      {/* Progress bar */}
      {filtered.length > 0 && (
        <div style={{
          height: 4, background: 'var(--border)', borderRadius: 2, marginBottom: 14, overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${(readyCount / filtered.length) * 100}%`,
            background: accent,
            borderRadius: 2,
            transition: 'width 0.3s ease',
          }} />
        </div>
      )}

      {/* 从装备大本营导入入口 */}
      <button
        onClick={handleOpenImport}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 14px', marginBottom: 12,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xs)',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 20 }}>📦</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>
            从装备大本营导入
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
            把常用装备带入本次计划
          </div>
        </div>
        <span style={{ fontSize: 18, color: 'var(--text-muted)' }}>›</span>
      </button>

      {/* Supply list grouped by system_category */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">{SUPPLY_TYPE_ICONS[activeType]}</div>
          <p>还没有{SUPPLY_TYPE_LABELS[activeType]}项目<br />点击右下角 ＋ 添加</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {categoryNames.map(cat => {
            const items = filtered.filter(s => getItemSystemCategory(s) === cat);
            if (items.length === 0) return null;
            const collapsed_ = isCollapsed(activeType, cat);
            return (
              <div key={cat}>
                {/* Category header — full row tappable */}
                <button
                  onClick={() => toggleCollapse(activeType, cat)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center',
                    gap: 8, padding: '7px 10px',
                    background: 'var(--bg-warm)',
                    border: '1px solid var(--border)',
                    borderRadius: collapsed_ ? 'var(--radius-xs)' : 'var(--radius-xs) var(--radius-xs) 0 0',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{
                    fontSize: 11, transition: 'transform 0.2s',
                    transform: collapsed_ ? 'rotate(-90deg)' : 'none',
                    color: 'var(--text-muted)',
                    display: 'inline-block',
                  }}>▼</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', flex: 1 }}>{cat}</span>
                  <span style={{
                    fontSize: 12, color: 'var(--text-light)',
                    background: 'var(--card)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '1px 7px',
                  }}>{items.length}</span>
                </button>

                {/* Items */}
                {!collapsed_ && (
                  <div style={{
                    border: '1px solid var(--border)', borderTop: 'none',
                    borderRadius: '0 0 var(--radius-xs) var(--radius-xs)',
                    overflow: 'hidden',
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      {items.map((s, idx) => (
                        <div key={s.id} style={{ borderTop: idx > 0 ? '1px solid var(--border)' : 'none' }}>
                          <SupplyCard
                            supply={s}
                            familyName={familyMap[s.assigneeId] ?? '未指定'}
                            familyColor={familyColorMap[s.assigneeId]}
                            accent={accent}
                            onToggle={() => toggleReady(s.id)}
                            onEdit={() => openEdit(s)}
                            onDelete={() => setDeleteTarget(s)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* FAB */}
      <button
        className="fab"
        onClick={plan.families.length === 0 ? () => setShowNoFamilyGuide(true) : openAdd}
      >
        ＋
      </button>

      {/* No-family guide */}
      {showNoFamilyGuide && (
        <div
          onClick={() => setShowNoFamilyGuide(false)}
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
              padding: '28px 20px 20px', textAlign: 'center',
              animation: 'slideUp 0.25s ease',
              maxWidth: 320, width: '100%',
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 12 }}>🏕️</div>
            <h3 style={{ fontSize: 16, marginBottom: 8 }}>还没有参与者</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>
              请先添加参与者，再录入物资：<br />
              <span style={{ color: 'var(--text)', fontWeight: 500 }}>家庭/小组</span>
              {' 或 '}
              <span style={{ color: 'var(--text)', fontWeight: 500 }}>独立参与者</span>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                className="btn btn-primary"
                style={{ width: '100%' }}
                onClick={() => { setShowNoFamilyGuide(false); setCurrentTab('overview'); }}
              >
                去添加参与者 →
              </button>
              <button
                className="btn btn-ghost"
                style={{ width: '100%' }}
                onClick={() => setShowNoFamilyGuide(false)}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unauth guide：未登录时点击导入的轻量提示 */}
      {showUnauthGuide && (
        <div
          onClick={() => setShowUnauthGuide(false)}
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
              padding: '28px 20px 20px', textAlign: 'center',
              animation: 'slideUp 0.25s ease',
              maxWidth: 320, width: '100%',
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔐</div>
            <h3 style={{ fontSize: 16, marginBottom: 8 }}>登录后可以导入</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>
              登录后可以从装备大本营导入常用装备。<br />
              请先回到首页进入装备大本营登录/注册。
            </p>
            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={() => setShowUnauthGuide(false)}
            >
              我知道了
            </button>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div
          onClick={() => setDeleteTarget(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1001,
            background: 'rgba(44,26,14,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 24px',
            animation: 'fadeIn 0.2s ease',
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
            <h3 style={{ fontSize: 16, marginBottom: 6 }}>确认删除物资？</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
              「{deleteTarget.name}」删除后无法恢复
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)} style={{ flex: 1 }}>
                取消
              </button>
              <button className="btn btn-danger" onClick={confirmDeleteSupply} style={{ flex: 1 }}>
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editSupply ? '编辑物品' : `添加${SUPPLY_TYPE_LABELS[activeType]}`}
        footer={
          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={saveSupply}
            disabled={!fName.trim() || !fAssignee}
          >
            {editSupply ? '保存' : '添加物品'}
          </button>
        }
      >
        <div className="form-group">
          <label className="form-label">物品名称 *</label>
          <input
            className="input"
            placeholder="例：牛肋条"
            value={fName}
            onChange={e => setFName(e.target.value)}
            autoFocus
            maxLength={20}
          />
        </div>
        <div className="form-group">
          <label className="form-label">功能分类</label>
          <select
            className="input"
            value={fSystemCategorySelect}
            onChange={e => setFSystemCategorySelect(e.target.value)}
          >
            {SYSTEM_CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
            <option value={CUSTOM_OPTION}>自定义分类…</option>
          </select>
          {isCustom && (
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
          <label className="form-label">负责人/组 *</label>
          <select className="input" value={fAssignee} onChange={e => setFAssignee(e.target.value)}>
            <option value="">请选择</option>
            {plan.families.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">数量 / 备注</label>
          <input
            className="input"
            placeholder="例：2斤、若干、各自带"
            value={fQty}
            onChange={e => setFQty(e.target.value)}
            maxLength={20}
          />
        </div>
        {(activeType === 'food' || activeType === 'gear') && (
          <div className="toggle-wrap" style={{ marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 14, color: 'var(--text)' }}>计入 AA 分摊</div>
              {activeType === 'gear' && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  炭、纸巾等消耗品可开启
                </div>
              )}
            </div>
            <button
              className={`toggle${fNeedsAA ? ' on' : ''}`}
              onClick={() => setFNeedsAA(!fNeedsAA)}
            />
          </div>
        )}
        {fNeedsAA && (
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">预估金额（元）</label>
            <input
              className="input"
              type="text"
              inputMode="decimal"
              placeholder="填了可一键同步到花费"
              value={fPrice}
              onChange={e => setFPrice(sanitizeAmount(e.target.value))}
            />
            <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 4 }}>
              填写后可在「花费」页一键导入
            </div>
          </div>
        )}
      </Modal>

      {/* ── 装备大本营导入弹窗（底部滑出式 bottom sheet） ── */}
      {showImportModal && (
        <div
          onClick={closeImportModal}
          style={{
            position: 'fixed', inset: 0, zIndex: 1001,
            background: 'rgba(44,26,14,0.5)',
            display: 'flex', alignItems: 'flex-end',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--card)',
              borderRadius: '20px 20px 0 0',
              width: '100%',
              // dvh = dynamic viewport height，适配 iOS Safari 底部工具栏
              // 旧版浏览器降级到 85vh
              maxHeight: '85dvh',
              display: 'flex',
              flexDirection: 'column',
              animation: 'slideUp 0.25s ease',
            }}
          >
            {/* Header — 固定不滚动 */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 16px 12px', flexShrink: 0,
              borderBottom: '1px solid var(--border)',
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
                从装备大本营导入
              </h3>
              <button
                className="btn-icon"
                onClick={closeImportModal}
                style={{ fontSize: 18, color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            {/* 负责人选择器 — 固定不滚动 */}
            <div style={{ padding: '12px 16px', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
                这些装备由谁负责？
              </div>
              <select
                className="input"
                value={importAssigneeId}
                onChange={e => setImportAssigneeId(e.target.value)}
              >
                <option value="">请选择负责人/组</option>
                {plan.families.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            {/* 未指定类型 fallback 选择器 — 固定不滚动，仅在库中有未指定类型的装备时显示 */}
            {!importLoading && !importError && hasAnyUntypedInLibrary && (
              <div style={{ padding: '10px 16px', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
                  未指定类型时导入为
                </div>
                <select
                  className="input"
                  value={importFallbackType}
                  onChange={e => setImportFallbackType(e.target.value as SupplyType | '')}
                >
                  <option value="">请选择</option>
                  <option value="personal">各家自带</option>
                  <option value="food">公共食材</option>
                  <option value="gear">公共物资</option>
                </select>
              </div>
            )}

            {/* 装备列表 — 可滚动区域
                min-height: 0 是关键：让 flex 子项能收缩，
                避免列表把 sheet 撑高到视口外导致底部按钮不可见 */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              minHeight: 0,
              padding: '0 16px',
              overscrollBehavior: 'contain',
            }}>
              {importLoading ? (
                <div style={{
                  textAlign: 'center', padding: '40px 0',
                  color: 'var(--text-muted)', fontSize: 14,
                }}>
                  加载中…
                </div>
              ) : importError ? (
                <div style={{
                  textAlign: 'center', padding: '40px 0',
                  color: 'var(--text-muted)', fontSize: 14,
                }}>
                  {importError}
                </div>
              ) : importItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>📦</div>
                  <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.7 }}>
                    你的装备大本营还没有装备<br />
                    先去添加一些常用装备吧
                  </p>
                </div>
              ) : (
                <div style={{ paddingTop: 8, paddingBottom: 8 }}>
                  {importAssigneeId && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '2px 0 8px' }}>
                      已选 {importSelected.size} 件 · ⭐ 常用 ·{' '}
                      <span style={{ color: '#C8651A' }}>橙色</span> 可能已在计划中（默认不选）
                    </div>
                  )}
                  {sortCategories([...new Set(importItems.map(eq => eq.system_category || '其他'))]).map(cat => {
                    const catItems = importItems.filter(eq => (eq.system_category || '其他') === cat);
                    if (catItems.length === 0) return null;
                    return (
                      <div key={cat} style={{ marginBottom: 14 }}>
                        {/* 分类标题 */}
                        <div style={{
                          fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
                          letterSpacing: '0.3px',
                          padding: '6px 0 4px',
                          borderBottom: '1px solid var(--border)',
                          marginBottom: 2,
                        }}>
                          {cat}
                        </div>
                        {/* 装备行 */}
                        {catItems.map(eq => {
                          const isDuplicate = isPossibleDuplicate(eq, importAssigneeId);
                          const isChecked = importSelected.has(eq.id);
                          const merged = mergeEquipmentQuantity(eq);
                          const hasNoType = !eq.default_plan_type;
                          return (
                            <div
                              key={eq.id}
                              onClick={() => toggleImportItem(eq.id)}
                              style={{
                                display: 'flex', alignItems: 'flex-start', gap: 10,
                                padding: '10px 4px',
                                borderBottom: '1px solid var(--border)',
                                cursor: 'pointer',
                              }}
                            >
                              {/* Checkbox */}
                              <div style={{
                                width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                                marginTop: 1,
                                border: `2px solid ${isChecked ? '#C8651A' : 'var(--border)'}`,
                                background: isChecked ? '#C8651A' : 'transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'white', fontSize: 11, fontWeight: 700,
                                transition: 'background 0.15s, border-color 0.15s',
                              }}>
                                {isChecked && '✓'}
                              </div>
                              {/* 装备信息 */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                  display: 'flex', alignItems: 'center',
                                  gap: 5, flexWrap: 'wrap',
                                }}>
                                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>
                                    {eq.name}
                                  </span>
                                  {eq.is_favorite && (
                                    <span style={{ fontSize: 13 }}>⭐</span>
                                  )}
                                  {isDuplicate && (
                                    <span style={{
                                      fontSize: 11, color: '#C8651A',
                                      background: '#FEF3E8',
                                      border: '1px solid #F0C090',
                                      borderRadius: 8, padding: '1px 6px', flexShrink: 0,
                                    }}>
                                      可能已在计划中
                                    </span>
                                  )}
                                  {hasNoType && (
                                    <span style={{
                                      fontSize: 11, color: 'var(--text-muted)',
                                      background: 'var(--bg-warm)',
                                      border: '1px solid var(--border)',
                                      borderRadius: 8, padding: '1px 6px', flexShrink: 0,
                                    }}>
                                      未指定类型
                                    </span>
                                  )}
                                </div>
                                {merged && (
                                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                                    {merged}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 底部固定操作区 — 固定不滚动
                paddingBottom 使用 env(safe-area-inset-bottom) 避免被 iPhone home bar 遮挡 */}
            <div style={{
              flexShrink: 0,
              paddingTop: 12,
              paddingLeft: 16,
              paddingRight: 16,
              paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
              borderTop: '1px solid var(--border)',
              background: 'var(--card)',
            }}>
              {needsFallbackChoice && (
                <div style={{
                  fontSize: 12, color: '#C8651A',
                  textAlign: 'center', marginBottom: 8,
                }}>
                  请先选择未指定类型装备的导入类别
                </div>
              )}
              <button
                className="btn btn-primary"
                style={{ width: '100%' }}
                disabled={!importAssigneeId || importSelected.size === 0 || needsFallbackChoice}
                onClick={doImport}
              >
                {importSelected.size > 0
                  ? `导入 ${importSelected.size} 件装备`
                  : '导入装备'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface CardProps {
  supply: Supply;
  familyName: string;
  familyColor?: { bg: string; text: string; border: string };
  accent: string;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function SupplyCard({ supply: s, familyName, familyColor, accent, onToggle, onEdit, onDelete }: CardProps) {
  return (
    <div style={{
      background: 'var(--card)',
      borderLeft: `3.5px solid ${s.isReady ? '#3D6B4F' : accent}`,
      padding: '11px 12px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      opacity: s.isReady ? 0.72 : 1,
      transition: 'opacity 0.2s',
    }}>
      {/* Checkbox */}
      <button
        onClick={onToggle}
        className={`checkbox-custom${s.isReady ? ' checked' : ''}`}
        style={{ cursor: 'pointer' }}
      >
        {s.isReady && '✓'}
      </button>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 15, fontWeight: 500,
          color: 'var(--text)',
          textDecoration: s.isReady ? 'line-through' : 'none',
        }}>
          {s.name}
          {s.quantity && (
            <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>
              {s.quantity}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 5, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          <span
            className="tag"
            style={familyColor
              ? { background: familyColor.bg, color: familyColor.text, border: `1px solid ${familyColor.border}` }
              : { background: 'var(--bg-warm)', color: 'var(--text-muted)', border: '1px solid var(--border)' }
            }
          >{familyName}</span>
          {s.needsAA && (
            <span className="tag tag-orange">
              AA{s.price != null ? ` ¥${s.price}` : ''}
            </span>
          )}
          {s.isReady && <span className="tag tag-green">✓ 已备</span>}
        </div>
      </div>

      {/* Actions */}
      <button className="btn-icon" onClick={onEdit} style={{ fontSize: 16 }}>✏️</button>
      <button className="btn-icon" onClick={onDelete} style={{ fontSize: 16 }}>🗑️</button>
    </div>
  );
}
