import { useState } from 'react';
import { useApp } from '../../App';
import { calculateSettlement } from '../../types';
import { exportPlanAsJson } from '../../store';

export default function ShareTab() {
  const { plan, toast } = useApp();
  const [copied, setCopied] = useState(false);

  function formatDate(d: string) {
    if (!d) return '';
    return new Date(d + 'T00:00:00').toLocaleDateString('zh-CN', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  }

  function generateText(): string {
    const lines: string[] = [];

    lines.push(`【一起去露营】${plan.name}`);
    if (plan.date) lines.push(`日期：${formatDate(plan.date)}`);
    if (plan.location) lines.push(`地点：${plan.location}`);
    lines.push('');

    if (plan.people.length > 0) {
      lines.push('参与人员');
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
      lines.push('各家自带');
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
      lines.push('公共食材');
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
      lines.push('营地装备');
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
        lines.push(`AA 费用：¥${s.totalAmount.toFixed(0)}（${modeStr}）`);
        lines.push('');
        lines.push('垫付情况');
        s.familyBalances.forEach(fb => {
          const sign = fb.balance > 0.01
            ? `（待收 ¥${fb.balance.toFixed(0)}）`
            : fb.balance < -0.01
              ? `（待付 ¥${Math.abs(fb.balance).toFixed(0)}）`
              : '（已平）';
          lines.push(`  ${fb.familyName}：垫付 ¥${fb.paid.toFixed(0)} ${sign}`);
        });
        if (s.transactions.length > 0) {
          lines.push('');
          lines.push('转账方案');
          s.transactions.forEach(tx => {
            lines.push(`  ${tx.fromFamilyName} → ${tx.toFamilyName}：¥${tx.amount.toFixed(0)}`);
          });
        }
        lines.push('');
      }
    }

    lines.push('——');
    lines.push('由「一起去露营」生成');

    return lines.join('\n');
  }

  const text = generateText();

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast('已复制，快去发群里吧！');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast('复制失败，请手动选中文本复制', 'error');
    }
  }

  // Not-ready supplies per family
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
          {copied ? '✓ 已复制' : '复制群聊文案'}
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => exportPlanAsJson(plan)}
          style={{ padding: '12px 18px' }}
          title="导出 JSON"
        >
          导出
        </button>
      </div>

      {/* Preview card */}
      <div style={{
        background: 'var(--card)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
        overflow: 'hidden',
        marginBottom: 14,
        boxShadow: 'var(--shadow-sm)',
      }}>
        {/* Subtle label bar */}
        <div style={{
          background: 'var(--bg-soft)',
          borderBottom: '1px solid var(--border)',
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#1AAD19',
          }} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
            群聊预览
          </span>
        </div>

        {/* Content */}
        <div style={{ padding: '14px 16px' }}>
          <pre style={{
            fontFamily: "'Noto Sans SC', -apple-system, sans-serif",
            fontSize: 13,
            lineHeight: 1.8,
            color: 'var(--text)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            margin: 0,
          }}>
            {text}
          </pre>
        </div>
      </div>

      {/* Tip */}
      <div style={{
        background: 'var(--primary-dim)',
        border: '1px solid var(--primary-border)',
        borderRadius: 'var(--radius-sm)',
        padding: '12px 14px',
        fontSize: 13,
        color: 'var(--primary)',
        lineHeight: 1.6,
        marginBottom: 14,
      }}>
        <div style={{ fontWeight: 600, marginBottom: 3 }}>使用提示</div>
        <div>复制后直接粘贴到微信群即可。导出 JSON 可保存完整数据备份，或分享给队友导入。</div>
      </div>

      {/* Not-ready checklist */}
      {notReadyFamilies.length > 0 && (
        <div style={{
          background: 'var(--card)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border)',
          padding: '14px',
          marginBottom: 16,
        }}>
          <div style={{
            fontSize: 14, fontWeight: 600,
            color: 'var(--text)', marginBottom: 10,
          }}>
            未备妥的物品
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {notReadyFamilies.map(({ family, items }) => (
              <div key={family.id}>
                <div style={{
                  fontSize: 12, fontWeight: 500,
                  color: 'var(--text-light)', marginBottom: 5,
                }}>
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
