---
last_updated: 2026-10-25
source_files: [src-tauri/src/agent/reader.rs, src-tauri/src/agent/approvals.rs, src-tauri/src/agent/mod.rs, src-tauri/src/approval.rs, src-tauri/src/approval_mode.rs, src/app/approval.js, src/app/ask-dialog.js, docs/architecture/ask-dialog.md, docs/architecture/approval-mode.md]
related_memory: []
---

# 工具审批与 Ask 对话框

两类交互共用 omp 的 `extension_ui_request` 通道：

- **工具审批**：`method: "select"`，选项恰为 `["Approve","Deny"]`，标题 `Allow tool: <name>` + 细节行。
- **ask 对话框**：`method: "ask"`，一次携带该 ask 工具调用的全部问题。
- **扩展选择器**（如 `/review`）：仍是 `select`，但选项是它自己的。

## 触发点

| 触发 | 来源 | 前置 |
|---|---|---|
| 工具审批提示 | omp 在 `write`/`exec` 档位下发起 | 当前 `--approval-mode` 允许该 tier 提示 |
| 自动审批（规则命中） | `reader.rs::try_auto_approve`（`reader.rs:123`） | `RuleBook::is_granted(session, project, tool)` |
| ask 对话框 | omp 的 ask 工具 | `_initFetch` 每进程发送 `set_ask_dialog {enabled:true}` |
| 审批模式变更 | 状态栏 ✓ / Settings → Approvals | 见 [审批模式段](#审批模式变更) |

## 数据流路径

### A. 普通工具审批

```
omp stdout: extension_ui_request { id, method:"select", title:"Allow tool: bash…", options:["Approve","Deny"] }
  → agent/reader.rs 每行解析
     auto_approve_or_track(...)（reader.rs:155）
       ├ 规则命中 → try_auto_approve 直接向 stdin 写 approve_answer
       │            → 输出合成帧 {type:"desktop_auto_approval", tool, details}
       │            → 该提示**不记录**（不可再被授权）
       └ 否则 → approvals::track 记录未答提示（id ≤ 256 字节）→ 原帧继续上行
  → journal push → emit agent://line/{id}
  → live.js _queueAskBubble（150 ms 合批，保证审批气泡排在自己的工具卡上方）
  → design/chat/ask-bubble.jsx 渲染（按钮由 OMP_APPROVAL.approvalInfo 解析得出）
  用户点 Approve / Approve+grant
  → OMP_BRIDGE.answerConfirm / answerApproveAndGrant
     └ grant 路径一次 IPC：invoke("approval_approve_and_grant", {sessionId, requestId, scope})
         lib.rs:664 → AgentBridge::approve_and_grant(rule_book, sid, requestId, scope)
           · 在该会话**仍存活进程**转发的、**尚未回答**的提示里查找 requestId
           · 找到 → 写 extension_ui_response + 写规则，两步在一把锁内
           · approvals::settle 移除该提示
           → tracker().on_answered(sid, id, alive)
```

### B. Ask 对话框

```
omp: extension_ui_request { id, method:"ask", questions:[…] }
  → 同样经 _queueAskBubble（先于 tool_execution_start 到达）
  → app/ask-dialog.js 解析 → chat/ask-dialog.jsx 渲染卡片
     单选有选项 → 点击即答；其余 → Submit（每个单选必须已选或已填）
     picks 存在组件模块级 Map（request id 为键），因为切标签会重挂载
  → answers() 构造严格形状：answers:[{id, selectedOptions, customInput?}]
  → answerAskDialog → extension_ui_response
  → omp 校验失败则 ask 工具失败（parseAskDialogResponse）
```

## 关键节点详解

| 节点 | 位置 | 核心逻辑 | 异常处理 |
|---|---|---|---|
| 自动审批 | `reader.rs:123` | 命中规则即写 stdin 并 flush，返回合成通知帧 | 写失败静默（进程可能已死） |
| 提示登记 | `approvals.rs::track` | 只登记未自动答的提示，id 上限 256 字节 | 超限或不合法 id 不登记（不可被 grant） |
| 授权绑定 | `approve_and_grant` | 只用 `(sessionId, requestId, scope)`，**不看当前活动标签页** | 提示已被回答/进程已换 → 返回错误，不写规则 |
| 答复结算 | `approvals::settle` | 写入成功后调用 | 仅写入成功才结算 |
| ask 答复形状 | `ask-dialog.js` `answers()` | 与 omp 的校验逐条对齐 | 无法解析的请求直接 cancel，绝不让 omp 空等 |
| 模式解析 | `ApprovalModeStore::resolve(cwd)` | 项目覆盖 → 全局默认 | 文件损坏读默认 + 拒写 |

## 异常路径

| 异常 | 处理 |
|---|---|
| 提示到达时气泡顺序错乱 | `_queueAskBubble` 的 150 ms 合批把审批气泡放在其工具卡之前 |
| omp 自己取消（`cancel` + `targetId`） | 关闭该问题；ask 气泡标 `closedByOmp` |
| ask 超时 | omp 按推荐选项自行作答并 `cancel` → 同样标 `closedByOmp` |
| 用户 Cancel | 发 `cancelled: true` → omp 中止整个 turn（等价于它自己对话框上的取消） |
| 会话已被重启 | 旧提示随 `BridgeInner` 消失；迟到答复被拒 |
| 规则命中但 stdin 已关闭 | 写失败；无合成通知，前端也看不到该提示（进程已死场景） |
| `always-ask` 档位 | 仍然自动答 `read`，其他都提示 |
| `yolo` 档位 | omp 不发 tier 提示 → 规则无事可做（面板文案会说明） |

### 审批模式变更

```
status 栏 ✓ / Settings → Approvals
  → approval_mode_set_default / approval_mode_set_project   （Rust 写入 approval-mode.json）
  → OMP_APPROVAL_MODE.restartPlan(view, sessions)
       idle 且模式不符 → 立即 _respawnSession(id)
       busy（running/retrying/waiting-user/background）→ 延后，下一次 get_state 显示空闲时再判
       failed（进程已死）→ 不重启，下次启动自然用新模式
  → 重启走 stop_session（不碰终端/浏览器），新进程带 --resume
  → 目标未达成 → 记 _modeRestartMissed，目标变化前不再重试
```

## 关联组件

- 纯逻辑：`OMP_APPROVAL`（标题拆解/自动审批行）、`OMP_ASK_DIALOG`（解析与答复构造）、`OMP_APPROVAL_MODE`（模式与重启计划）
- Rust：`approval.rs`（`RuleBook`、`approval_tool_name`、`project_key`）、`agent/approvals.rs`、`agent/reader.rs`、`approval_mode.rs`
- 命令：`approval_rules_list`、`approval_approve_and_grant`、`approval_rules_revoke`、`approval_mode_get/_set_default/_set_project`
- 组件：`chat/ask-bubble.jsx`、`chat/ask-dialog.jsx`、`chat/approval-row.jsx`、`design/approval-rules-panel.jsx`、`design/approval-mode-section.jsx`

## 相关业务流

→ 详见 [提示提交与排队](提示提交与排队.md)
→ 详见 [会话全生命周期](会话全生命周期.md)
→ 详见 [手机远程访问](手机远程访问.md)（同一问题集的另一种消费方）
