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

    // Date + location on one line if both present
    if (plan.date && plan.location) {
      lines.push(`📅 ${formatDate(plan.date)}　📍 ${plan.location}`);
    } else if (plan.date) {
      lines.push(`📅 ${formatDate(plan.date)}`);
    } else if (plan.location) {
      lines.push(`📍 ${plan.location}`);
    }
    lines.push('');

    if (plan.people.length > 0) {
      lines.push('👥 参与人员');
      plan.families.forEach(fam => {
        const members = plan.people.filter(p => p.familyId === fam.id);
        if (members.length > 0) {
          lines.push(`${fam.name}：${members.map(m => m.name).join('、')}`);
        }
      });
      lines.push('');
    }

    if (plan.menuItems.length > 0) {
      lines.push('🍽 菜单安排');
      const groups: Record<string, typeof plan.menuItems> = {};
      plan.menuItems.forEach(item => {
        (groups[item.time] = groups[item.time] || []).push(item);
      });
      Object.entries(groups).forEach(([time, items]) => {
        items.forEach(item => {
          const resp = item.responsible ? `（${item.responsible}负责）` : '';
          lines.push(`[${time}] ${item.meal}：${item.menu}${resp}`);
        });
      });
      lines.push('');
    }

    const personal = plan.supplies.filter(s => s.type === 'personal');
    if (personal.length > 0) {
      lines.push('🎒 各家自带');
      plan.families.forEach(fam => {
        const items = personal.filter(s => s.assigneeId === fam.id);
        if (items.length > 0) {
          lines.push(`${fam.name}：${items.map(s => s.name + (s.quantity ? `(${s.quantity})` : '')).join('、')}`);
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
          lines.push(`${fam.name}负责：${items.map(s => s.name + (s.quantity ? `(${s.quantity})` : '')).join('、')}`);
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
          lines.push(`${fam.name}携带：${items.map(s => s.name + (s.quantity ? `(${s.quantity})` : '')).join('、')}`);
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
          lines.push(`${fb.familyName}：垫付 ¥${fb.paid.toFixed(0)}（${sign}）`);
        });
        if (s.transactions.length > 0) {
          lines.push('');
          lines.push('💸 转账方案');
          s.transactions.forEach(tx => {
            lines.push(`${tx.fromFamilyName} → ${tx.toFamilyName}：¥${tx.amount.toFixed(0)}`);
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

  return (
    <div style={{
      background: '#FAF6F0',
      borderRadius: 'var(--radius)',
      border: '1px solid #DDD0BC',
      overflow: 'hidden',
      boxShadow: '0 3px 28px rgba(80,60,30,0.09)',
      marginBottom: 4,
    }}>
      {/* ── Gradient header ── */}
      <div style={{
        background: 'linear-gradient(135deg, #2E5540 0%, #3D6B50 45%, #5A8A6A 100%)',
        padding: '20px 18px 22px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.09)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -20, left: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,210,80,0.12)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            fontFamily: "'Noto Serif SC', serif",
            fontSize: 20, fontWeight: 700,
            color: 'white',
            letterSpacing: '-0.01em', lineHeight: 1.3,
            textShadow: '0 1px 8px rgba(0,0,0,0.15)',
          }}>
            ⛺ {plan.name}
          </div>
          {(plan.date || plan.location) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8, fontSize: 13, color: 'rgba(255,255,255,0.80)' }}>
              {plan.date && <span>📅 {formatDate(plan.date)}</span>}
              {plan.location && <span>📍 {plan.location}</span>}
            </div>
          )}
        </div>
      </div>

      {/* ── Content sections ── */}
      <div style={{ padding: '4px 18px 18px' }}>

        {peopleByFamily.length > 0 && (
          <CardSection icon="👥" title="参与人员" color="#3D6B50">
            {peopleByFamily.map(({ family, members }) => (
              <CardRow key={family.id} label={family.name} value={members.map(m => m.name).join('、')} />
            ))}
          </CardSection>
        )}

        {plan.menuItems.length > 0 && (
          <CardSection icon="🍽" title="菜单安排" color="#C07040">
            {Object.entries(
              plan.menuItems.reduce<Record<string, typeof plan.menuItems>>((acc, item) => {
                (acc[item.time] = acc[item.time] || []).push(item);
                return acc;
              }, {})
            ).map(([time, items]) => (
              <CardRow key={time} label={time} value={items.map(i => `${i.meal} ${i.menu}`).join(' / ')} />
            ))}
          </CardSection>
        )}

        {personalByFamily.length > 0 && (
          <CardSection icon="🎒" title="各家自带" color="#8A6A2A">
            {personalByFamily.map(({ family, items }) => (
              <CardRow key={family.id} label={family.name} value={items.map(s => s.name + (s.quantity ? `(${s.quantity})` : '')).join('、')} />
            ))}
          </CardSection>
        )}

        {foodByFamily.length > 0 && (
          <CardSection icon="🍖" title="公共食材" color="#B85830">
            {foodByFamily.map(({ family, items }) => (
              <CardRow key={family.id} label={family.name} value={items.map(s => s.name + (s.quantity ? `(${s.quantity})` : '')).join('、')} />
            ))}
          </CardSection>
        )}

        {gearByFamily.length > 0 && (
          <CardSection icon="⛺" title="营地装备" color="#2E6048">
            {gearByFamily.map(({ family, items }) => (
              <CardRow key={family.id} label={family.name} value={items.map(s => s.name + (s.quantity ? `(${s.quantity})` : '')).join('、')} />
            ))}
          </CardSection>
        )}

        {s && s.totalAmount > 0 && (
          <CardSection icon="💰" title="AA 费用" color="#7A5820">
            <div style={{ fontSize: 14, color: '#5A3800', fontWeight: 700, marginBottom: 4 }}>
              合计 ¥{s.totalAmount.toFixed(0)}
              <span style={{ fontWeight: 400, fontSize: 13, color: '#8A6020', marginLeft: 8 }}>
                {s.aaMode === 'person' ? `每人 ¥${s.perUnit.toFixed(0)}` : `每家 ¥${s.perUnit.toFixed(0)}`}
              </span>
            </div>
            {s.transactions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
                {s.transactions.map((tx, i) => (
                  <div key={i} style={{ fontSize: 13, color: '#6A4A10' }}>
                    {tx.fromFamilyName}
                    <span style={{ margin: '0 6px', color: '#C07040' }}>→</span>
                    {tx.toFamilyName}
                    <span style={{ marginLeft: 6, fontWeight: 700 }}>¥{tx.amount.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            )}
            {s.transactions.length === 0 && (
              <div style={{ fontSize: 13, color: '#2E6048', fontWeight: 600 }}>完美平衡，无需转账 ✓</div>
            )}
          </CardSection>
        )}

        {/* Footer */}
        <div style={{
          marginTop: 16, paddingTop: 12,
          borderTop: '1px dashed #D8C8B0',
          fontSize: 11, color: '#A89070',
          textAlign: 'center', letterSpacing: '0.05em',
        }}>
          📱 由「一起去露营」整理
        </div>
      </div>
    </div>
  );
}

function CardSection({
  icon, title, color, children,
}: {
  icon: string; title: string; color: string; children: React.ReactNode;
}) {
  // Build a very light tint from the color for the pill bg
  return (
    <div style={{ paddingTop: 14, marginTop: 14, borderTop: '1px solid #E8DCC8' }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        background: color + '18',
        border: `1px solid ${color}30`,
        borderRadius: 8, padding: '3px 9px',
        fontSize: 11, fontWeight: 700, color,
        letterSpacing: '0.04em', marginBottom: 9,
        textTransform: 'uppercase',
      }}>
        <span style={{ fontSize: 13 }}>{icon}</span>
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
    <div style={{ display: 'flex', gap: 8, fontSize: 13, lineHeight: 1.5 }}>
      <span style={{
        flexShrink: 0,
        color: 'var(--text-muted)',
        fontWeight: 500,
        whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      <span style={{ color: 'var(--text)', flex: 1 }}>{value}</span>
    </div>
  );
}
