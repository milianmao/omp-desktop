---
last_updated: 2026-10-25
source_files: [src-tauri/src/lib.rs, src/live.js, src/app/use-*.jsx, AGENTS.md]
related_memory: []
---

# 服务层与 IPC 通信

## 三个半边界

| 边界 | 形式 | 规则 |
|---|---|---|
| 前端 ↔ Rust | Tauri command / event | 参数 camelCase；错误 `Result<T, String>`；`invoke_*` 都过 `_invokeSafe`/`_invokeResult` 两个助手 |
| Rust ↔ omp | stdin/stdout 每行一个 JSON | 前端只能发 `ALLOWED_COMMAND_TYPES` 里的 `type` |
| Rust ↔ Chromium | CDP over pipe（broker） | 无端口；详见 [浏览器面板](../03-核心数据业务流/浏览器面板与CDP代理.md) |
| 手机 ↔ Rust | HTTPS + WebSocket | TLS only；详见 [手机远程访问](../03-核心数据业务流/手机远程访问.md) |

## Tauri 命令清单（按域）

`lib.rs` 的 `generate_handler!` 是唯一注册点（当前 **94** 个命令）。新增命令必须同时出现在那里。

| 域 | 命令 |
|---|---|
| 会话 | `start_session`、`stop_session`、`close_tab`、`close_all_tabs`、`send_command`、`session_status`、`replay_events`、`extension_ui_state` |
| 终端 | `terminal_open`、`terminal_status`、`terminal_replay`、`terminal_ack`、`terminal_write`、`terminal_resize`、`terminal_settings`、`terminal_set_shell`、`terminal_pick_shell` |
| 浏览器 | `browser_settings`、`browser_set_path`、`browser_pick_path`、`browser_open_panel`、`browser_close_panel`、`browser_resize`、`browser_navigate`、`browser_history`、`browser_tab_new`、`browser_tab_close`、`browser_tab_activate`、`browser_input`、`browser_frame_ack`、`browser_annotate`、`browser_capture`、`browser_scroll_to` |
| 审批 | `approval_rules_list`、`approval_approve_and_grant`、`approval_rules_revoke`、`approval_mode_get`、`approval_mode_set_default`、`approval_mode_set_project` |
| 项目/git | `open_project`、`take_pending_open_projects`、`start_git_watch`、`stop_git_watch`、`list_project_files`、`workspace_accept`、`workspace_reject` |
| git 浏览器 | `git_browser_status`、`git_browser_file`、`git_browser_log`、`git_browser_commit`、`git_browser_commit_file` |
| 文件预览 | `project_file_read` |
| 历史/会话树 | `list_saved_sessions`、`conversation_tree` |
| profile | `list_profiles`、`create_profile`、`rename_profile`、`delete_profile`、`set_startup_profile`、`clear_profile_bootstrap` |
| 键位 | `keybindings_list`、`keybindings_set`、`keybindings_reset` |
| 最近项目/布局 | `recent_projects_list`、`recent_projects_touch`、`recent_projects_remove`、`open_tabs_load`、`open_tabs_save` |
| widget | `widgets_state`、`widgets_reload`、`widgets_approve`、`widgets_set_view`、`widgets_refresh` |
| 远程 | `remote_status`、`remote_interfaces`、`remote_apply_settings`、`remote_pair_start`、`remote_pair_cancel`、`remote_device_rename`、`remote_device_revoke`、`remote_regenerate_cert`、`remote_publish`、`remote_action_result`、`remote_ready`、`remote_push_test`、`remote_default_contact` |
| 其他 | `model_usage_list`、`usage_stats`、`goal_continuation_get`、`goal_continuation_set`、`open_url_external`、`app_update_check`、`app_update_install`、`set_close_guard` |

## Tauri 事件

| 事件 | payload | 谁监听 |
|---|---|---|
| `agent://line/{id}` | `{seq, text}` | `live.js`（仅活动标签页） |
| `agent://exit/{id}` | 原因字符串（空 = 正常退出） | `live.js` |
| `terminal://data/{id}` | `{instance, seq, b64}` | `useTerminal` |
| `terminal://exit/{id}` | `{instance, code}` | `useTerminal` |
| `git://branch/{id}` | 分支信息 | `live.js` |
| `widgets://config` / `widgets://run` / `widgets://removed` / `widgets://active` | 见 `docs/architecture/widgets.md` | `useWidgets` |
| `remote://status` / `://watch` / `://action` | 见 `docs/architecture/remote-access.md` | `useRemote` / 设置行 |
| `update://progress` | `{downloaded, total}` | `useUpdater`（仅安装期间订阅） |
| `open://project` | 无 payload（队列才是事实源） | `live.js` |
| `window://close-requested` | 无 payload | `live.js` |

**事件名带会话 id**，这是"只处理活动标签页"的机制基础：切换时先解绑再绑新 id。

## `OMP_BRIDGE`（**132** 个成员，含 2 个 getter）

`live.js:3277` 一次性挂出。分组：

| 组 | 代表方法 |
|---|---|
| 会话 | `openSession`、`resumeSession`、`closeSession`、`closeSessionGuarded`、`switchSession`、`reorderTabs`、`renameSession`、`cwd`、`resolveCloseConfirm` |
| 发送 | `send`、`steer`、`followUp`、`sendQueuedNow`、`abort`、`stopRetry`、`answerAsk`、`answerAskDialog`、`answerConfirm`、`cancelAsk` |
| 模型/思考 | `setModel`、`cycleModel`、`cycleThinking`、`setThinkingLevel`、`recentModels`、`refreshModels` |
| 会话数据 | `compact`、`newSession`、`exportHtml`、`getState`、`conversationTree`、`branchAt`、`forkAt` |
| goal | `goalStart`、`goalOp`、`goalDismiss`、`goalContinuation`、`setGoalContinuation` |
| 子 agent | `setSubagentInspecting`、`steerSubagent`、`cancelSubagent` |
| 终端 | `terminalOpen`、`terminalStatus`、`terminalReplay`、`terminalAck`、`terminalWrite`、`terminalResize`、`terminalSettings`、`setTerminalShell`、`pickTerminalShell`、`onTerminalData`、`onTerminalExit` |
| 浏览器 | `browserOpenPanel` … `browserScrollTo`、`browserSettings`、`browserSetPath`、`browserPickPath` |
| git / 文件 | `gitBrowserStatus/File/Log/Commit/CommitFile`、`readProjectFile`、`openExternalUrl` |
| widget / 远程 | `widgets*`、`remote*` |
| 键位/设置 | `listKeybindings`、`setKeybinding`、`resetKeybinding`、`setSessionPrefs`、`setPromptHistoryLimit` |
| 事件 | `onUpdate`、`waitForActivation` |

**新增桥方法的固定成本**：纯逻辑进 `app/*.js`；需要 IPC 的进 `live.js`；若发送新 RPC 命令，必须同时加进 `ALLOWED_COMMAND_TYPES`（有 Rust 测试扫描 `live.js` 里的 `{ type: "…"` 字面量比对）。

## 两个调用助手

```js
_invokeSafe(cmd, args, fallback)   // 无 Tauri 或抛错 → 返回 fallback（只 console.error）
_invokeResult(cmd, args)           // → {ok:true, value} | {ok:false, error:String}
```

选择规则：**拿数据用 `_invokeSafe`（缺省值即可），做动作且要给用户看原因用 `_invokeResult`**。

## RPC 命令白名单（`ALLOWED_COMMAND_TYPES`）

**35** 项，按用途分组：

| 组 | 命令 |
|---|---|
| 协议/状态 | `negotiate_protocol`、`get_state`、`get_messages`、`get_session_stats`、`get_available_models`、`get_available_commands` |
| 对话 | `prompt`、`abort`、`abort_retry`、`steer`、`follow_up`、`remove_queued_message`、`promote_queued_message` |
| 模型/思考 | `set_model`、`cycle_model`、`cycle_thinking_level`、`get_available_thinking_levels`、`set_thinking_level` |
| 会话 | `compact`、`new_session`、`export_html`、`get_login_providers`、`login`、`branch`、`fork` |
| 审批 | `extension_ui_response`、`set_ask_dialog` |
| 子 agent | `set_subagent_subscription`、`get_subagents`、`get_subagent_messages`、`steer_subagent`、`cancel_subagent` |
| goal | `goal` |
| 设置 | `set_auto_compaction`、`set_auto_retry` |

## 存储位置速查

| 内容 | 位置 |
|---|---|
| tweaks / 列宽 / widget 开关 | `localStorage: omp-desktop:tweaks` |
| profiles / 启动默认 | `<app config>/profiles.json` |
| 打开的标签页 | `<app config>/open-tabs.json` |
| 最近项目 | `<app config>/recent-projects.json` |
| 键位覆盖 | `<app config>/keybindings.json` |
| shell / Chromium | `<app config>/terminal.json` / `browser.json` |
| 审批模式 | `<app config>/approval-mode.json` |
| 审批规则 | `<app config>/approval-rules/` |
| widget 配置 / 批准 | `<app config>/widgets.json` / `widget-approvals.json` |
| 远程设置 / 设备 / TLS | `<app config>/remote.json` / `remote-devices.json` / `remote/` |
| widget 脚本副本 | `<app cache>/widget-runs/store/<fingerprint>` |
| 浏览器实例目录与 overlay | `<app cache>/browser/<pid>/` |

→ 详见 [技术栈与中间件](../01-架构总览/技术栈与中间件.md)

## 相关文档

→ 详见 [类型系统与数据模型](类型系统与数据模型.md)
→ 详见 [前端状态管理全景](前端状态管理全景.md)
