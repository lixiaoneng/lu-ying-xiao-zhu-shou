import type { CampingPlan } from './types';

const STORAGE_KEY = 'camping-plans-v1';
const ACTIVE_KEY = 'camping-active-plan-id';

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function loadPlans(): CampingPlan[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CampingPlan[]) : [];
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
    aaMode: p.aaMode ?? 'family',
    menuItems: p.menuItems ?? [],
    people: p.people ?? [],
    families: p.families ?? [],
    supplies: p.supplies ?? [],
    expenses: p.expenses ?? [],
  };
}

export function loadPlan(id: string): CampingPlan | null {
  const p = loadPlans().find(p => p.id === id) ?? null;
  return p ? migratePlan(p) : null;
}

export function savePlan(plan: CampingPlan): void {
  const plans = loadPlans();
  const idx = plans.findIndex(p => p.id === plan.id);
  const updated = { ...plan, updatedAt: new Date().toISOString() };
  if (idx >= 0) {
    plans[idx] = updated;
  } else {
    plans.push(updated);
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
    plan.aaMode = plan.aaMode ?? 'family';
    plan.menuItems = plan.menuItems ?? [];
    plan.createdAt = new Date().toISOString();
    plan.updatedAt = new Date().toISOString();
    return plan;
  } catch {
    return null;
  }
}
