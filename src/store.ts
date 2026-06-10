import type { CampingPlan } from './types';

const STORAGE_KEY = 'camping-plans-v1';
const ACTIVE_KEY = 'camping-active-plan-id';

export function generateId(): string {
  return crypto.randomUUID();
}

export function loadPlans(): CampingPlan[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CampingPlan[]).map(migratePlan) : [];
  } catch {
    return [];
  }
}

export function savePlans(plans: CampingPlan[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
}

// Ensure a plan from any source (localStorage or cloud) has all required fields
export function migratePlan(p: CampingPlan): CampingPlan {
  return {
    ...p,
    aaMode: 'person', // AA 始终按人头；历史数据中的 'family' 值不再使用
    endDate: p.endDate ?? '',
    menuItems: p.menuItems ?? [],
    people: p.people ?? [],
    families: (p.families ?? []).map(f => ({ isSolo: false, ...f })),
    // Ensure every supply has needsAA (old gear items may lack it → default false)
    supplies: (p.supplies ?? []).map(s => ({ ...s, needsAA: s.needsAA ?? false })),
    // aaScope: undefined/'all' = 全员（向下兼容旧数据，无此字段时自动视为全员）
    expenses: (p.expenses ?? []).map(e => ({ ...e, aaScope: e.aaScope ?? 'all' })),
  };
}

// Deep-clone a plan as a new independent copy (no shared references, no roomCode)
export function duplicatePlan(source: CampingPlan): CampingPlan {
  // JSON round-trip guarantees a fully independent deep copy
  const clone = JSON.parse(JSON.stringify(source)) as CampingPlan;
  const now = new Date().toISOString();

  // New identity
  clone.id = generateId();
  clone.name = `${source.name}（副本）`;
  clone.createdAt = now;
  clone.updatedAt = now;

  // Strip cloud sync state
  delete clone.roomCode;

  // Re-generate ALL item IDs and remap cross-references
  // so the two plans are 100% independent at the data level
  const familyIdMap: Record<string, string> = {};
  clone.families = clone.families.map(f => {
    const newId = generateId();
    familyIdMap[f.id] = newId;
    return { ...f, id: newId };
  });

  clone.people = clone.people.map(p => ({
    ...p,
    id: generateId(),
    familyId: familyIdMap[p.familyId] ?? p.familyId,
  }));

  clone.supplies = clone.supplies.map(s => ({
    ...s,
    id: generateId(),
    assigneeId: familyIdMap[s.assigneeId] ?? s.assigneeId,
  }));

  clone.expenses = clone.expenses.map(e => ({
    ...e,
    id: generateId(),
    payerFamilyId: familyIdMap[e.payerFamilyId] ?? e.payerFamilyId,
    // aaScope 为 family id 列表时必须同步重映射，否则副本的部分 AA 结算会失衡
    aaScope: Array.isArray(e.aaScope)
      ? e.aaScope.map(fid => familyIdMap[fid] ?? fid)
      : e.aaScope,
  }));

  clone.menuItems = clone.menuItems.map(m => ({
    ...m,
    id: generateId(),
  }));

  return clone;
}

export function loadPlan(id: string): CampingPlan | null {
  const p = loadPlans().find(p => p.id === id) ?? null;
  return p ? migratePlan(p) : null;
}

export function savePlan(plan: CampingPlan): void {
  const plans = loadPlans();
  const idx = plans.findIndex(p => p.id === plan.id);
  if (idx >= 0) {
    plans[idx] = plan;
  } else {
    plans.push(plan);
  }
  savePlans(plans);
}

export function deletePlan(id: string): void {
  savePlans(loadPlans().filter(p => p.id !== id));
}

export function getActivePlanId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

export function setActivePlanId(id: string | null): void {
  if (id) {
    localStorage.setItem(ACTIVE_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_KEY);
  }
}

export function exportPlanAsJson(plan: CampingPlan): void {
  const json = JSON.stringify(plan, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${plan.name}-露营计划.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importPlanFromJson(json: string): CampingPlan | null {
  try {
    const plan = JSON.parse(json) as CampingPlan;
    if (!plan.id || !plan.name) return null;
    plan.id = generateId();
    // 导入的是独立副本：必须剥离 roomCode，否则首次同步会以新 id + 旧房间码
    // upsert 出第二行记录，导致该房间码上的 .single() 查询对所有人失效
    delete plan.roomCode;
    plan.createdAt = new Date().toISOString();
    plan.updatedAt = new Date().toISOString();
    // 字段兼容统一走 migratePlan（唯一入口），不再手工补丁
    return migratePlan(plan);
  } catch {
    return null;
  }
}
