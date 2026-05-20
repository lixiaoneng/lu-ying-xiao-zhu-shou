import { useApp } from '../../App';
import { calculateSettlement } from '../../types';
import type { AAMode } from '../../types';

const FAMILY_PALETTE = [
  { bg: '#EEF6F2', border: '#C0DCC8', avatarBg: '#D8EDE2', avatarText: '#3D6B4F' },
  { bg: '#FBF3EF', border: '#E0C4B4', avatarBg: '#F5DDD0', avatarText: '#C06840' },
  { bg: '#FBF9F1', border: '#E8DDCA', avatarBg: '#F0E8CC', avatarText: '#9A6830' },
  { bg: '#EEF0F6', border: '#C8D0E0', avatarBg: '#D8DCF0', avatarText: '#4A5F8A' },
  { bg: '#F0F6F8', border: '#B8D4DC', avatarBg: '#C8E4EC', avatarText: '#2A6878' },
];

export default function SettlementTab() {
  const { plan, updatePlan } = useApp();
  const aaMode: AAMode = plan.aaMode ?? 'family';

  function setMode(mode: AAMode) {
    updatePlan({ ...plan, aaMode: mode });
  }

  if (plan.families.length === 0) {
    return (
      <div className="empty-state" style={{ marginTop: 40 }}>
        <div className="empty-icon">⚖️</div>
        <p>请先在「概况」中添加家庭 / 小组<br />再来计算 AA</p>
      </div>
    );
  }

  if (plan.expenses.length === 0) {
    return (
      <div className="empty-state" style={{ marginTop: 40 }}>
        <div className="empty-icon">💰</div>
        <p>还没有花费记录<br />在「花费」页添加后即可计算 AA</p>
      </div>
    );
  }

  const aaExpenses = plan.expenses.filter(e => e.includeInAA);
  if (aaExpenses.length === 0) {
    return (
      <div className="empty-state" style={{ marginTop: 40 }}>
        <div className="empty-icon">⚖️</div>
        <p>所有花费均未标记「计入AA」<br />请在花费页面开启 AA 开关</p>
      </div>
    );
  }

  const s = calculateSettlement(plan);

  const modeLabel = aaMode === 'person'
    ? `共 ${s.totalUnits} 人，每人 ¥${s.perUnit.toFixed(0)}`
    : `共 ${s.totalUnits} 个家庭，每家 ¥${s.perUnit.toFixed(0)}`;

  return (
    <div style={{ padding: '14px 14px 0' }}>

      {/* Mode toggle */}
      <div className="segment-control" style={{ marginBottom: 14 }}>
        <button
          className={`segment-btn${aaMode === 'family' ? ' active' : ''}`}
          onClick={() => setMode('family')}
        >
          🏠 按家庭均摊
        </button>
        <button
          className={`segment-btn${aaMode === 'person' ? ' active' : ''}`}
          onClick={() => setMode('person')}
        >
          👤 按人头均摊
        </button>
      </div>

      {/* Warning: no people for per-person mode */}
      {aaMode === 'person' && plan.people.length === 0 && (
        <div style={{
          background: 'var(--red-dim)',
          border: '1px solid #F5BDB8',
          borderRadius: 'var(--radius-xs)',
          padding: '10px 12px',
          fontSize: 13, color: 'var(--red)',
          marginBottom: 12,
        }}>
          请先在「概况」页添加参与人员，才能按人头计算
        </div>
      )}

      {/* Total banner */}
      <div style={{
        background: 'var(--card)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
        padding: '20px 22px',
        marginBottom: 14,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 6 }}>
            AA 总金额
          </div>
          <div style={{
            fontSize: 38, fontWeight: 700, color: 'var(--text)',
            fontFamily: "'Noto Serif SC', serif",
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}>
            ¥{s.totalAmount.toFixed(0)}
          </div>
        </div>
        <div style={{
          textAlign: 'right',
          fontSize: 13, color: 'var(--text-muted)',
          lineHeight: 1.5,
          paddingBottom: 4,
        }}>
          {modeLabel}
        </div>
      </div>

      {/* Per-family breakdown */}
      <div style={{
        fontSize: 11, fontWeight: 600, color: 'var(--text-light)',
        letterSpacing: '0.08em', textTransform: 'uppercase',
        marginBottom: 10,
      }}>
        各家明细
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {s.familyBalances.map((fb, i) => {
          const isCreditor = fb.balance > 0.01;
          const isDebtor = fb.balance < -0.01;
          const pal = FAMILY_PALETTE[i % FAMILY_PALETTE.length];

          return (
            <div
              key={fb.familyId}
              style={{
                background: pal.bg,
                borderRadius: 'var(--radius-sm)',
                border: `1px solid ${pal.border}`,
                padding: '14px',
                overflow: 'hidden',
              }}
            >
              {/* Header row */}
              <div style={{
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', marginBottom: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: pal.avatarBg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 600, color: pal.avatarText,
                    flexShrink: 0,
                  }}>
                    {fb.familyName.slice(0, 1)}
                  </div>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{fb.familyName}</span>
                    {aaMode === 'person' && (
                      <span style={{
                        marginLeft: 6, fontSize: 12, color: 'var(--text-muted)',
                        background: 'var(--bg-soft)',
                        padding: '1px 7px', borderRadius: 10,
                        border: '1px solid var(--border)',
                      }}>
                        {fb.memberCount} 人
                      </span>
                    )}
                  </div>
                </div>
                <span className={`tag ${isCreditor ? 'tag-green' : isDebtor ? 'tag-orange' : 'tag-gray'}`}>
                  {isCreditor ? '💚 待收款' : isDebtor ? '🔶 待付款' : '✓ 已平'}
                </span>
              </div>

              {/* Stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {[
                  { label: '已垫付', value: `¥${fb.paid.toFixed(0)}`, color: 'var(--text)' },
                  {
                    label: aaMode === 'person' ? `应摊 ×${fb.memberCount}` : '应摊',
                    value: `¥${fb.share.toFixed(0)}`,
                    color: 'var(--text-muted)',
                  },
                  {
                    label: isCreditor ? '应收' : isDebtor ? '应付' : '结清',
                    value: `¥${Math.abs(fb.balance).toFixed(0)}`,
                    color: isCreditor ? 'var(--green)' : isDebtor ? 'var(--accent)' : 'var(--text-light)',
                  },
                ].map(item => (
                  <div key={item.label} style={{
                    background: 'rgba(255,255,255,0.65)',
                    borderRadius: 8, padding: '8px 10px', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 11, color: 'var(--text-light)', marginBottom: 3 }}>{item.label}</div>
                    <div style={{
                      fontSize: 15, fontWeight: 700, color: item.color,
                      fontFamily: "'Noto Serif SC', serif",
                    }}>{item.value}</div>
                  </div>
                ))}
              </div>

              {/* Expense rows */}
              {plan.expenses.filter(e => e.payerFamilyId === fb.familyId && e.includeInAA).length > 0 && (
                <div style={{ marginTop: 10 }}>
                  {plan.expenses
                    .filter(e => e.payerFamilyId === fb.familyId && e.includeInAA)
                    .map(e => (
                      <div key={e.id} style={{
                        display: 'flex', justifyContent: 'space-between',
                        fontSize: 13, color: 'var(--text-muted)',
                        padding: '4px 0',
                        borderTop: '1px solid var(--bg-soft)',
                      }}>
                        <span>{e.item}{e.note ? ` · ${e.note}` : ''}</span>
                        <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>¥{e.amount.toFixed(0)}</span>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Transfer instructions */}
      {s.transactions.length > 0 && (
        <>
          <div style={{
            fontSize: 11, fontWeight: 600, color: 'var(--text-light)',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            marginBottom: 10,
          }}>
            转账方案
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {s.transactions.map((tx, i) => (
              <div key={i} style={{
                background: 'var(--card)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'var(--accent-dim)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, color: 'var(--accent)', flexShrink: 0,
                }}>
                  {tx.fromFamilyName.slice(0, 1)}
                </div>
                <div style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>
                  <span style={{ color: 'var(--text)' }}>{tx.fromFamilyName}</span>
                  <span style={{ color: 'var(--text-light)', margin: '0 8px', fontSize: 12 }}>→</span>
                  <span style={{ color: 'var(--green)' }}>{tx.toFamilyName}</span>
                </div>
                <div style={{
                  fontSize: 20, fontWeight: 700, color: 'var(--text)',
                  fontFamily: "'Noto Serif SC', serif",
                  flexShrink: 0,
                }}>
                  ¥{tx.amount.toFixed(0)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* All settled */}
      {s.transactions.length === 0 && (
        <div style={{
          background: 'var(--green-dim)',
          border: '1px solid var(--green-border)',
          borderRadius: 'var(--radius-sm)',
          padding: '16px',
          textAlign: 'center',
          color: 'var(--green)',
          fontWeight: 600,
          fontSize: 15,
          marginBottom: 16,
        }}>
          🎉 完美平衡，无需转账！
        </div>
      )}

      <div style={{ fontSize: 12, color: 'var(--text-light)', textAlign: 'center', marginBottom: 16 }}>
        转账方案按家庭 / 小组汇总
      </div>
    </div>
  );
}
