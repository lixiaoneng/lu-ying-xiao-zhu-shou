import { useState } from 'react';
import type { Expense } from '../../types';
import { useApp } from '../../App';
import { generateId } from '../../store';
import Modal from '../../components/Modal';

export default function ExpensesTab() {
  const { plan, updatePlan, toast } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [selectedSupplyIds, setSelectedSupplyIds] = useState<Set<string>>(new Set());

  const [fPayer, setFPayer] = useState('');
  const [fItem, setFItem] = useState('');
  const [fAmount, setFAmount] = useState('');
  const [fNote, setFNote] = useState('');
  const [fInclude, setFInclude] = useState(true);

  const syncableSupplies = plan.supplies.filter(s => s.needsAA && s.price != null && s.price > 0);
  const unsyncedSupplies = syncableSupplies.filter(s =>
    !plan.expenses.some(e => e.item === s.name && e.payerFamilyId === s.assigneeId)
  );

  const familyMap = Object.fromEntries(plan.families.map(f => [f.id, f.name]));

  const aaTotal = plan.expenses.filter(e => e.includeInAA).reduce((s, e) => s + e.amount, 0);
  const total = plan.expenses.reduce((s, e) => s + e.amount, 0);

  function openSyncModal() {
    setSelectedSupplyIds(new Set(unsyncedSupplies.map(s => s.id)));
    setShowSyncModal(true);
  }

  function toggleSupplySelect(id: string) {
    setSelectedSupplyIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function doSync() {
    const toAdd: Expense[] = plan.supplies
      .filter(s => selectedSupplyIds.has(s.id) && s.price != null)
      .map(s => ({
        id: generateId(),
        payerFamilyId: s.assigneeId,
        item: s.name,
        amount: s.price!,
        note: '从物资同步',
        includeInAA: true,
      }));
    if (toAdd.length === 0) { setShowSyncModal(false); return; }
    updatePlan({ ...plan, expenses: [...plan.expenses, ...toAdd] });
    toast(`已同步 ${toAdd.length} 条花费记录`);
    setShowSyncModal(false);
  }

  function openAdd() {
    setEditExpense(null);
    setFPayer(plan.families[0]?.id ?? '');
    setFItem('');
    setFAmount('');
    setFNote('');
    setFInclude(true);
    setShowModal(true);
  }

  function openEdit(e: Expense) {
    setEditExpense(e);
    setFPayer(e.payerFamilyId);
    setFItem(e.item);
    setFAmount(String(e.amount));
    setFNote(e.note);
    setFInclude(e.includeInAA);
    setShowModal(true);
  }

  function saveExpense() {
    const amount = parseFloat(fAmount);
    if (!fItem.trim() || !fPayer || isNaN(amount) || amount <= 0) return;
    if (editExpense) {
      updatePlan({
        ...plan,
        expenses: plan.expenses.map(e => e.id === editExpense.id
          ? { ...e, payerFamilyId: fPayer, item: fItem.trim(), amount, note: fNote.trim(), includeInAA: fInclude }
          : e),
      });
      toast('花费已更新');
    } else {
      updatePlan({
        ...plan,
        expenses: [...plan.expenses, {
          id: generateId(),
          payerFamilyId: fPayer,
          item: fItem.trim(),
          amount,
          note: fNote.trim(),
          includeInAA: fInclude,
        }],
      });
      toast('花费已记录');
    }
    setShowModal(false);
  }

  function deleteExpense(id: string) {
    updatePlan({ ...plan, expenses: plan.expenses.filter(e => e.id !== id) });
    toast('已删除');
  }

  function toggleAA(id: string) {
    updatePlan({
      ...plan,
      expenses: plan.expenses.map(e => e.id === id ? { ...e, includeInAA: !e.includeInAA } : e),
    });
  }

  const byFamily = plan.families.map(f => ({
    family: f,
    expenses: plan.expenses.filter(e => e.payerFamilyId === f.id),
    total: plan.expenses.filter(e => e.payerFamilyId === f.id).reduce((s, e) => s + e.amount, 0),
  })).filter(g => g.expenses.length > 0);

  const uncategorized = plan.expenses.filter(
    e => !plan.families.some(f => f.id === e.payerFamilyId)
  );

  return (
    <div style={{ padding: '14px 14px 0' }}>

      {/* Sync banner */}
      {unsyncedSupplies.length > 0 && (
        <div style={{
          background: 'var(--primary-dim)',
          border: '1px solid var(--primary-border)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 14px',
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>📦</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>
              {unsyncedSupplies.length} 项物资可同步到花费
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              已填金额的 AA 物资，一键导入
            </div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={openSyncModal}>
            同步
          </button>
        </div>
      )}

      {/* Summary */}
      {plan.expenses.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          {/* Total */}
          <div style={{
            background: 'var(--card)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            padding: '14px 16px',
          }}>
            <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 6 }}>总花费</div>
            <div style={{
              fontSize: 26, fontWeight: 700, color: 'var(--text)',
              fontFamily: "'Noto Serif SC', serif",
              lineHeight: 1,
            }}>
              ¥{total.toFixed(0)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 5 }}>
              {plan.expenses.length} 笔记录
            </div>
          </div>
          {/* AA Total */}
          <div style={{
            background: 'var(--primary-dim)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--primary-border)',
            padding: '14px 16px',
          }}>
            <div style={{ fontSize: 12, color: 'var(--primary)', opacity: 0.8, marginBottom: 6 }}>计入 AA</div>
            <div style={{
              fontSize: 26, fontWeight: 700, color: 'var(--primary)',
              fontFamily: "'Noto Serif SC', serif",
              lineHeight: 1,
            }}>
              ¥{aaTotal.toFixed(0)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--primary)', opacity: 0.65, marginTop: 5 }}>
              {plan.families.length > 0
                ? `每家约 ¥${(aaTotal / plan.families.length).toFixed(0)}`
                : '待添加家庭'}
            </div>
          </div>
        </div>
      )}

      {/* Expense list */}
      {plan.expenses.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">💰</div>
          <p>还没有花费记录<br />点击右下角 ＋ 添加</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {byFamily.map(({ family, expenses, total: fTotal }) => (
            <div key={family.id}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 8,
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: 'var(--primary-dim)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 600, color: 'var(--primary)',
                    flexShrink: 0,
                  }}>
                    {family.name.slice(0, 1)}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                    {family.name}
                  </span>
                </div>
                <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500 }}>
                  垫付 ¥{fTotal.toFixed(0)}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {expenses.map(e => (
                  <ExpenseRow
                    key={e.id}
                    expense={e}
                    onEdit={() => openEdit(e)}
                    onDelete={() => deleteExpense(e.id)}
                    onToggleAA={() => toggleAA(e.id)}
                  />
                ))}
              </div>
            </div>
          ))}
          {uncategorized.length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 8 }}>其他</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {uncategorized.map(e => (
                  <ExpenseRow
                    key={e.id}
                    expense={e}
                    onEdit={() => openEdit(e)}
                    onDelete={() => deleteExpense(e.id)}
                    onToggleAA={() => toggleAA(e.id)}
                  />
                ))}
              </div>
            </div>
          )}
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

      {/* Sync modal */}
      <Modal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        title="从物资同步花费"
        footer={
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowSyncModal(false)}>
              取消
            </button>
            <button
              className="btn btn-primary"
              style={{ flex: 2 }}
              onClick={doSync}
              disabled={selectedSupplyIds.size === 0}
            >
              同步 {selectedSupplyIds.size} 条
            </button>
          </div>
        }
      >
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
          选择要同步的物资，将以「负责家庭」作为付款方导入花费：
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {syncableSupplies.map(s => {
            const alreadySynced = plan.expenses.some(e => e.item === s.name && e.payerFamilyId === s.assigneeId);
            const checked = selectedSupplyIds.has(s.id);
            return (
              <div
                key={s.id}
                onClick={() => !alreadySynced && toggleSupplySelect(s.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-xs)',
                  border: `1.5px solid ${checked ? 'var(--primary)' : 'var(--border)'}`,
                  background: checked ? 'var(--primary-dim)' : alreadySynced ? 'var(--bg-soft)' : 'white',
                  cursor: alreadySynced ? 'default' : 'pointer',
                  opacity: alreadySynced ? 0.55 : 1,
                  transition: 'all 0.15s',
                }}
              >
                <div className={`checkbox-custom${checked ? ' checked' : ''}`}>
                  {checked && '✓'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {familyMap[s.assigneeId] ?? '未知'}{s.quantity ? ` · ${s.quantity}` : ''}
                  </div>
                </div>
                <div style={{
                  fontSize: 15, fontWeight: 700,
                  color: alreadySynced ? 'var(--text-muted)' : 'var(--primary)',
                }}>
                  {alreadySynced ? '已同步' : `¥${s.price}`}
                </div>
              </div>
            );
          })}
        </div>
      </Modal>

      {/* Add / Edit modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editExpense ? '编辑花费' : '记录花费'}
        footer={
          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={saveExpense}
            disabled={!fItem.trim() || !fPayer || !fAmount || parseFloat(fAmount) <= 0}
          >
            {editExpense ? '保存修改' : '记录花费'}
          </button>
        }
      >
        <div className="form-group">
          <label className="form-label">付款家庭 *</label>
          <select className="input" value={fPayer} onChange={e => setFPayer(e.target.value)}>
            <option value="">请选择</option>
            {plan.families.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">项目名称 *</label>
          <input
            className="input"
            placeholder="例：营地预订费"
            value={fItem}
            onChange={e => setFItem(e.target.value)}
            autoFocus
          />
        </div>
        <div className="form-group">
          <label className="form-label">金额（元） *</label>
          <input
            className="input"
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={fAmount}
            onChange={e => setFAmount(e.target.value)}
            min="0"
            step="0.01"
          />
        </div>
        <div className="form-group">
          <label className="form-label">备注</label>
          <input
            className="input"
            placeholder="可选"
            value={fNote}
            onChange={e => setFNote(e.target.value)}
          />
        </div>
        <div className="toggle-wrap">
          <div>
            <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>计入 AA 分摊</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>关闭则仅记录，不参与均摊</div>
          </div>
          <button
            className={`toggle${fInclude ? ' on' : ''}`}
            onClick={() => setFInclude(!fInclude)}
          />
        </div>
      </Modal>
    </div>
  );
}

interface RowProps {
  expense: Expense;
  onEdit: () => void;
  onDelete: () => void;
  onToggleAA: () => void;
}

function ExpenseRow({ expense: e, onEdit, onDelete, onToggleAA }: RowProps) {
  return (
    <div style={{
      background: e.includeInAA ? 'var(--card)' : 'var(--bg-soft)',
      borderRadius: 'var(--radius-xs)',
      border: '1px solid var(--border)',
      padding: '10px 12px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>{e.item}</span>
          {e.note && (
            <span style={{ fontSize: 12, color: 'var(--text-light)' }}>{e.note}</span>
          )}
        </div>
        <div style={{ marginTop: 4 }}>
          {e.includeInAA ? (
            <span className="tag" style={{
              background: 'var(--accent-dim)',
              color: 'var(--accent)',
              border: '1px solid var(--accent-border)',
            }}>AA</span>
          ) : (
            <span className="tag tag-gray">不AA</span>
          )}
        </div>
      </div>

      <div style={{
        fontSize: 17, fontWeight: 700, color: 'var(--text)',
        fontFamily: "'Noto Serif SC', serif",
        flexShrink: 0,
      }}>
        ¥{e.amount.toFixed(0)}
      </div>

      <button
        className="btn-icon"
        onClick={onToggleAA}
        style={{ fontSize: 13, color: 'var(--text-light)' }}
        title="切换 AA"
      >
        ⇌
      </button>
      <button
        className="btn-icon"
        onClick={onEdit}
        style={{ fontSize: 15 }}
      >
        ✏️
      </button>
      <button
        className="btn-icon"
        onClick={onDelete}
        style={{ fontSize: 14, color: 'var(--text-light)' }}
      >
        ✕
      </button>
    </div>
  );
}
