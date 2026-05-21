import { useState } from 'react';
import type { Supply, SupplyType } from '../../types';
import { SUPPLY_TYPE_LABELS, SUPPLY_TYPE_ICONS, SUPPLY_CATEGORIES } from '../../types';
import { useApp } from '../../App';
import { generateId } from '../../store';
import Modal from '../../components/Modal';

const SUPPLY_ACCENT: Record<SupplyType, string> = {
  personal: '#C8651A',
  food: '#3D6B4F',
  gear: '#5B7FA8',
};

// Warm, earthy palette for family tags — up to 8 families
const FAMILY_COLORS: { bg: string; text: string; border: string }[] = [
  { bg: '#FDEBD0', text: '#A84E10', border: '#F0C090' }, // amber
  { bg: '#E0EFE6', text: '#2E6B48', border: '#A8D4B8' }, // forest green
  { bg: '#E0EAF5', text: '#3A5F8A', border: '#A8C0E0' }, // slate blue
  { bg: '#F5E6E0', text: '#8A3A2E', border: '#E0A898' }, // terracotta
  { bg: '#EDE8F5', text: '#5A3A8A', border: '#C0A8E0' }, // lavender
  { bg: '#EBF0DC', text: '#4A5E28', border: '#C0D098' }, // olive
  { bg: '#DCF0EF', text: '#226060', border: '#98D0CE' }, // teal
  { bg: '#F0EAE0', text: '#6A5040', border: '#D0B898' }, // warm brown
];

export default function SuppliesTab() {
  const { plan, updatePlan, toast } = useApp();
  const [activeType, setActiveType] = useState<SupplyType>('personal');
  const [filterFamily, setFilterFamily] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editSupply, setEditSupply] = useState<Supply | null>(null);

  // Form
  const [fName, setFName] = useState('');
  const [fCategory, setFCategory] = useState('');
  const [fAssignee, setFAssignee] = useState('');
  const [fQty, setFQty] = useState('');
  const [fNeedsAA, setFNeedsAA] = useState(false);
  const [fPrice, setFPrice] = useState('');

  const familyMap = Object.fromEntries(plan.families.map(f => [f.id, f.name]));
  const familyColorMap = Object.fromEntries(
    plan.families.map((f, i) => [f.id, FAMILY_COLORS[i % FAMILY_COLORS.length]])
  );

  const filtered = plan.supplies
    .filter(s => s.type === activeType)
    .filter(s => filterFamily === 'all' || s.assigneeId === filterFamily);

  function openAdd() {
    setEditSupply(null);
    setFName('');
    setFCategory(SUPPLY_CATEGORIES[activeType][0]);
    setFAssignee(plan.families[0]?.id ?? '');
    setFQty('');
    setFNeedsAA(activeType === 'food');
    setFPrice('');
    setShowModal(true);
  }

  function openEdit(s: Supply) {
    setEditSupply(s);
    setFName(s.name);
    setFCategory(s.category);
    setFAssignee(s.assigneeId);
    setFQty(s.quantity);
    setFNeedsAA(s.needsAA);
    setFPrice(s.price != null ? String(s.price) : '');
    setShowModal(true);
  }

  function saveSupply() {
    if (!fName.trim() || !fAssignee) return;
    const price = fPrice.trim() ? parseFloat(fPrice) : undefined;
    if (editSupply) {
      updatePlan({
        ...plan,
        supplies: plan.supplies.map(s => s.id === editSupply.id
          ? { ...s, name: fName.trim(), category: fCategory, assigneeId: fAssignee, quantity: fQty.trim(), needsAA: fNeedsAA, price }
          : s),
      });
      toast('物品已更新');
    } else {
      const newSupply: Supply = {
        id: generateId(),
        name: fName.trim(),
        category: fCategory,
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

  function deleteSupply(id: string) {
    updatePlan({ ...plan, supplies: plan.supplies.filter(s => s.id !== id) });
    toast('已删除');
  }

  const readyCount = filtered.filter(s => s.isReady).length;
  const accent = SUPPLY_ACCENT[activeType];

  // Group by category
  const categories = [...new Set(filtered.map(s => s.category))];

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

      {/* Supply list */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">{SUPPLY_TYPE_ICONS[activeType]}</div>
          <p>还没有{SUPPLY_TYPE_LABELS[activeType]}项目<br />点击右下角 ＋ 添加</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {categories.map(cat => {
            const items = filtered.filter(s => s.category === cat);
            return (
              <div key={cat}>
                <div style={{
                  fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
                  letterSpacing: '0.06em', marginBottom: 6,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span>{cat}</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {items.map(s => (
                    <SupplyCard
                      key={s.id}
                      supply={s}
                      familyName={familyMap[s.assigneeId] ?? '未指定'}
                      familyColor={familyColorMap[s.assigneeId]}
                      accent={accent}
                      onToggle={() => toggleReady(s.id)}
                      onEdit={() => openEdit(s)}
                      onDelete={() => deleteSupply(s.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FAB */}
      <button
        className="fab"
        onClick={openAdd}
        disabled={plan.families.length === 0}
        style={{ opacity: plan.families.length === 0 ? 0.4 : 1 }}
      >
        ＋
      </button>

      {/* Modal */}
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
          />
        </div>
        <div className="form-group">
          <label className="form-label">分类</label>
          <select className="input" value={fCategory} onChange={e => setFCategory(e.target.value)}>
            {SUPPLY_CATEGORIES[activeType].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">负责家庭 *</label>
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
          />
        </div>
        {activeType === 'food' && (
          <div className="toggle-wrap" style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 14, color: 'var(--text)' }}>计入 AA 分摊</span>
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
              type="number"
              inputMode="decimal"
              placeholder="填了可一键同步到花费"
              value={fPrice}
              onChange={e => setFPrice(e.target.value)}
              min="0"
              step="0.01"
            />
            <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 4 }}>
              填写后可在「花费」页一键导入
            </div>
          </div>
        )}
      </Modal>
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
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--border)',
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
