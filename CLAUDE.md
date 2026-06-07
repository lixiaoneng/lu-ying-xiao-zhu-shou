# 露营小助手 · 开发规范

> 本文件是 Claude Code 的项目级规则，每次开发前自动生效。
> 包含产品记忆 + 开发规范，新对话从此读起。

---

## 🏕️ 项目简介

### 项目定位

露营小助手是一款面向露营团体的轻量协作工具，帮助多家庭/多人团队在露营前后完成物资管理、花费记录和 AA 结算。无需注册，扫码或输入房间码即可加入同一计划，实时同步。

### 核心理念

**有组织地松弛一下。**

露营本该是放松的，但多人出行的协调往往很烦。这个工具的目标是把"谁带什么、谁花了多少、最后怎么算"这件事做得刚刚好——不过度设计，不引入不必要的复杂度。

### 目标用户

有露营习惯的城市家庭/朋友圈，通常 2–6 个家庭一起出行，移动端使用为主。

---

## ✨ 当前核心功能

| 功能 | 说明 |
|------|------|
| 房间码协作 | 生成 6 位房间码，多设备实时共享同一计划 |
| 云端同步 | 基于 Supabase Realtime，修改秒级同步到所有参与者 |
| 物资管理 | 记录每样东西由谁负责携带，支持标记是否参与 AA |
| 花费管理 | 记录实际花费，关联支付家庭 |
| AA 结算 | 自动计算各家庭应收/应付金额，最少转账路径 |
| 单人参与 | 支持不属于任何家庭的独立参与者，独立结算 |
| 部分 AA | 单条花费可标记为仅部分家庭分摊，而非全员 AA |
| 微信分享 | 支持生成分享卡片，朋友圈/微信群一键传播 |

---

## 🎯 重要产品决策

### 为什么支持单人参与（isSolo）

露营团体中常有朋友单独加入、没有家庭的情况。`Family.isSolo = true` 表示该"家庭"实质上是一个独立个人，在 UI 和结算逻辑中与普通家庭保持一致，避免为单人单独设计数据结构。

### 家庭与成员关系

`Family` 是结算主体，`Person` 是展示/分工主体。AA 计算以 Family 为单位，不以个人为单位。一个家庭可以有多个成员，但结算时视为整体。

### 部分 AA 逻辑

`Expense` 支持指定参与分摊的家庭子集。未指定时默认全员 AA。这解决了"某顿饭只有部分家庭参与"的真实场景。

### 公共物资 AA 规则

`Supply.needsAA` 控制该物资是否计入 AA 结算。默认不计入，需手动标记。物资的金额来源于对应 Expense，两者通过设计解耦——物资管理和花费记录是两个独立维度。

### 数据兼容原则

历史计划数据必须永久兼容。所有数据升级通过 `migratePlan()` 在读取时静默完成，不修改原始存储。新字段只能是可选字段并带默认值。

---

## 🗺️ 产品方向

| 方向 | 说明 |
|------|------|
| 装备大本营 | 跨计划管理个人/家庭装备库，复用到新计划 |
| 运营统计后台 | 了解真实用户使用情况，辅助产品决策 |

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

## 部署前检查规范

每次修改完成后，**不能只依赖本地 preview**。提交和推送前必须运行：

```bash
npm run build
```

确认生产构建通过后再推送。原因：

- 本地 `vite dev` / `preview` 跳过 `tsc` 类型检查，不会暴露 TypeScript 错误
- Vercel 部署会执行完整的 `tsc && vite build`，以下问题只在 CI 暴露：
  - 声明但未使用的变量（TS6133）
  - 类型不匹配、缺少必填字段
  - import 路径大小写不一致
  - 依赖缺失或版本冲突

遇到 build 报错时，**必须修复根因**，禁止以下绕过手段：

| 禁止操作 | 原因 |
|----------|------|
| 关闭 TypeScript 严格模式 | 掩盖真实类型问题 |
| 关闭 ESLint / 添加 `// eslint-disable` | 掩盖代码质量问题 |
| 在 `tsconfig.json` 中设置 `noUnusedLocals: false` | 掩盖未使用变量 |
| 在构建命令中加 `|| true` 跳过检查 | 绕过错误直接部署 |

涉及真实用户数据、分享链接和多人协作逻辑的改动，**必须优先保证向后兼容**，旧计划在新版本中必须能正常打开和展示。

---

## Auth 状态隔离原则

Auth 状态（`useAuth`）不得进入 `AppContext`，不得与计划功能（`plan`、`roomCode`、`updatePlan` 等）产生任何直接依赖。

装备大本营、个人登录、个人数据等功能应独立管理自己的 `user` 状态。

计划功能必须在 `user = null` 时仍然完整可用。未登录用户应继续能够创建计划、打开旧计划、通过房间码加入计划、通过分享链接协作编辑。

任何涉及登录、用户身份、个人数据的新功能，都不得改变现有匿名计划协作的主流程。

---

## 新增 Supabase 表的安全规范

每次新建 Supabase 表，必须遵守以下规则：

1. 建表后立即 `enable row level security`。
2. 必须有明确的 owner-only 或 public 策略，不得留下权限含糊的表。
3. 存储个人用户数据的表必须使用 owner-only RLS，确保用户只能读写自己的数据。
4. `updated_at` 自动更新应使用独立命名的 trigger function，例如 `handle_{表名}_updated_at`，避免使用通用函数名覆盖已有函数。
5. 不得顺手修改 `public.plans` 表及其 RLS policy。现有匿名创建计划、房间码分享、多人协作依赖 `plans` 表当前策略。
6. 涉及数据库、权限、登录、用户身份的改动，必须先出方案，确认后再执行。
7. 每次修改完成后必须运行 `npm run build`，确认生产构建通过后再提交。

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

*最后更新：2026-06-01*
