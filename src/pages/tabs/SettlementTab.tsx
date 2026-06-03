import { useApp } from '../../App';
import { calculateSettlement, expenseIncludesFamily } from '../../types';

export default function SettlementTab() {
  const { plan } = useApp();

  if (plan.families.length === 0) {
    return (
      <div className="empty-state" style={{ marginTop: 40 }}>
        <div className="empty-icon">⚖️</div>
        <p>请先在「概况」中添加<br />家庭/小组或独立参与者，再来计算 AA</p>
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

  // 是否存在部分AA费用
  const hasPartialAA = plan.expenses.some(
    e => e.includeInAA && e.aaScope && e.aaScope !== 'all'
  );

  const modeLabel = hasPartialAA
    ? '含部分分摊，见下方各方明细'
    : `每人 ¥${s.perUnit.toFixed(2)}（共 ${s.totalUnits} 人）`;

  return (
    <div style={{ padding: '14px 14px 0' }}>

      {/* Total banner */}
      <div style={{
        background: 'linear-gradient(135deg, #2C1A0E 0%, #4A2E18 100%)',
        borderRadius: 'var(--radius)',
        padding: '20px',
        marginBottom: 14,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -30, right: -30,
          width: 120, height: 120, borderRadius: '50%',
          background: 'rgba(200, 101, 26, 0.15)',
        }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>
            AA 总金额
          </div>
          <div style={{ fontSize: 36, color: 'white', fontFamily: 'ZCOOL XiaoWei, serif' }}>
            ¥{s.totalAmount.toFixed(2)}
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>
            {modeLabel}
          </div>
        </div>
      </div>

      {/* Per-family breakdown */}
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 10 }}>
        各方明细
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {s.familyBalances.map(fb => {
          const isCreditor = fb.balance > 0.01;
          const isDebtor = fb.balance < -0.01;

          return (
            <div
              key={fb.familyId}
              style={{
                background: 'var(--card)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                borderLeft: `4px solid ${isCreditor ? 'var(--green)' : isDebtor ? 'var(--primary)' : 'var(--border)'}`,
                padding: '14px 14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{fb.familyName}</span>
                  {fb.memberCount > 0 && (
                    <span style={{
                      marginLeft: 8, fontSize: 12,
                      color: 'var(--text-muted)',
                      background: 'var(--bg-warm)',
                      padding: '2px 8px', borderRadius: 10,
                      border: '1px solid var(--border)',
                    }}>
                      {fb.memberCount} 人
                    </span>
                  )}
                </div>
                <span className={`tag ${isCreditor ? 'tag-green' : isDebtor ? 'tag-orange' : 'tag-gray'}`}>
                  {isCreditor ? '💚 待收款' : isDebtor ? '🔶 待付款' : '✓ 已平'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {[
                  { label: '已垫付', value: `¥${fb.paid.toFixed(2)}`, color: 'var(--text)' },
                  {
                    label: (!hasPartialAA && fb.memberCount > 0) ? `应摊(×${fb.memberCount}人)` : '应摊',
                    value: `¥${fb.share.toFixed(2)}`,
                    color: 'var(--text-muted)',
                  },
                  {
                    label: isCreditor ? '应收' : isDebtor ? '应付' : '已平',
                    value: `¥${Math.abs(fb.balance).toFixed(2)}`,
                    color: isCreditor ? 'var(--green)' : isDebtor ? 'var(--primary)' : 'var(--text-muted)',
                  },
                ].map(item => (
                  <div key={item.label} style={{
                    background: 'var(--bg)',
                    borderRadius: 8, padding: '8px 10px', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{item.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: item.color }}>{item.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 10 }}>
                {plan.expenses
                  .filter(e => e.payerFamilyId === fb.familyId && e.includeInAA)
                  .map(e => {
                    const isPartial = e.aaScope && e.aaScope !== 'all';
                    const scopeCount = isPartial ? (e.aaScope as string[]).length : null;
                    return (
                      <div key={e.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        fontSize: 13, color: 'var(--text-muted)',
                        padding: '4px 0',
                        borderTop: '1px solid var(--bg-warm)',
                        gap: 6,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {e.item}{e.note ? ` (${e.note})` : ''}
                          </span>
                          {isPartial && (
                            <span style={{
                              fontSize: 10, padding: '1px 5px', borderRadius: 8, flexShrink: 0,
                              background: 'rgba(106,155,88,0.12)', color: '#5A8A48',
                              border: '1px solid rgba(106,155,88,0.2)',
                            }}>
                              {expenseIncludesFamily(e, fb.familyId) ? `${scopeCount}方分摊` : '不参与'}
                            </span>
                          )}
                        </div>
                        <span style={{ color: 'var(--text)', flexShrink: 0 }}>¥{e.amount.toFixed(2)}</span>
                      </div>
                    );
                  })
                }
              </div>
            </div>
          );
        })}
      </div>

      {/* Transfer instructions */}
      {s.transactions.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 10 }}>
            转账方案
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {s.transactions.map((tx, i) => (
              <div key={i} style={{
                background: 'var(--card)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'var(--primary-dim)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, color: 'var(--primary)', flexShrink: 0,
                }}>
                  {tx.fromFamilyName.slice(0, 1)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>
                    <span style={{ color: 'var(--primary)' }}>{tx.fromFamilyName}</span>
                    <span style={{ color: 'var(--text-muted)', margin: '0 6px' }}>→</span>
                    <span style={{ color: 'var(--green)' }}>{tx.toFamilyName}</span>
                  </div>
                </div>
                <div style={{
                  fontSize: 20, fontWeight: 700, color: 'var(--text)',
                  fontFamily: 'ZCOOL XiaoWei, serif', flexShrink: 0,
                }}>
                  ¥{tx.amount.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {s.transactions.length === 0 && (
        <div style={{
          background: 'var(--green-dim)',
          border: '1px solid var(--green-border)',
          borderRadius: 'var(--radius-sm)',
          padding: '16px', textAlign: 'center',
          color: 'var(--green)', fontWeight: 500, fontSize: 15,
          marginBottom: 16,
        }}>
          🎉 完美平衡，无需转账！
        </div>
      )}

      <div style={{ fontSize: 12, color: 'var(--text-light)', textAlign: 'center', marginBottom: 16 }}>
        按实际参与人数均摊，转账结果按家庭汇总展示
      </div>
    </div>
  );
}
