import type { CampingPlan } from './types';
import { generateId } from './store';

export function createSamplePlan(): CampingPlan {
  const now = new Date().toISOString();

  const fXuan = generateId();
  const fNan = generateId();
  const fYang = generateId();

  return {
    id: generateId(),
    name: '初夏山野露营',
    date: '2026-06-07',
    location: '北京延庆松山营地',
    aaMode: 'family' as const,
    families: [
      { id: fXuan, name: '煊哥家' },
      { id: fNan, name: '楠哥家' },
      { id: fYang, name: '杨晓家' },
    ],
    people: [
      { id: generateId(), name: '煊哥', familyId: fXuan },
      { id: generateId(), name: '晓萌', familyId: fXuan },
      { id: generateId(), name: '楠哥', familyId: fNan },
      { id: generateId(), name: '沙沙', familyId: fNan },
      { id: generateId(), name: '杨晓', familyId: fYang },
      { id: generateId(), name: '易', familyId: fYang },
    ],
    supplies: [
      // 各家自带
      { id: generateId(), name: '四季帐篷', category: '睡眠装备', assigneeId: fXuan, quantity: '1顶', isReady: true, needsAA: false, type: 'personal' },
      { id: generateId(), name: '双人睡袋', category: '睡眠装备', assigneeId: fNan, quantity: '2个', isReady: true, needsAA: false, type: 'personal' },
      { id: generateId(), name: '防潮垫', category: '睡眠装备', assigneeId: fYang, quantity: '2张', isReady: false, needsAA: false, type: 'personal' },
      { id: generateId(), name: '防晒霜', category: '个人卫生', assigneeId: fXuan, quantity: '各自带', isReady: false, needsAA: false, type: 'personal' },
      { id: generateId(), name: '雨衣', category: '衣物', assigneeId: fNan, quantity: '各自带', isReady: false, needsAA: false, type: 'personal' },
      // 公共食材
      { id: generateId(), name: '牛肋条', category: '肉类', assigneeId: fXuan, quantity: '2斤', isReady: true, needsAA: true, type: 'food' },
      { id: generateId(), name: '羊肉串', category: '肉类', assigneeId: fNan, quantity: '3斤', isReady: false, needsAA: true, type: 'food' },
      { id: generateId(), name: '新鲜蔬菜', category: '蔬菜', assigneeId: fYang, quantity: '若干', isReady: false, needsAA: true, type: 'food' },
      { id: generateId(), name: '精酿啤酒', category: '饮品', assigneeId: fXuan, quantity: '24瓶', isReady: true, needsAA: true, type: 'food' },
      { id: generateId(), name: '矿泉水', category: '饮品', assigneeId: fNan, quantity: '2箱', isReady: false, needsAA: true, type: 'food' },
      { id: generateId(), name: '烧烤调料', category: '调料', assigneeId: fYang, quantity: '一套', isReady: false, needsAA: true, type: 'food' },
      // 公共物资
      { id: generateId(), name: '烧烤炉', category: '炊具', assigneeId: fXuan, quantity: '1套', isReady: true, needsAA: false, type: 'gear' },
      { id: generateId(), name: '折叠桌椅', category: '桌椅', assigneeId: fNan, quantity: '1套', isReady: true, needsAA: false, type: 'gear' },
      { id: generateId(), name: '营地灯', category: '照明', assigneeId: fYang, quantity: '2盏', isReady: false, needsAA: false, type: 'gear' },
      { id: generateId(), name: '蓝牙音箱', category: '娱乐', assigneeId: fXuan, quantity: '1个', isReady: true, needsAA: false, type: 'gear' },
    ],
    expenses: [
      { id: generateId(), payerFamilyId: fXuan, item: '营地预订费', amount: 300, note: '提前支付', includeInAA: true },
      { id: generateId(), payerFamilyId: fXuan, item: '精酿啤酒', amount: 168, note: '超市采购', includeInAA: true },
      { id: generateId(), payerFamilyId: fNan, item: '羊肉串', amount: 210, note: '清真市场', includeInAA: true },
      { id: generateId(), payerFamilyId: fNan, item: '矿泉水', amount: 48, note: '', includeInAA: true },
      { id: generateId(), payerFamilyId: fYang, item: '新鲜蔬菜', amount: 86, note: '早市采购', includeInAA: true },
      { id: generateId(), payerFamilyId: fYang, item: '木炭', amount: 45, note: '', includeInAA: true },
    ],
    createdAt: now,
    menuItems: [
      { id: generateId(), time: '周六', meal: '午餐',   menu: '番茄微辣火锅',         responsible: '煊哥家' },
      { id: generateId(), time: '周六', meal: '晚餐',   menu: '烤肉 + 沙拉 / 凉拌菜', responsible: '楠哥家' },
      { id: generateId(), time: '周六', meal: '晚间饮品', menu: '小啤啤',              responsible: '煊哥' },
      { id: generateId(), time: '周日', meal: '早餐',   menu: '简餐',                 responsible: '杨晓&易' },
      { id: generateId(), time: '周日', meal: '午餐',   menu: '炒菜炖菜',             responsible: '煊哥' },
    ],
    updatedAt: now,
  };
}
