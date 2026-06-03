import { useState } from 'react';
import type { Supply, SupplyType } from '../../types';

import { SUPPLY_TYPE_LABELS, SUPPLY_TYPE_ICONS, SUPPLY_CATEGORIES } from '../../types';
import { useApp } from '../../App';
import { generateId } from '../../store';
import Modal from '../../components/Modal';

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
  const { plan, updatePlan, toast, setCurrentTab } = useApp();
  const [showNoFamilyGuide, setShowNoFamilyGuide] = useState(false);
  const [activeType, setActiveType] = useState<SupplyType>('personal');
  const [filterFamily, setFilterFamily] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editSupply, setEditSupply] = useState<Supply | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supply | null>(null);

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

  function confirmDeleteSupply() {
    if (!deleteTarget) return;
    updatePlan({ ...plan, supplies: plan.supplies.filter(s => s.id !== deleteTarget.id) });
    toast('已删除');
    setDeleteTarget(null);
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
                      onDelete={() => setDeleteTarget(s)}
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
          <label className="form-label">分类</label>
          <select className="input" value={fCategory} onChange={e => setFCategory(e.target.value)}>
            {SUPPLY_CATEGORIES[activeType].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
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
