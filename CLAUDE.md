# 露营小助手 · 开发规范

> 本文件是 Claude Code 的项目级规则，每次开发前自动生效。

---

## ⚠️ 生产安全铁律（最高优先级）

**这个项目已有真实用户在使用。以下规则不得违反：**

1. **绝对不允许直接 push 到 `main` 分支**
2. **绝对不允许在未经用户明确说"上线"时 merge dev → main**
3. **绝对不允许破坏已有数据结构**（localStorage / Supabase schema）
4. **绝对不允许删除或重命名现有字段**（只能新增可选字段）
5. **所有新字段必须在 `migratePlan()` 中做向下兼容处理**（`?? 默认值`）
6. **不允许未经说明修改 Supabase 表结构或 RLS 策略**

---

## 分支工作流

```
main   ← 生产环境，真实用户使用，只接受 PR merge
  ↑
dev    ← 日常开发分支，所有改动默认在此进行
```

### 标准开发流程

```bash
# 开始新功能前，确认在 dev 分支
git checkout dev
git pull origin dev   # 同步最新

# 开发 → 提交
git add <files>
git commit -m "feat/fix: ..."
git push origin dev   # 只推 dev

# ❌ 以下命令在用户未说"上线"前禁止执行
# git push origin main
# git merge main
# gh pr merge
```

### 上线流程（仅当用户明确说"上线"时）

```bash
git checkout main
git merge dev --no-ff
git push origin main
git checkout dev
```

---

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 18 + TypeScript + Vite |
| 样式 | 纯 CSS（index.css CSS 变量体系） |
| 本地存储 | localStorage（key: `camping-plans-v1`） |
| 云同步 | Supabase（Realtime + JSONB `data` 列） |
| 部署 | Vercel（main → 生产，dev → Preview） |

---

## 数据结构规范

### 核心类型（src/types.ts）

- `CampingPlan` — 顶层计划对象，存整个 JSON blob
- `Family` — 结算主体（`isSolo?: boolean` 表示独立参与者）
- `Person` — 参与人员，必须 `familyId` 关联一个 Family
- `Supply` — 物资（`needsAA?: boolean` 控制是否参与 AA）
- `Expense` — 花费记录（`payerFamilyId` 关联 Family）
- `MenuItem` — 菜单条目

### 新增字段必须遵守的规则

```typescript
// ✅ 正确：新增可选字段，migratePlan 补默认值
export interface Supply {
  newField?: string; // 新增
}

// store.ts migratePlan 中：
supplies: (p.supplies ?? []).map(s => ({ ...s, newField: s.newField ?? 'default' }))

// ❌ 错误：必填字段、删除字段、重命名字段
```

### `migratePlan()` 是数据兼容的唯一入口

所有旧数据通过 `migratePlan` 在读取时静默升级，**不修改 Supabase 里的原始数据**。

---

## 同步 / Realtime 修改注意事项

以下改动影响多设备同步，**必须谨慎，改前先说明方案**：

- `syncPlanToCloud` / `fetchPlanFromCloud` / `subscribeToPlan`
- `updatePlan` 防抖逻辑（300ms timer）
- `planRef` 模式（stale closure 保护）
- Supabase `plans` 表的 `data` / `room_code` / `updated_at` 列

---

## 代码风格

- 所有金额显示使用 `toFixed(2)`，不用 `toFixed(0)`
- 所有文本输入 `maxLength={20}`
- 金额输入使用 `sanitizeAmount()` 函数（已在 ExpensesTab / SuppliesTab 中定义）
- 组件内 state 用 `useState`，跨组件用 `useApp()` context
- 不引入新的第三方库（除非必要且先确认）

---

## 禁止事项清单

| 禁止 | 原因 |
|------|------|
| `git push origin main` | 直接污染生产 |
| 删除 `migratePlan` 中的任何 `?? 默认值` | 旧数据会报错 |
| `alert()` / `confirm()` | 用项目内置 Modal 组件 |
| 浅拷贝 plan 后修改（`{...plan}`的子数组） | 会导致引用共享 |
| 修改 `Expense.payerFamilyId` 的语义 | AA 计算依赖此字段 |
| 大重构（除非用户明确要求） | 优先稳定性 |

---

## 项目文件地图

```
src/
├── types.ts          # 数据类型 + calculateSettlement 逻辑
├── store.ts          # localStorage 读写 + migratePlan + duplicatePlan
├── sync.ts           # Supabase 云同步（CRUD + Realtime）
├── supabase.ts       # Supabase client 初始化
├── App.tsx           # 全局状态 (plan/sync/toast)，AppContext
├── pages/
│   ├── Home.tsx      # 首页（列表/新建/加入/复制）
│   ├── PlanDetail.tsx
│   └── tabs/
│       ├── OverviewTab.tsx    # 概况（家庭/人员/菜单）
│       ├── SuppliesTab.tsx    # 物资
│       ├── ExpensesTab.tsx    # 花费
│       ├── SettlementTab.tsx  # AA 结算
│       └── ShareTab.tsx       # 分享/导出
└── components/
    ├── Modal.tsx
    └── BottomNav.tsx
```

---

## 🧠 Karpathy Skill · 协作原则

> 来源：andrej-karpathy-skills 核心理念，以文本形式集成（插件环境不可用）

### 动手前先读透

- 修改任何文件前，必须先完整阅读该文件
- 不要靠"印象"或"上次看过"来猜测当前状态
- 先理解，再动手

### 最小有效改动

- 能用 5 行解决，不写 50 行
- 能改一处，不改三处
- 每次 commit 只做一件事
- diff 要小，小到 reviewer 一眼看完

### 假设可能是错的

- 遇到 bug，先复现，不要直接猜测根因后修改
- 对自己的理解保持怀疑，代码优先于记忆
- 运行结果优先于理论推导

### 调试方法论

```
1. 复现问题（能稳定复现才算真的找到了）
2. 隔离变量（缩小范围，排除干扰）
3. 找到根因（不是"症状"，是"为什么"）
4. 最小修复（只改必须改的）
5. 验证修复（修完再跑一遍复现步骤）
```

禁止：直接猜测 → 修改 → 祈祷。

### 简单优先

- 简单的代码 > 聪明的代码
- 现有逻辑 > 新增抽象
- 可读性 > 简洁性
- 不为了优雅而重构正在运行的代码

### 不确定时暂停

- 遇到不确定的情况，停下来，提问
- 不要用"应该是这样"来掩盖不确定
- 一次只解决一个问题

---

## 🏕️ 露营小助手 · 专属安全规则

> 项目专属规则，优先级高于通用 Karpathy 原则

### 核心原则

- 优先保持稳定运行
- 优先保护用户数据
- 优先小范围修改
- 优先兼容现有逻辑
- 不为了"更优雅"而重构

### 修改前必须说明

每次开始任务前必须声明：

1. 准备修改什么
2. 会影响哪些文件
3. 为什么需要修改
4. 潜在风险是什么

未经确认不得直接进行高风险修改。

### 绝对禁止（未经明确批准）

- 删除数据库表
- 修改数据库结构
- 修改 Supabase RLS 策略
- 删除用户数据
- 批量迁移数据
- 修改认证逻辑
- 修改部署配置（vercel.json / netlify.toml 等）
- 修改域名配置
- 修改环境变量
- 大规模重构

发现问题先说明，不要直接执行。

### 敏感数据表操作规范

涉及以下数据表时，必须先说明影响范围、风险和回滚方案，得到确认后才能执行：

- `plans`（核心计划数据）
- `families` / `people`（参与者数据）
- `supplies` / `expenses`（物资花费数据）
- 任何 Supabase 表结构或 RLS 策略

### Bug 修复流程

1. 复现问题
2. 找到根因
3. 解释根因
4. 提出最小修改方案
5. 修改
6. 验证

禁止：直接猜测后修改。

### 开发原则

优先：
- 小 diff，小 PR
- 最少代码
- 复用现有逻辑（`migratePlan`, `calculateSettlement`, `sanitizeAmount` 等）

避免：
- 新增抽象层
- 提前设计
- 过度封装
- 不必要的组件拆分

如果 20 行代码能解决问题，不要写 100 行。

### UI 修改原则

未经明确要求，不得改变：
- 配色体系（CSS 变量）
- 页面整体布局
- 信息架构
- 用户操作流程

UI 优化必须保持用户习惯。

### 部署原则

默认行为：
- 推送到 GitHub `dev` 分支
- Vercel 自动从 `dev` 部署 Preview 环境

除非明确要求，不触发生产部署（`main` 分支）。

### 不确定时

不猜测。暂停并提问。

---

*最后更新：2026-05-26*
