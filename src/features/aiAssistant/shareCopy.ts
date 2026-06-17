// AI 助手 Demo · 群通知文案
//
// 纯函数：根据 CampingPlan + runChecklist 派生一段适合发群的通知文案
// - 与 ShareTab.tsx::generateText 风格不同：本函数偏"提醒 + 待办"型
// - 不调用任何写入接口

import type { CampingPlan, Supply, MenuItem } from '../../types';
import { runChecklist } from './checklist';
import { runSummary } from './summary';

function fmtDate(d: string): string {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
}

function dateRange(plan: CampingPlan): string {
  if (!plan.date) return '日期待定';
  if (!plan.endDate || plan.endDate === plan.date) return fmtDate(plan.date);
  return `${fmtDate(plan.date)} - ${fmtDate(plan.endDate)}`;
}

interface TodoLine {
  familyName: string;
  itemNames: string[];
}

function buildNotReadyTodos(plan: CampingPlan): TodoLine[] {
  const map = new Map<string, string[]>();
  plan.supplies
    .filter((s: Supply) => !s.isReady)
    .forEach(s => {
      const family = plan.families.find(f => f.id === s.assigneeId);
      const key = family?.name ?? '未指定';
      const list = map.get(key) ?? [];
      list.push(s.name);
      map.set(key, list);
    });
  return Array.from(map.entries())
    .filter(([, items]) => items.length > 0)
    .map(([familyName, itemNames]) => ({ familyName, itemNames }));
}

function buildMenuReminder(plan: CampingPlan): string[] {
  const noResp: string[] = [];
  plan.menuItems.forEach((m: MenuItem) => {
    if (!m.responsible) {
      noResp.push(`${m.time} ${m.meal}：${m.menu}`);
    }
  });
  return noResp;
}

export function generateShareCopy(plan: CampingPlan): string {
  const lines: string[] = [];
  const summary = runSummary(plan);
  const findings = runChecklist(plan);
  const missing = findings.filter(f => f.severity === 'missing');
  const warns = findings.filter(f => f.severity === 'warn');

  // 标题
  lines.push(`🏕️ ${plan.name || '露营计划'} · 助手建议`);
  lines.push(`📅 ${dateRange(plan)}${plan.location ? ' · 📍 ' + plan.location : ''}`);
  lines.push('');

  // 概览
  lines.push(`📊 计划完整度：${summary.overall} / 100`);
  if (plan.families.length > 0) {
    lines.push(
      `👥 ${plan.families.length} 个家庭 · ${plan.people.length} 人`
    );
  }
  if (plan.supplies.length > 0) {
    const ready = plan.supplies.filter(s => s.isReady).length;
    lines.push(`🎒 物资 ${ready}/${plan.supplies.length} 已备齐`);
  }
  lines.push('');

  // 待确认事项（来自体检）
  if (missing.length === 0 && warns.length === 0) {
    lines.push('✅ 看起来很完整，可以准备出发了。');
  } else {
    if (missing.length > 0) {
      lines.push('⚠️ 待补：');
      missing.slice(0, 5).forEach(f => lines.push(`  · ${f.title}`));
      lines.push('');
    }
    if (warns.length > 0) {
      lines.push('🔍 建议确认：');
      warns.slice(0, 5).forEach(f => lines.push(`  · ${f.title}`));
      lines.push('');
    }
  }

  // 各家待办
  const todos = buildNotReadyTodos(plan);
  if (todos.length > 0) {
    lines.push('📋 还没准备好的物品：');
    todos.forEach(t => {
      lines.push(`  · @${t.familyName}：${t.itemNames.join('、')}`);
    });
    lines.push('');
  }

  // 菜单提醒
  const menuReminder = buildMenuReminder(plan);
  if (menuReminder.length > 0) {
    lines.push('🍽️ 还没指定主厨的餐次：');
    menuReminder.slice(0, 5).forEach(m => lines.push(`  · ${m}`));
    lines.push('');
  }

  lines.push('——');
  lines.push('💬 完整计划请打开「露营小助手」查看');

  return lines.join('\n');
}
