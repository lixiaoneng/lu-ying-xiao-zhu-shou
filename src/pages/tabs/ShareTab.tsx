import { useState } from 'react';
import { useApp } from '../../App';
import { calculateSettlement } from '../../types';
import { exportPlanAsJson } from '../../store';

export default function ShareTab() {
  const { plan, toast } = useApp();
  const [copied, setCopied] = useState(false);

  function formatDate(d: string) {
    if (!d) return '';
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
  }

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

    // Personal supplies by family
    const personal = plan.supplies.filter(s => s.type === 'personal');
    if (personal.length > 0) {
      lines.push('🏕️ 各家自带');
      plan.families.forEach(fam => {
        const items = personal.filter(s => s.assigneeId === fam.id);
        if (items.length > 0) {
          lines.push(`  ${fam.name}：${items.map(s => s.name + (s.quantity ? `(${s.quantity})` : '')).join('、')}`);
        }
      });
      lines.push('');
    }

    // Food
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

    // Gear
    const gear = plan.supplies.filter(s => s.type === 'gear');
    if (gear.length > 0) {
      lines.push('⛺ 公共物资');
      plan.families.forEach(fam => {
        const items = gear.filter(s => s.assigneeId === fam.id);
        if (items.length > 0) {
          lines.push(`  ${fam.name}携带：${items.map(s => s.name + (s.quantity ? `(${s.quantity})` : '')).join('、')}`);
        }
      });
      lines.push('');
    }

    // Settlement
    if (plan.expenses.length > 0 && plan.families.length > 0) {
      const s = calculateSettlement(plan);
      if (s.totalAmount > 0) {
        const hasPartialAA = plan.expenses.some(
          e => e.includeInAA && e.aaScope && e.aaScope !== 'all'
        );
        lines.push('⚖️ AA 费用');
        const modeStr = hasPartialAA
          ? '含部分分摊'
          : s.aaMode === 'person'
            ? `共 ${s.totalUnits} 人，每人 ¥${s.perUnit.toFixed(2)}`
            : `共 ${s.totalUnits} 方，每方 ¥${s.perUnit.toFixed(2)}`;
        lines.push(`  合计：¥${s.totalAmount.toFixed(2)}（${modeStr}）`);
        lines.push('');
        lines.push('💰 垫付情况');
        s.familyBalances.forEach(fb => {
          const sign = fb.balance > 0.01 ? `（待收 ¥${fb.balance.toFixed(2)}）` : fb.balance < -0.01 ? `（待付 ¥${Math.abs(fb.balance).toFixed(2)}）` : '（已平）';
          lines.push(`  ${fb.familyName}：垫付 ¥${fb.paid.toFixed(2)} ${sign}`);
        });
        lines.push('');
        if (s.transactions.length > 0) {
          lines.push('💸 转账方案');
          s.transactions.forEach(tx => {
            lines.push(`  ${tx.fromFamilyName} → ${tx.toFamilyName}：¥${tx.amount.toFixed(2)}`);
          });
          lines.push('');
        }
      }
    }

    lines.push('——');
    lines.push('📱 由「露营小助手」生成');

    return lines.join('\n');
  }

  const text = generateText();

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast('已复制到剪贴板，快去发群里吧！');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast('复制失败，请手动选中文本复制', 'error');
    }
  }

  return (
    <div style={{ padding: '14px 14px 0' }}>
      {/* Header actions */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <button
          className="btn btn-primary"
          onClick={handleCopy}
          style={{ flex: 1, fontSize: 15 }}
        >
          {copied ? '✓ 已复制！' : '📋 复制群聊文案'}
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => exportPlanAsJson(plan)}
          style={{ padding: '12px 16px' }}
          title="导出JSON"
        >
          📤 导出
        </button>
      </div>

      {/* Preview */}
      <div style={{
        background: 'var(--card)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
        overflow: 'hidden',
        marginBottom: 16,
      }}>
        {/* WeChat-style header */}
        <div style={{
          background: '#1AAD19',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <div style={{
            width: 20, height: 20,
            borderRadius: 4,
            background: 'rgba(255,255,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12,
          }}>💬</div>
          <span style={{ color: 'white', fontSize: 13, fontWeight: 500 }}>微信群聊预览</span>
        </div>

        {/* Message bubble */}
        <div style={{ padding: '14px' }}>
          <div style={{
            background: '#F5F5F5',
            borderRadius: '4px 12px 12px 12px',
            padding: '12px 14px',
            maxWidth: '85%',
            display: 'inline-block',
          }}>
            <pre style={{
              fontFamily: 'Noto Sans SC, -apple-system, sans-serif',
              fontSize: 13,
              lineHeight: 1.75,
              color: '#1A1A1A',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              margin: 0,
            }}>
              {text}
            </pre>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div style={{
        background: 'var(--primary-dim)',
        border: '1px solid var(--primary-border)',
        borderRadius: 'var(--radius-sm)',
        padding: '12px 14px',
        fontSize: 13,
        color: 'var(--primary)',
        lineHeight: 1.6,
        marginBottom: 16,
      }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>💡 使用提示</div>
        <div>点击「复制群聊文案」后，直接粘贴到微信群即可。导出 JSON 可以保存完整数据备份，也可分享给小伙伴导入。</div>
      </div>

      {/* Prep checklist */}
      {plan.supplies.some(s => !s.isReady) && (
        <div style={{
          background: 'var(--card)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border)',
          padding: '14px',
          marginBottom: 16,
        }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>⏳ 还未准备好的物品</div>
          {plan.families.map(fam => {
            const notReady = plan.supplies.filter(s => s.assigneeId === fam.id && !s.isReady);
            if (notReady.length === 0) return null;
            return (
              <div key={fam.id} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
                  {fam.name}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {notReady.map(s => (
                    <span key={s.id} className="tag tag-orange">{s.name}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
