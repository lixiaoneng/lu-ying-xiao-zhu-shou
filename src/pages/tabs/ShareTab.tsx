import { useState } from 'react';
import { useApp } from '../../App';
import { calculateSettlement } from '../../types';
import { exportPlanAsJson } from '../../store';
import type { CampingPlan } from '../../types';

export default function ShareTab() {
  const { plan, toast } = useApp();
  const [copied, setCopied] = useState(false);

  function formatDate(d: string) {
    if (!d) return '';
    return new Date(d + 'T00:00:00').toLocaleDateString('zh-CN', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  }

  // Plain-text for pasting into group chat (with emoji for warmth)
  function generateText(): string {
    const lines: string[] = [];

    lines.push(`🏕️ ${plan.name}`);
    if (plan.date) lines.push(`📅 ${formatDate(plan.date)}`);
    if (plan.location) lines.push(`📍 ${plan.location}`);
    lines.push('');

    if (plan.people.length > 0) {
      lines.push('👥 参与人员');
      plan.families.forEach(fam => {
        const members = plan.people.filter(p => p.familyId === fam.id);
        if (members.length > 0) {
          lines.push(`  ${fam.name}：${members.map(m => m.name).join('、')}`);
        }
      });
      lines.push('');
    }

    const personal = plan.supplies.filter(s => s.type === 'personal');
    if (personal.length > 0) {
      lines.push('🎒 各家自带');
      plan.families.forEach(fam => {
        const items = personal.filter(s => s.assigneeId === fam.id);
        if (items.length > 0) {
          lines.push(`  ${fam.name}：${items.map(s => s.name + (s.quantity ? `(${s.quantity})` : '')).join('、')}`);
        }
      });
      lines.push('');
    }

    const food = plan.supplies.filter(s => s.type === 'food');
    if (food.length > 0) {
      lines.push('🍖 公共食材');
      plan.families.forEach(fam => {
        const items = food.filter(s => s.assigneeId === fam.id);
        if (items.length > 0) {
          lines.push(`  ${fam.name}负责：${items.map(s => s.name + (s.quantity ? `(${s.quantity})` : '')).join('、')}`);
        }
      });
      lines.push('');
    }

    const gear = plan.supplies.filter(s => s.type === 'gear');
    if (gear.length > 0) {
      lines.push('⛺ 营地装备');
      plan.families.forEach(fam => {
        const items = gear.filter(s => s.assigneeId === fam.id);
        if (items.length > 0) {
          lines.push(`  ${fam.name}携带：${items.map(s => s.name + (s.quantity ? `(${s.quantity})` : '')).join('、')}`);
        }
      });
      lines.push('');
    }

    if (plan.expenses.length > 0 && plan.families.length > 0) {
      const s = calculateSettlement(plan);
      if (s.totalAmount > 0) {
        const modeStr = s.aaMode === 'person'
          ? `共 ${s.totalUnits} 人，每人 ¥${s.perUnit.toFixed(0)}`
          : `共 ${s.totalUnits} 家，每家 ¥${s.perUnit.toFixed(0)}`;
        lines.push(`💰 AA：¥${s.totalAmount.toFixed(0)}（${modeStr}）`);
        s.familyBalances.forEach(fb => {
          const sign = fb.balance > 0.01
            ? `待收 ¥${fb.balance.toFixed(0)}`
            : fb.balance < -0.01
              ? `待付 ¥${Math.abs(fb.balance).toFixed(0)}`
              : '已平';
          lines.push(`  ${fb.familyName}：垫付 ¥${fb.paid.toFixed(0)}（${sign}）`);
        });
        if (s.transactions.length > 0) {
          lines.push('');
          lines.push('💸 转账方案');
          s.transactions.forEach(tx => {
            lines.push(`  ${tx.fromFamilyName} → ${tx.toFamilyName}：¥${tx.amount.toFixed(0)}`);
          });
        }
        lines.push('');
      }
    }

    lines.push('——');
    lines.push('📱 由「一起去露营」整理');
    return lines.join('\n');
  }

  const text = generateText();

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast('已复制，快去发群里吧 ✌️');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast('复制失败，请手动选中文本复制', 'error');
    }
  }

  const notReadyFamilies = plan.families.map(fam => ({
    family: fam,
    items: plan.supplies.filter(s => s.assigneeId === fam.id && !s.isReady),
  })).filter(g => g.items.length > 0);

  return (
    <div style={{ padding: '14px 14px 0' }}>

      {/* Action row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <button
          className="btn btn-primary"
          onClick={handleCopy}
          style={{ flex: 1 }}
        >
          {copied ? '✓ 已复制！' : '📋 复制群聊文案'}
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => exportPlanAsJson(plan)}
          style={{ padding: '12px 18px' }}
          title="导出 JSON"
        >
          导出备份
        </button>
      </div>

      {/* Hint */}
      <div style={{
        fontSize: 12, color: 'var(--text-light)',
        textAlign: 'center', marginBottom: 12,
        letterSpacing: '0.01em',
      }}>
        👆 复制后直接粘贴到群里，或截图以下卡片
      </div>

      {/* Visual announcement card — designed for screenshot sharing */}
      <ShareCard plan={plan} />

      {/* Prep checklist */}
      {notReadyFamilies.length > 0 && (
        <div style={{
          background: 'var(--card)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border)',
          padding: '14px',
          marginTop: 14,
          marginBottom: 16,
        }}>
          <div style={{
            fontSize: 13, fontWeight: 600, color: 'var(--text)',
            marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span>⏳</span> 还没备好的东西
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {notReadyFamilies.map(({ family, items }) => (
              <div key={family.id}>
                <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 5 }}>
                  {family.name}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {items.map(s => (
                    <span key={s.id} className="tag" style={{
                      background: 'var(--accent-dim)',
                      color: 'var(--accent)',
                      border: '1px solid var(--accent-border)',
                    }}>
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Announcement card ─────────────────────────────────────── */
// Rendered as styled JSX — looks great as a screenshot.
// The copy button outputs plain text separately.
function ShareCard({ plan }: { plan: CampingPlan }) {
  const s = plan.expenses.length > 0 && plan.families.length > 0
    ? calculateSettlement(plan)
    : null;

  function formatDate(d: string) {
    if (!d) return '';
    return new Date(d + 'T00:00:00').toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
  }

  const personalByFamily = plan.families.map(f => ({
    family: f,
    items: plan.supplies.filter(s => s.type === 'personal' && s.assigneeId === f.id),
  })).filter(g => g.items.length > 0);

  const foodByFamily = plan.families.map(f => ({
    family: f,
    items: plan.supplies.filter(s => s.type === 'food' && s.assigneeId === f.id),
  })).filter(g => g.items.length > 0);

  const gearByFamily = plan.families.map(f => ({
    family: f,
    items: plan.supplies.filter(s => s.type === 'gear' && s.assigneeId === f.id),
  })).filter(g => g.items.length > 0);

  const peopleByFamily = plan.families.map(f => ({
    family: f,
    members: plan.people.filter(p => p.familyId === f.id),
  })).filter(g => g.members.length > 0);

  const hasSections = peopleByFamily.length > 0
    || personalByFamily.length > 0
    || foodByFamily.length > 0
    || gearByFamily.length > 0
    || (s && s.totalAmount > 0);

  return (
    <div style={{
      background: '#FAF5EE',
      borderRadius: 'var(--radius)',
      border: '1px solid var(--accent-border)',
      padding: '20px 18px',
      boxShadow: '0 2px 24px rgba(184,107,74,0.08)',
      marginBottom: 4,
    }}>
      {/* Header */}
      <div style={{ marginBottom: hasSections ? 14 : 0 }}>
        <div style={{
          fontFamily: "'Noto Serif SC', serif",
          fontSize: 20, fontWeight: 700,
          color: 'var(--text)',
          letterSpacing: '-0.01em',
          lineHeight: 1.3,
        }}>
          ⛺ {plan.name}
        </div>
        {(plan.date || plan.location) && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 8,
            marginTop: 6, fontSize: 13, color: 'var(--text-muted)',
          }}>
            {plan.date && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                📅 {formatDate(plan.date)}
              </span>
            )}
            {plan.location && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                📍 {plan.location}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Sections */}
      {hasSections && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

          {/* Participants */}
          {peopleByFamily.length > 0 && (
            <CardSection icon="👥" title="参与人员">
              {peopleByFamily.map(({ family, members }) => (
                <CardRow key={family.id} label={family.name} value={members.map(m => m.name).join('、')} />
              ))}
            </CardSection>
          )}

          {/* Menu */}
          {plan.menuItems.length > 0 && (
            <CardSection icon="🍽" title="菜单安排">
              {Object.entries(
                plan.menuItems.reduce<Record<string, typeof plan.menuItems>>((acc, item) => {
                  (acc[item.time] = acc[item.time] || []).push(item);
                  return acc;
                }, {})
              ).map(([time, items]) => (
                <CardRow
                  key={time}
                  label={time}
                  value={items.map(i => `${i.meal} ${i.menu}`).join(' / ')}
                />
              ))}
            </CardSection>
          )}

          {/* Personal supplies */}
          {personalByFamily.length > 0 && (
            <CardSection icon="🎒" title="各家自带">
              {personalByFamily.map(({ family, items }) => (
                <CardRow
                  key={family.id}
                  label={family.name}
                  value={items.map(s => s.name + (s.quantity ? `(${s.quantity})` : '')).join('、')}
                />
              ))}
            </CardSection>
          )}

          {/* Food */}
          {foodByFamily.length > 0 && (
            <CardSection icon="🍖" title="公共食材">
              {foodByFamily.map(({ family, items }) => (
                <CardRow
                  key={family.id}
                  label={family.name}
                  value={items.map(s => s.name + (s.quantity ? `(${s.quantity})` : '')).join('、')}
                />
              ))}
            </CardSection>
          )}

          {/* Gear */}
          {gearByFamily.length > 0 && (
            <CardSection icon="⛺" title="营地装备">
              {gearByFamily.map(({ family, items }) => (
                <CardRow
                  key={family.id}
                  label={family.name}
                  value={items.map(s => s.name + (s.quantity ? `(${s.quantity})` : '')).join('、')}
                />
              ))}
            </CardSection>
          )}

          {/* AA */}
          {s && s.totalAmount > 0 && (
            <CardSection icon="💰" title="AA 费用">
              <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600, marginBottom: 4 }}>
                合计 ¥{s.totalAmount.toFixed(0)}
                <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--text-muted)', marginLeft: 8 }}>
                  {s.aaMode === 'person'
                    ? `每人 ¥${s.perUnit.toFixed(0)}`
                    : `每家 ¥${s.perUnit.toFixed(0)}`}
                </span>
              </div>
              {s.transactions.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                  {s.transactions.map((tx, i) => (
                    <div key={i} style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      {tx.fromFamilyName}
                      <span style={{ margin: '0 5px', color: 'var(--accent)' }}>→</span>
                      {tx.toFamilyName}
                      <span style={{ marginLeft: 6, color: 'var(--text)', fontWeight: 600 }}>
                        ¥{tx.amount.toFixed(0)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {s.transactions.length === 0 && (
                <div style={{ fontSize: 13, color: 'var(--green)', fontWeight: 500 }}>
                  完美平衡，无需转账 ✓
                </div>
              )}
            </CardSection>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={{
        marginTop: 16,
        paddingTop: 12,
        borderTop: '1px dashed var(--border)',
        fontSize: 11,
        color: 'var(--text-light)',
        textAlign: 'center',
        letterSpacing: '0.04em',
      }}>
        📱 由「一起去露营」整理
      </div>
    </div>
  );
}

function CardSection({
  icon, title, children,
}: {
  icon: string; title: string; children: React.ReactNode;
}) {
  return (
    <div style={{
      paddingTop: 12, marginTop: 12,
      borderTop: '1px solid #E8E0D0',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5,
        fontSize: 12, fontWeight: 700, color: 'var(--text-2)',
        letterSpacing: '0.04em', marginBottom: 8,
        textTransform: 'uppercase',
      }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {children}
      </div>
    </div>
  );
}

function CardRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, fontSize: 13, lineHeight: 1.5 }}>
      <span style={{
        flexShrink: 0, minWidth: 52,
        color: 'var(--text-muted)',
        fontWeight: 500,
      }}>
        {label}
      </span>
      <span style={{ color: 'var(--text)', flex: 1 }}>{value}</span>
    </div>
  );
}
