// AI 助手 Demo · 面板组件
//
// 渲染三个功能区：
// 1. 智能检查 / 查漏补缺
// 2. 计划体检 / 完成度 + 待确认
// 3. 生成群通知 / 一键复制
//
// 重要约束：
// - 只通过 useApp() 读取 plan，**不调用 updatePlan**
// - 不读 useAuth / sync.ts / Supabase
// - 不修改 plan 数据结构
// - 数据全部通过 useMemo 派生，依赖变化时自动重算

import { useMemo, useState } from 'react';
import { useApp } from '../../App';
import Modal from '../../components/Modal';
import { runChecklist } from './checklist';
import { runSummary } from './summary';
import { generateShareCopy } from './shareCopy';
import type { CheckFinding, PlanSummary, StatStatus } from './types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const SEVERITY_META: Record<string, { icon: string; label: string; bg: string; color: string }> = {
  missing: { icon: '⛔', label: '待补', bg: '#FDE4E0', color: '#B03020' },
  warn:    { icon: '⚠️', label: '建议确认', bg: '#FEF3E8', color: '#C8651A' },
  info:    { icon: '💡', label: '提示', bg: '#E0EAF5', color: '#3A5F8A' },
};

const STATUS_META: Record<StatStatus, { color: string; label: string }> = {
  good:    { color: 'var(--green)',     label: '✓' },
  warn:    { color: '#C8651A',          label: '!' },
  missing: { color: 'var(--red, #C0392B)', label: '✕' },
};

export default function AIAssistantPanel({ isOpen, onClose }: Props) {
  const { plan, toast } = useApp();
  const [copied, setCopied] = useState(false);

  // ── 派生数据（pure，从 plan 同步重算）──
  const findings: CheckFinding[] = useMemo(() => runChecklist(plan), [plan]);
  const summary: PlanSummary = useMemo(() => runSummary(plan), [plan]);
  const shareText: string = useMemo(() => generateShareCopy(plan), [plan]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      toast('群通知文案已复制');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast('复制失败，请手动选中文本复制', 'error');
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="✨ AI 助手 Demo"
      footer={
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-ghost"
            style={{ flex: 1 }}
            onClick={onClose}
          >
            关闭
          </button>
          <button
            className="btn btn-primary"
            style={{ flex: 2 }}
            onClick={handleCopy}
          >
            {copied ? '✓ 已复制' : '📋 复制群通知'}
          </button>
        </div>
      }
    >
      {/* ── 提示条：当前 Demo 实现方式 ── */}
      <div style={{
        background: 'var(--primary-dim)',
        border: '1px solid var(--primary-border)',
        borderRadius: 'var(--radius-xs)',
        padding: '10px 12px',
        fontSize: 12,
        color: 'var(--primary)',
        lineHeight: 1.6,
        marginBottom: 16,
      }}>
        当前为规则版 Demo：助手按本地规则检查计划，不修改你的数据。
        未来可接入真实模型 API。
      </div>

      {/* ── 1. 计划体检 ── */}
      <Section title="📊 计划体检" subtitle="看一眼整体准备度">
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          background: 'var(--bg-warm)',
          borderRadius: 'var(--radius-xs)',
          padding: '12px 14px',
          marginBottom: 12,
        }}>
          <div style={{
            fontSize: 32, fontFamily: 'ZCOOL XiaoWei, serif',
            color: summary.overall >= 80 ? 'var(--green)'
                  : summary.overall >= 50 ? '#C8651A'
                  : 'var(--red, #C0392B)',
            minWidth: 70,
          }}>
            {summary.overall}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {summary.highlights.map((h, i) => (
              <div key={i} style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
                {h}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {summary.stats.map(s => (
            <div
              key={s.label}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px',
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xs)',
              }}
            >
              <span style={{
                fontSize: 12, color: STATUS_META[s.status].color,
                fontWeight: 700, minWidth: 14, textAlign: 'center',
              }}>
                {STATUS_META[s.status].label}
              </span>
              <span style={{ fontSize: 13, color: 'var(--text)', minWidth: 56 }}>{s.label}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1, textAlign: 'right' }}>
                {s.value}
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 2. 智能检查 ── */}
      <Section title="🔍 智能检查" subtitle="按规则查漏补缺">
        {findings.length === 0 ? (
          <EmptyHint text="没发现明显问题，可以准备出发了。" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {findings.map(f => {
              const meta = SEVERITY_META[f.severity];
              return (
                <div
                  key={f.id}
                  style={{
                    background: meta.bg,
                    borderRadius: 'var(--radius-xs)',
                    padding: '10px 12px',
                  }}
                >
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    marginBottom: 4,
                  }}>
                    <span style={{ fontSize: 14 }}>{meta.icon}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: meta.color,
                      letterSpacing: '0.04em',
                    }}>{meta.label}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {f.category}</span>
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500, lineHeight: 1.5 }}>
                    {f.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
                    {f.hint}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* ── 3. 待确认事项（前 5 条 missing+warn）── */}
      {summary.pendingItems.length > 0 && (
        <Section title="📌 待确认" subtitle="优先处理这些">
          <ul style={{
            margin: 0, padding: '0 0 0 18px',
            fontSize: 13, color: 'var(--text)', lineHeight: 1.7,
          }}>
            {summary.pendingItems.map((p, i) => (
              <li key={i} style={{ marginBottom: 4 }}>{p}</li>
            ))}
          </ul>
        </Section>
      )}

      {/* ── 4. 群通知文案 ── */}
      <Section title="📋 生成群通知" subtitle="复制后发到微信群">
        <div style={{
          background: 'var(--bg-warm)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xs)',
          padding: 12,
          maxHeight: 240,
          overflowY: 'auto',
        }}>
          <pre style={{
            fontFamily: 'Noto Sans SC, -apple-system, sans-serif',
            fontSize: 12.5,
            lineHeight: 1.7,
            color: 'var(--text)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            margin: 0,
          }}>
            {shareText}
          </pre>
        </div>
      </Section>
    </Modal>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 18 }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {subtitle}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div style={{
      textAlign: 'center', padding: '20px 0',
      color: 'var(--text-muted)', fontSize: 13,
    }}>
      {text}
    </div>
  );
}
