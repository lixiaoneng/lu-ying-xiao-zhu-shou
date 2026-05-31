export interface Person {
  id: string;
  name: string;
  familyId: string;
}

export interface Family {
  id: string;
  name: string;
  isSolo?: boolean; // true = auto-created for a single participant; name mirrors their person name
}

export type SupplyType = 'personal' | 'food' | 'gear';
// 'family' is kept as tombstone for backward-compat with stored data; AA always calculated per-person
export type AAMode = 'family' | 'person';

export const SUPPLY_TYPE_LABELS: Record<SupplyType, string> = {
  personal: '各家自带',
  food: '公共食材',
  gear: '公共物资',
};

export const SUPPLY_TYPE_ICONS: Record<SupplyType, string> = {
  personal: '🏕️',
  food: '🍖',
  gear: '⛺',
};

export const SUPPLY_CATEGORIES: Record<SupplyType, string[]> = {
  personal: ['睡眠装备', '衣物', '个人卫生', '其他'],
  food: ['肉类', '蔬菜', '零食', '饮品', '调料', '其他'],
  gear: ['炊具', '照明', '桌椅', '娱乐', '急救', '其他'],
};

export interface Supply {
  id: string;
  name: string;
  category: string;
  assigneeId: string;
  quantity: string;
  isReady: boolean;
  needsAA: boolean;
  type: SupplyType;
  price?: number;
}

export interface Expense {
  id: string;
  payerFamilyId: string;
  item: string;
  amount: number;
  note: string;
  includeInAA: boolean;
  // 分摊范围：undefined/'all' = 全员（默认）；string[] = 指定 family id 列表
  aaScope?: 'all' | string[];
}

export interface MenuItem {
  id: string;
  time: string;       // e.g. 周六、周日、Day 1
  meal: string;       // e.g. 早餐、午餐、晚餐
  menu: string;       // e.g. 番茄微辣火锅
  responsible: string; // free text — family or person name
}

export interface CampingPlan {
  id: string;
  name: string;
  date: string;
  location: string;
  aaMode: AAMode; // 'family' | 'person'
  roomCode?: string; // set when plan is a cloud plan
  people: Person[];
  families: Family[];
  supplies: Supply[];
  expenses: Expense[];
  menuItems: MenuItem[];
  createdAt: string;
  updatedAt: string;
}

export interface FamilyBalance {
  familyId: string;
  familyName: string;
  memberCount: number;
  paid: number;
  share: number;
  balance: number;
}

export interface Transaction {
  fromFamilyId: string;
  fromFamilyName: string;
  toFamilyId: string;
  toFamilyName: string;
  amount: number;
}

export interface Settlement {
  totalAmount: number;
  aaMode: AAMode;
  perUnit: number;       // 每人份额（全员AA时有意义；部分AA时仅供参考）
  totalUnits: number;    // 参与人数
  familyBalances: FamilyBalance[];
  transactions: Transaction[];
}

// 判断某笔费用的分摊范围是否包含某 family
export function expenseIncludesFamily(expense: Expense, familyId: string): boolean {
  const scope = expense.aaScope;
  if (!scope || scope === 'all') return true;
  return (scope as string[]).includes(familyId);
}

export function calculateSettlement(plan: CampingPlan): Settlement {
  const { families, people, expenses } = plan;

  const aaExpenses = expenses.filter(e => e.includeInAA);
  const totalAmount = aaExpenses.reduce((sum, e) => sum + e.amount, 0);

  // 每家人数。fallback = 1：兼容旧计划（只填了家庭、未填人员），
  // 保证这类旧数据在纯按人头模式下仍能正常分摊。
  const memberCountMap: Record<string, number> = {};
  families.forEach(f => {
    const actual = people.filter(p => p.familyId === f.id).length;
    memberCountMap[f.id] = actual > 0 ? actual : 1;
  });

  // 逐笔费用分配
  const paidByFamily: Record<string, number> = {};
  const shareByFamily: Record<string, number> = {};
  families.forEach(f => { paidByFamily[f.id] = 0; shareByFamily[f.id] = 0; });

  aaExpenses.forEach(e => {
    // 累计垫付
    if (e.payerFamilyId in paidByFamily) {
      paidByFamily[e.payerFamilyId] += e.amount;
    }

    // 参与本笔分摊的家庭（由 aaScope 决定）
    const scopeFamilies = families.filter(f => expenseIncludesFamily(e, f.id));
    if (scopeFamilies.length === 0) return;

    // 参与人数（始终按人头）
    const totalPeopleInScope = scopeFamilies.reduce(
      (sum, f) => sum + (memberCountMap[f.id] ?? 1), 0
    );
    if (totalPeopleInScope === 0) return;

    // 按人数比例分配给每家
    scopeFamilies.forEach(f => {
      const units = memberCountMap[f.id] ?? 1;
      shareByFamily[f.id] = (shareByFamily[f.id] ?? 0) + (e.amount * units) / totalPeopleInScope;
    });
  });

  const familyBalances: FamilyBalance[] = families.map(f => {
    const share = shareByFamily[f.id] ?? 0;
    const paid = paidByFamily[f.id] ?? 0;
    return {
      familyId: f.id,
      familyName: f.name,
      memberCount: people.filter(p => p.familyId === f.id).length, // 展示用真实人数
      paid,
      share,
      balance: paid - share,
    };
  });

  // perUnit = 每人均摊参考值（全员AA时准确；部分AA时为加权平均参考）
  const totalUnits = Object.values(memberCountMap).reduce((s, n) => s + n, 0);
  const perUnit = totalUnits > 0 ? totalAmount / totalUnits : 0;

  // 最小化转账
  const creditors = familyBalances
    .filter(b => b.balance > 0.01)
    .map(b => ({ ...b }))
    .sort((a, b) => b.balance - a.balance);

  const debtors = familyBalances
    .filter(b => b.balance < -0.01)
    .map(b => ({ ...b }))
    .sort((a, b) => a.balance - b.balance);

  const transactions: Transaction[] = [];
  let ci = 0, di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const c = creditors[ci];
    const d = debtors[di];
    const amount = Math.min(c.balance, -d.balance);
    if (amount > 0.01) {
      transactions.push({
        fromFamilyId: d.familyId,
        fromFamilyName: d.familyName,
        toFamilyId: c.familyId,
        toFamilyName: c.familyName,
        amount: Math.round(amount * 100) / 100,
      });
    }
    c.balance -= amount;
    d.balance += amount;
    if (c.balance < 0.01) ci++;
    if (d.balance > -0.01) di++;
  }

  return { totalAmount, aaMode: 'person', perUnit, totalUnits, familyBalances, transactions };
}
