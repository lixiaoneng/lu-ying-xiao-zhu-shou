// AI 助手 Demo · 计划体检
//
// 纯函数：根据 CampingPlan 派生 PlanSummary
// - 不调用 calculateSettlement（避免依赖 AA 内部细节、未来若调整 AA 公式时不需要改这里）
// - 不写 plan，不调用 updatePlan

import type { CampingPlan, Expense } from '../../types';
import type { PlanSummary, PlanSummaryStat, StatStatus } from './types';
import { runChecklist } from './checklist';

const WEIGHTS = {
  basicInfo: 15,
  participants: 10,
  suppliesReady: 30,
  menuCoverage: 20,
  expenses: 15,
  safety: 10,
};

function fmtDate(d: string): string {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
}

function tripDays(plan: CampingPlan): number {
  if (!plan.date) return 0;
  if (!plan.endDate) return 1;
  const s = new Date(plan.date + 'T00:00:00').getTime();
  const e = new Date(plan.endDate + 'T00:00:00').getTime();
  if (e < s) return 1;
  return Math.round((e - s) / 86400000) + 1;
}

export function runSummary(plan: CampingPlan): PlanSummary {
  const stats: PlanSummaryStat[] = [];
  const days = tripDays(plan);
  const totalSupplies = plan.supplies.length;
  const readySupplies = plan.supplies.filter(s => s.isReady).length;

  // 1. 基本信息
  const hasName = !!plan.name.trim();
  const hasDate = !!plan.date;
  const hasLocation = !!plan.location.trim();
  const basicScore =
    (hasName ? 1 : 0) + (hasDate ? 1 : 0) + (hasLocation ? 1 : 0);
  const basicStatus: StatStatus =
    basicScore === 3 ? 'good' : basicScore >= 1 ? 'warn' : 'missing';
  const basicValue =
    basicScore === 3
      ? `${plan.date ? fmtDate(plan.date) : ''}${plan.location ? ' · ' + plan.location : ''}`
      : `缺 ${3 - basicScore} 项`;
  stats.push({
    label: '基本信息',
    value: basicValue,
    status: basicStatus,
    weight: WEIGHTS.basicInfo,
  });

  // 2. 参与者
  const hasParticipants = plan.families.length > 0 && plan.people.length > 0;
  const participantStatus: StatStatus = hasParticipants
    ? plan.people.length >= 2
      ? 'good'
      : 'warn'
    : 'missing';
  stats.push({
    label: '参与者',
    value: hasParticipants
      ? `${plan.families.length} 个家庭 · ${plan.people.length} 人`
      : '未添加',
    status: participantStatus,
    weight: WEIGHTS.participants,
  });

  // 3. 物资备齐
  let supplyStatus: StatStatus;
  let supplyValue: string;
  if (totalSupplies === 0) {
    supplyStatus = 'missing';
    supplyValue = '暂无物资';
  } else if (readySupplies === totalSupplies) {
    supplyStatus = 'good';
    supplyValue = `${readySupplies}/${totalSupplies} 已备齐`;
  } else if (readySupplies / totalSupplies >= 0.5) {
    supplyStatus = 'warn';
    supplyValue = `${readySupplies}/${totalSupplies} 已备齐`;
  } else {
    supplyStatus = 'missing';
    supplyValue = `${readySupplies}/${totalSupplies} 已备齐`;
  }
  stats.push({
    label: '物资',
    value: supplyValue,
    status: supplyStatus,
    weight: WEIGHTS.suppliesReady,
  });

  // 4. 菜单覆盖
  const expectedMeals = days * 3;
  let menuStatus: StatStatus;
  let menuValue: string;
  if (plan.menuItems.length === 0) {
    menuStatus = days > 0 ? 'missing' : 'warn';
    menuValue = '未安排';
  } else if (days === 0) {
    menuStatus = 'good';
    menuValue = `${plan.menuItems.length} 项`;
  } else if (plan.menuItems.length >= expectedMeals) {
    menuStatus = 'good';
    menuValue = `${plan.menuItems.length}/${expectedMeals} 餐`;
  } else {
    menuStatus = 'warn';
    menuValue = `${plan.menuItems.length}/${expectedMeals} 餐`;
  }
  stats.push({
    label: '菜单',
    value: menuValue,
    status: menuStatus,
    weight: WEIGHTS.menuCoverage,
  });

  // 5. 费用
  const aaExpenses = plan.expenses.filter((e: Expense) => e.includeInAA);
  const hasExpenseForAll =
    plan.families.length > 0 &&
    plan.families.every(f =>
      plan.expenses.some(e => e.payerFamilyId === f.id)
    );
  let expenseStatus: StatStatus;
  let expenseValue: string;
  if (plan.expenses.length === 0) {
    expenseStatus = plan.families.length > 0 ? 'warn' : 'missing';
    expenseValue = '无记录';
  } else if (hasExpenseForAll) {
    expenseStatus = 'good';
    expenseValue = `${plan.expenses.length} 笔（AA ${aaExpenses.length}）`;
  } else {
    expenseStatus = 'warn';
    expenseValue = `${plan.expenses.length} 笔`;
  }
  stats.push({
    label: '费用',
    value: expenseValue,
    status: expenseStatus,
    weight: WEIGHTS.expenses,
  });

  // 6. 安全
  const hasSafety = plan.supplies.some(
    s => (s.system_category || s.category) === '安全急救'
  );
  const hasLighting = plan.supplies.some(
    s => (s.system_category || s.category) === '照明系统'
  );
  const safetyScore = (hasSafety ? 1 : 0) + (hasLighting ? 1 : 0);
  const safetyStatus: StatStatus =
    safetyScore === 2 ? 'good' : safetyScore === 1 ? 'warn' : 'missing';
  const safetyValue =
    safetyScore === 0
      ? '未带急救/照明'
      : safetyScore === 2
      ? '急救 + 照明'
      : hasSafety
      ? '已带急救'
      : '已带照明';
  stats.push({
    label: '安全',
    value: safetyValue,
    status: safetyStatus,
    weight: WEIGHTS.safety,
  });

  // ── 计算总分 ──
  const weightMap: Record<StatStatus, number> = {
    good: 1,
    warn: 0.5,
    missing: 0,
  };
  const totalWeight = stats.reduce((s, x) => s + x.weight, 0);
  const earned = stats.reduce(
    (s, x) => s + x.weight * weightMap[x.status],
    0
  );
  const overall = totalWeight > 0
    ? Math.round((earned / totalWeight) * 100)
    : 0;

  // ── 高亮 1-3 句 ──
  const highlights: string[] = [];
  if (overall >= 90) {
    highlights.push('计划看起来很完整，可以发群里了。');
  } else if (overall >= 60) {
    highlights.push('整体不错，还有几处可以再确认一下。');
  } else if (overall > 0) {
    highlights.push('计划还在搭建中，先补几项关键信息。');
  } else {
    highlights.push('几乎还是空白，先从「概况」开始添加吧。');
  }
  if (totalSupplies > 0 && readySupplies < totalSupplies) {
    highlights.push(
      `还有 ${totalSupplies - readySupplies} 项物资没备齐，建议提前过一遍。`
    );
  }
  if (plan.menuItems.length === 0 && plan.date) {
    highlights.push('可以按日期 + 餐次快速排一下菜单。');
  }

  // ── 待确认事项（来自 checklist，按需取前 5 条 missing/warn）──
  const findings = runChecklist(plan);
  const pendingItems = findings
    .filter(f => f.severity !== 'info')
    .slice(0, 5)
    .map(f => `${f.title} — ${f.hint}`);

  return { overall, stats, highlights, pendingItems };
}
