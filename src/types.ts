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
  perUnit: number;       // 按家庭时=每家份额，按人头时=每人份额
  totalUnits: number;    // 按家庭时=家庭数，按人头时=总人数
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
  const { families, people, expenses, aaMode = 'family' } = plan;

  const aaExpenses = expenses.filter(e => e.includeInAA);
  const totalAmount = aaExpenses.reduce((sum, e) => sum + e.amount, 0);

  // 每方的人数（按人头模式用）
  const memberCountMap: Record<string, number> = {};
  families.forEach(f => {
    memberCountMap[f.id] = people.filter(p => p.familyId === f.id).length;
  });

  // 逐笔费用分配：paid 和 share 分开累计
  const paidByFamily: Record<string, number> = {};
  const shareByFamily: Record<string, number> = {};
  families.forEach(f => { paidByFamily[f.id] = 0; shareByFamily[f.id] = 0; });

  aaExpenses.forEach(e => {
    // 累计垫付
    if (e.payerFamilyId in paidByFamily) {
      paidByFamily[e.payerFamilyId] += e.amount;
    }

    // 计算本笔费用参与分摊的家庭
    const scopeFamilies = families.filter(f => expenseIncludesFamily(e, f.id));
    if (scopeFamilies.length === 0) return;

    // 按 aaMode 计算本笔费用的分摊单位数（人数或家庭数）
    let totalUnitsForExpense: number;
    if (aaMode === 'person') {
      totalUnitsForExpense = scopeFamilies.reduce((sum, f) => sum + (memberCountMap[f.id] ?? 0), 0);
    } else {
      totalUnitsForExpense = scopeFamilies.length;
    }
    if (totalUnitsForExpense === 0) return;

    // 为每个参与家庭累加应摊金额
    scopeFamilies.forEach(f => {
      const units = aaMode === 'person' ? (memberCountMap[f.id] ?? 0) : 1;
      shareByFamily[f.id] = (shareByFamily[f.id] ?? 0) + (e.amount * units) / totalUnitsForExpense;
    });
  });

  const familyBalances: FamilyBalance[] = families.map(f => {
    const share = shareByFamily[f.id] ?? 0;
    const paid = paidByFamily[f.id] ?? 0;
    return {
      familyId: f.id,
      familyName: f.name,
      memberCount: memberCountMap[f.id] ?? 0,
      paid,
      share,
      balance: paid - share,
    };
  });

  // perUnit / totalUnits 保留为全员全额的参考值（用于 UI 展示）
  const totalUnits = aaMode === 'person' ? people.length : families.length;
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

  return { totalAmount, aaMode, perUnit, totalUnits, familyBalances, transactions };
}
