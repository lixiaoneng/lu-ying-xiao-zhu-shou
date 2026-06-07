请执行上下文交接工作流。不要开发任何新功能，只做状态记录和构建验证。

## 步骤

1. 读取以下文件（如尚未读取）：
   - CLAUDE.md
   - PROJECT_STATUS.md（如存在）

2. 运行以下命令收集当前状态：
   - `git log --oneline -10`（最近 10 条 commit）
   - `git status --short`（当前工作区状态）
   - `git branch --show-current`（当前分支）

3. 运行构建验证：
   ```
   npm run build
   ```
   如果 build 失败，报告错误原因，不要尝试修复（修复是另一个任务）。

4. 更新 PROJECT_STATUS.md，内容包括：
   - 当前分支和最新 commit hash + message
   - 已完成能力（基于 git log 和实际代码状态更新，不要凭记忆猜测）
   - 进行中或下一步任务（基于上下文对话和 TODO 更新）
   - 关键文件地图（如有新增文件则更新）
   - 数据库状态（如有变化则更新）
   - 生产安全约束（保持不变，不要删减）
   - 新窗口启动指令（保持不变）
   - 最后更新时间（今天的日期）

5. 输出简短交接报告，格式如下：

```
## /handoff 完成

**分支**：[branch]
**最新 commit**：[hash] [message]
**build**：✅ 通过 / ❌ 失败（[错误摘要]）

**PROJECT_STATUS.md 更新了**：
- [列出本次更新了哪些部分]

**下一步任务（新窗口可直接接手）**：
- [最优先的 1-2 个任务]

**提醒**：新窗口开始前请运行 /start-task
```

## 注意

- 不要修改任何业务代码（.ts / .tsx 文件）
- 不要提交 commit（由用户决定是否 commit PROJECT_STATUS.md）
- 不要 push
- 只读取信息、更新 PROJECT_STATUS.md、运行 build
