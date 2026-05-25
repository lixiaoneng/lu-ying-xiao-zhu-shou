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

export function calculateSettlement(plan: CampingPlan): Settlement {
  const { families, people, expenses, aaMode = 'family' } = plan;

  const aaExpenses = expenses.filter(e => e.includeInAA);
  const totalAmount = aaExpenses.reduce((sum, e) => sum + e.amount, 0);

  // paid per family
  const paidByFamily: Record<string, number> = {};
  families.forEach(f => { paidByFamily[f.id] = 0; });
  aaExpenses.forEach(e => {
    if (e.payerFamilyId in paidByFamily) {
      paidByFamily[e.payerFamilyId] += e.amount;
    }
  });

  // share per family depends on mode
  let perUnit: number;
  let totalUnits: number;
  const familyShareMap: Record<string, number> = {};

  if (aaMode === 'person') {
    const totalPeople = people.length;
    totalUnits = totalPeople;
    perUnit = totalPeople > 0 ? totalAmount / totalPeople : 0;
    families.forEach(f => {
      const count = people.filter(p => p.familyId === f.id).length;
      familyShareMap[f.id] = count * perUnit;
    });
  } else {
    totalUnits = families.length;
    perUnit = families.length > 0 ? totalAmount / families.length : 0;
    families.forEach(f => { familyShareMap[f.id] = perUnit; });
  }

  const familyBalances: FamilyBalance[] = families.map(f => {
    const share = familyShareMap[f.id] ?? 0;
    const paid = paidByFamily[f.id] ?? 0;
    return {
      familyId: f.id,
      familyName: f.name,
      memberCount: people.filter(p => p.familyId === f.id).length,
      paid,
      share,
      balance: paid - share,
    };
  });

  // minimum transactions
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
