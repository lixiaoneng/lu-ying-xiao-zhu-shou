# 露营小助手 · 项目状态快照

> 本文件由 `/handoff` 命令维护，记录当前开发状态供新上下文窗口快速恢复。
> **不要手动编辑**，通过 `/handoff` 自动更新。

---

## 📍 当前状态

- **分支**：`dev`（生产分支为 `main`，未经用户明确说"上线"不得 merge）
- **上次 commit**：`7c373f0` feat: 装备大本营入口改为首页功能入口卡（移除 fixed Dock）
- **部署**：Vercel Preview（dev 分支自动部署），生产域名 `www.gogocamping.xyz`
- **真实用户**：有，生产数据不得破坏
- **main 最新**：`bbb52b3` merge: 装备大本营入口改为首页功能入口卡（已上线）

---

## ✅ 已完成能力

### 计划功能（匿名，核心功能）
- [x] 创建/删除/复制露营计划（localStorage + 可选云端）
- [x] 房间码多设备实时协作（Supabase Realtime）
- [x] 分享链接（URL 含 room_code）
- [x] 家庭/成员/独立参与者管理
- [x] 物资栏：personal / food / gear 三类，二级 system_category 分组，折叠展开
- [x] 花费记录 + AA 结算（按人头，支持部分 AA）
- [x] 露营菜单管理
- [x] 分享/导出（群聊文案 + JSON 导出）
- [x] 地点字段支持长导航链接（maxLength 200）

### 装备大本营（可选登录）
- [x] Supabase Auth 邮箱密码登录/注册（主）
- [x] Magic Link 邮箱链接登录（备选）
- [x] 忘记密码 + PASSWORD_RECOVERY 完整流程
- [x] 装备 CRUD（listEquipment / addEquipment / updateEquipment / deleteEquipment）
- [x] 装备按 system_category 分组展示（已改为分类卡片总览）
- [x] is_favorite 常用标记，排序靠前
- [x] 退出登录（二次确认）
- [x] 发送邮件 60s 倒计时防 rate limit
- [x] 首页入口：功能入口卡（淡橙渐变，登录三态显示，位于操作按钮下方）**【已上线】**
- [x] EquipmentPage：分类卡片总览（所有 SYSTEM_CATEGORIES，含空分类，引导文案）
- [x] EquipmentPage：分类详情视图 + FAB 预填当前分类添加装备
- [x] 编辑装备改分类后自动从当前分类列表消失

---

## 🚧 进行中 / 下一步任务

### 近期待做（已确认方向，未开始编码）
- [ ] 配置 Supabase 自定义 SMTP（正式推广前）
- [ ] 汉化 Magic Link 邮件模板（Supabase 控制台操作，非代码）

### 未来方向（未确认时间表）
- [ ] 装备库一键导入计划（需解决 assigneeId 映射问题）
- [ ] 装备大本营分类总览中的装备搜索
- [ ] 装备大本营"设置密码"入口（已登录状态下）
- [ ] 运营统计后台
- [ ] 微信登录（**前置任务**：需先完成 `profiles + user_identities` 设计，技术路径待确认）

---

## 🗂️ 关键文件地图

```
src/
├── types.ts          # Supply 新增 system_category?, SYSTEM_CATEGORIES 常量
├── store.ts          # migratePlan（只能在此做数据兼容）
├── sync.ts           # Supabase 云同步，绝对不随意改
├── supabase.ts       # getSupabase() 单例
├── equipment.ts      # 装备库 CRUD + 类型定义（EquipmentItem 等）
├── App.tsx           # view state（home/equipment），绝对不把 auth 放进 AppContext
├── pages/
│   ├── Home.tsx      # 首页，含装备大本营功能入口卡 + 登录三态展示
│   ├── PlanDetail.tsx
│   ├── EquipmentPage.tsx   # 装备大本营全页面（分类总览 + 分类详情）
│   └── tabs/         # 物资/花费/AA/分享，不轻易改
├── hooks/
│   └── useAuth.ts    # Auth 状态管理，含 isRecoveryMode
└── components/
    ├── Modal.tsx
    └── BottomNav.tsx
```

---

## 🗄️ 数据库状态

| 表 | 状态 | 备注 |
|----|------|------|
| `public.plans` | RLS 开启，3 条 public 策略 | **绝对不动** |
| `public.equipment_items` | RLS 开启，owner-only 4 条策略 | 可在此基础上扩展 |
| `auth.users` | Supabase 管理 | 不直接操作 |

- `plans` 表 RLS：public insert / public read / public update（匿名协作依赖）
- `equipment_items` 表：`user_id uuid references auth.users(id) on delete cascade`
- Supabase Auth Confirm email：**已关闭**
- Password Reset 邮件模板：**已汉化**，保留 `{{ .ConfirmationURL }}`

---

## 🔒 身份体系约束（微信登录前置任务）

**当前架构**：`equipment_items.user_id → auth.users.id`（Supabase Auth 邮箱账号），无 `profiles` / `user_identities` 表。

**未来接入微信/小程序/手机号等多登录方式，必须先完成**（前置任务，不属于当前上线范围）：

1. 设计 `profiles` 表（统一用户档案）
2. 设计 `user_identities` 表（外部登录身份 → 内部 user_id 的映射）
3. 确保邮箱账号与微信账号绑定到同一 `user_id`，共享同一份装备数据

**绝对禁止**：
- 把微信 openid / unionid 直接写入 `equipment_items.user_id`
- 绕过 Supabase Auth 自行创建另一套用户 ID 体系
- 在 `profiles + user_identities` 设计未完成并确认前，开始实现任何多登录方式

---

## ⚠️ 生产安全约束（最高优先级）

1. 不得 push 到 `main` 分支
2. 不得在未说"上线"时 merge dev → main
3. 不得破坏现有数据结构（localStorage / Supabase schema）
4. 不得删除或重命名任何现有字段
5. 不得修改 `plans` 表及其 RLS
6. 不得让 auth 状态进入 AppContext
7. 计划功能必须在 `user = null` 时完整可用
8. 每次改动后必须 `npm run build` 通过才能提交

---

## 🚀 新窗口启动指令

新开上下文时，先运行：

```
/start-task [本次任务描述]
```

会自动读取 CLAUDE.md + PROJECT_STATUS.md + git status，确认状态后再开发。

---

*最后更新：由 `/handoff` 于 2026-06-08 生成*
