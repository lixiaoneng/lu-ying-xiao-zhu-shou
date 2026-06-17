// AI 助手 Demo · 智能检查（规则版）
//
// 纯函数：根据 CampingPlan 派生 CheckFinding[]
// - 只读 plan，不修改
// - 不调用 updatePlan / localStorage / Supabase
// - 未来接入真实模型 API 时，runChecklist 仍可作为兜底/对照

import type { CampingPlan, Supply, Expense } from '../../types';
import type { CheckFinding } from './types';

const SAFETY_CATEGORIES = ['安全急救'];
const LIGHTING_CATEGORY = '照明系统';

function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr + 'T00:00:00').getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today.getTime()) / 86400000);
}

function tripDayCount(plan: CampingPlan): number {
  if (!plan.date) return 0;
  if (!plan.endDate) return 1;
  const start = new Date(plan.date + 'T00:00:00').getTime();
  const end = new Date(plan.endDate + 'T00:00:00').getTime();
  if (end < start) return 1;
  return Math.round((end - start) / 86400000) + 1;
}

function validFamilyIds(plan: CampingPlan): Set<string> {
  return new Set(plan.families.map(f => f.id));
}

function hasCategory(supplies: Supply[], category: string): boolean {
  return supplies.some(s => (s.system_category || s.category) === category);
}

export function runChecklist(plan: CampingPlan): CheckFinding[] {
  const findings: CheckFinding[] = [];
  const familyIds = validFamilyIds(plan);
  const days = daysUntil(plan.date);
  const tripDays = tripDayCount(plan);

  // ── 日期 ──
  if (!plan.date) {
    findings.push({
      id: 'date-missing',
      severity: 'missing',
      category: '日期',
      title: '还没填出行日期',
      hint: '请在「概况」页补上日期，方便大家提前安排。',
    });
  } else if (plan.endDate && plan.endDate < plan.date) {
    findings.push({
      id: 'date-range-invalid',
      severity: 'missing',
      category: '日期',
      title: '结束日期早于开始日期',
      hint: '请在「概况」页修正日期范围。',
    });
  } else if (days !== null && days >= 0 && days <= 3) {
    // 出行 ≤ 3 天 + 仍有未备齐物资 — 由"物资-备齐"规则产出更具体的提示
  }

  // ── 人员 ──
  if (plan.families.length === 0 && plan.people.length === 0) {
    findings.push({
      id: 'people-empty',
      severity: 'missing',
      category: '人员',
      title: '还没添加任何参与者',
      hint: '请先在「概况」页添加家庭/小组或独立参与者。',
    });
  } else {
    plan.families.forEach(f => {
      const memberCount = plan.people.filter(p => p.familyId === f.id).length;
      if (memberCount === 0) {
        findings.push({
          id: `people-family-empty-${f.id}`,
          severity: 'warn',
          category: '人员',
          title: `「${f.name}」还没有成员`,
          hint: '可补充成员，或将这一组改为独立参与者。',
          relatedIds: [f.id],
        });
      }
    });
  }

  // ── 物资 / 公共 ──
  const publicFood = plan.supplies.filter(s => s.type === 'food');
  const publicGear = plan.supplies.filter(s => s.type === 'gear');

  publicFood.forEach(s => {
    if (!s.assigneeId || !familyIds.has(s.assigneeId)) {
      findings.push({
        id: `supply-food-noassignee-${s.id}`,
        severity: 'warn',
        category: '物资',
        title: `公共食材「${s.name}」没指定负责方`,
        hint: '公共食材需要明确谁带，否则出发前可能没人准备。',
        relatedIds: [s.id],
      });
    }
  });

  publicGear.forEach(s => {
    if (!s.assigneeId || !familyIds.has(s.assigneeId)) {
      findings.push({
        id: `supply-gear-noassignee-${s.id}`,
        severity: 'warn',
        category: '物资',
        title: `公共物资「${s.name}」没指定负责方`,
        hint: '公共物资需要明确谁携带，避免到现场才发现漏带。',
        relatedIds: [s.id],
      });
    }
  });

  // ── 物资 / 各家 ──
  plan.families.forEach(f => {
    const hasAny = plan.supplies.some(s => s.assigneeId === f.id);
    if (!hasAny && plan.supplies.length > 0) {
      findings.push({
        id: `supply-family-none-${f.id}`,
        severity: 'info',
        category: '物资',
        title: `「${f.name}」还没有携带任何物资`,
        hint: '至少确认一下是否带帐篷/睡袋等睡眠装备。',
        relatedIds: [f.id],
      });
    }
  });

  // ── 物资 / 备齐 ──
  const notReady = plan.supplies.filter(s => !s.isReady);
  if (notReady.length > 0 && days !== null && days >= 0 && days <= 3) {
    findings.push({
      id: 'supply-readiness-near-trip',
      severity: 'warn',
      category: '物资',
      title: `距离出发 ≤ 3 天，还有 ${notReady.length} 项物资未备齐`,
      hint: '建议在「物资」页对未备齐项目逐项确认。',
      relatedIds: notReady.map(s => s.id),
    });
  }

  // ── 物资 / 安全 ──
  if (plan.supplies.length > 0 && !hasCategory(plan.supplies, SAFETY_CATEGORIES[0])) {
    findings.push({
      id: 'supply-safety-missing',
      severity: 'warn',
      category: '安全',
      title: '还没看到急救类物资',
      hint: '建议带上基础急救包（创可贴、碘伏、绷带等）。',
    });
  }

  // ── 物资 / 照明 ──
  if (tripDays >= 1 && plan.supplies.length > 0 && !hasCategory(plan.supplies, LIGHTING_CATEGORY)) {
    findings.push({
      id: 'supply-lighting-missing',
      severity: 'info',
      category: '安全',
      title: '没看到照明类物资',
      hint: '夜间活动建议带营灯/头灯/手电。',
    });
  }

  // ── 菜单 ──
  if (plan.menuItems.length === 0 && plan.date) {
    findings.push({
      id: 'menu-empty',
      severity: 'warn',
      category: '菜单',
      title: '还没有安排菜单',
      hint: '可以按「日期 + 餐次」简单排一下，方便大家提前知道吃什么。',
    });
  } else {
    const expectedMeals = tripDays * 3;
    if (tripDays >= 2 && plan.menuItems.length < expectedMeals) {
      findings.push({
        id: 'menu-coverage',
        severity: 'info',
        category: '菜单',
        title: `菜单覆盖偏少：当前 ${plan.menuItems.length} 餐，预估需要 ${expectedMeals} 餐`,
        hint: '天数较多的活动建议提前安排每餐。',
      });
    }
    const noResponsible = plan.menuItems.filter(m => !m.responsible);
    if (noResponsible.length > 0) {
      findings.push({
        id: 'menu-no-responsible',
        severity: 'info',
        category: '菜单',
        title: `有 ${noResponsible.length} 项菜单没指定负责人`,
        hint: '出发前最好确认每餐主厨，避免现场临时抓人。',
        relatedIds: noResponsible.map(m => m.id),
      });
    }
  }

  // ── 费用 ──
  if (plan.expenses.length === 0 && plan.families.length > 0) {
    findings.push({
      id: 'expense-empty',
      severity: 'info',
      category: '费用',
      title: '还没记录任何花费',
      hint: '活动结束后再补容易遗漏，建议边花边记。',
    });
  } else {
    const aaExpenses = plan.expenses.filter((e: Expense) => e.includeInAA);
    const orphanPayer = plan.expenses.filter(
      e => !familyIds.has(e.payerFamilyId)
    );
    if (orphanPayer.length > 0) {
      findings.push({
        id: 'expense-orphan-payer',
        severity: 'warn',
        category: '费用',
        title: `有 ${orphanPayer.length} 笔花费的付款方已不存在`,
        hint: '请到「花费」页修正或删除。',
        relatedIds: orphanPayer.map(e => e.id),
      });
    }
    if (aaExpenses.length > 0) {
      const partial = aaExpenses.filter(
        e => e.aaScope && e.aaScope !== 'all'
      );
      if (partial.length > aaExpenses.length / 2) {
        findings.push({
          id: 'expense-partial-aa-majority',
          severity: 'info',
          category: '费用',
          title: `部分分摊的花费偏多（${partial.length}/${aaExpenses.length}）`,
          hint: '建议和成员再口头确认一次，避免结算时产生误会。',
        });
      }
    }
  }

  // ── 排序：missing > warn > info，组内保持原顺序 ──
  const order: Record<string, number> = { missing: 0, warn: 1, info: 2 };
  return findings.sort((a, b) => order[a.severity] - order[b.severity]);
}
