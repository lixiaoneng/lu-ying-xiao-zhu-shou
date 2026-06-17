// AI 助手 Demo · 内部类型
//
// 设计原则：
// 1. 类型只在本目录内使用，不导出到 src/types.ts，不影响 CampingPlan 字段
// 2. CheckFinding / PlanSummary / ShareCopy 都是派生数据，纯函数计算得到
// 3. 所有 AI 函数不写 plan，不调用 updatePlan / localStorage / Supabase

export type CheckSeverity = 'info' | 'warn' | 'missing';

/**
 * 单条检查结果。
 * - severity: missing=强烈建议补，warn=建议确认，info=提示信息
 * - category: 物资 / 菜单 / 费用 / 人员 / 日期 / 安全
 * - title: 简短结论
 * - hint: 一句话操作建议（不替用户改数据）
 * - relatedIds?: 关联的 family / supply / expense / menuItem id，仅用于 UI 联动，本期 Demo 不消费
 */
export interface CheckFinding {
  id: string;
  severity: CheckSeverity;
  category: '物资' | '菜单' | '费用' | '人员' | '日期' | '安全';
  title: string;
  hint: string;
  relatedIds?: string[];
}

/**
 * 计划体检结果。
 * - overall: 0-100 整数
 * - stats: 每项体检的状态（good/warn/missing）
 * - highlights: 1-3 条短句，给组织者一眼看
 */
export interface PlanSummary {
  overall: number;
  stats: PlanSummaryStat[];
  highlights: string[];
  pendingItems: string[];
}

export type StatStatus = 'good' | 'warn' | 'missing';

export interface PlanSummaryStat {
  label: string;
  value: string;
  status: StatStatus;
  weight: number; // 0-100，用于解释分值
}
