---
last_updated: 2026-10-25
source_files: [src-tauri/src/widgets/, src/app/widgets.js, docs/architecture/widgets.md, docs/widgets.md]
related_memory: []
---

# 轨道 Widget 插件

轨道（ambient rail）里的卡片可以由外部程序提供：**Rust 决定是否、何时、跑什么**，前端只上报视图状态并渲染输出。

## 触发点

| 触发 | 来源 | 说明 |
|---|---|---|
| `Manual` | `widgets_refresh` / 卡片刷新按钮 | 永远可跑 |
| `Interval` | 调度器计时（`interval_ms`） | 窗口隐藏或 tab 非活动时不跑 |
| `Activate` | 标签页激活 | 仅"新变为可运行"的插件 |
| `TurnEnd` | `agent/reader.rs` 的 `agent_end` | 后台标签页记为 dirty，下次激活补跑 |
| `Branch` | `git_watcher` 的 HEAD 变化 | 先重算上下文，再发 `SessionOpened` + `Branch` |
| `SessionOpened` | `start_session` 成功 | 宿主在自己的线程算 git 上下文 |

## 数据流路径

```
widgets.json ──load（启动 / widgets_reload）──▶ WidgetHost ──Event::Config──▶ Scheduler
start_session / stop_session ──▶ WidgetHost ──SessionOpened/Closed──▶ Scheduler
reader.rs agent_end ──turn_ended──▶ WidgetHost ──TurnEnd──▶ Scheduler
git_watcher HEAD ──branch_changed──▶ WidgetHost ──(ctx refresh + Branch)──▶ Scheduler
前端 widgets_set_view / widgets_refresh ──▶ WidgetHost ──View / Manual──▶ Scheduler
                                              │
                                    Actions ◀─┘
Start  → 指纹校验 → 工作线程 → ScriptStore::prepare → run_plugin → Event::Finished
Kill   → registry.kill_tree
Changed/Removed → app.emit(widgets://config | widgets://run | widgets://removed)
```

### Start 动作的五步

```
1. 宿主为该 run 起一个工作线程（thread::Builder，失败则喂 Finished 带错误）
2. ScriptStore::prepare(entry, approved)
     ├ Prepared::Ready(Run)   → argv 指向 store/<fingerprint>/ 下的**已校验副本**
     ├ Prepared::Changed(fp)  → 不 spawn，喂 Finished「plugin changed since it was approved」
     │                          → 宿主重发 Config（插件变未批准）+ emit widgets://config
     └ 错误（读不了文件、无 cache 目录）→ 该次运行以错误结束
3. run_plugin(entry, argv, ctx, on_spawn)
     · 注册 Arc<ProcessSupervisor>，超时 / stdout 上限 / 进程树杀
4. 工作线程移除 registry 条目 → Event::Finished
5. 宿主 emit widgets://run（输出解析在前端 OMP_WIDGETS.parseOutput）
```

## 调度器规则（`widgets/schedule.rs`，纯函数）

`Runnable(p, s)` 必须全部满足：

- `enabled` 且 `approved`（指纹当前有效）
- `id ∉ view.hidden` 且 `view.rail_visible`
- 会话 `s` 已知
- `p.matches(ctx.project, ctx.remote)`

其他规则：

| 规则 | 行为 |
|---|---|
| 每个 key 只跑一个 | `RunKey { scope_key, plugin_id }` |
| 并发上限 | `MAX_CONCURRENT_RUNS = 4`，超出进 FIFO 等待队列 |
| 排队合并 | 至多一个合并的后续触发；`Interval` 不覆盖已排的非 interval 触发 |
| Activate | 只启动**新变为可运行**的插件（批准/取消隐藏一个卡片不会重跑其它卡片） |
| 后台触发 | 非活动会话记为 dirty，下次激活恰好补一次 |
| 全局插件 | `scope_key = "__global__"`，需要活动会话 |

## 关键节点详解

| 节点 | 位置 | 核心逻辑 | 异常处理 |
|---|---|---|---|
| 配置加载 | `widgets/config.rs` | 校验 `widgets.json`，`errors` 收集警告 | 非法 `insert` → 警告并退回 `Draft`；配置路径缺失 → 什么都不跑 |
| 指纹 | `widgets/trust.rs` | `fingerprint(entry)` + `ApprovalStore`（`widget-approvals.json`） | 不匹配 → 不 spawn |
| 脚本副本 | `widgets/snapshot.rs` | 校验过的副本写入 `<app cache>/widget-runs/store/<fp>` | 无法复制 → 运行错误 |
| 宿主 | `widgets/host.rs` | 单调度线程 + `recv_timeout(next_deadline - now)`，超时喂 `Tick` | 线程创建失败 → 记录错误，不静默 |
| 运行 | `widgets/run.rs` | stdin 传上下文、超时、stdout 上限、树杀 | 全部归结为 `Outcome` |
| 上下文 | `widgets/context.rs` | 分支、无密码默认 remote；`PluginContext` 有界 | 非 git 目录 → 空上下文 |
| 打码 | `widgets/redact.rs` | 与 `agent/reader.rs` 共用 `redaction.rs` 键表 | — |
| 前端解析 | `app/widgets.js` | `parseOutput`、`safeUrl`、`insertAction`、`mergeRun`、`attentionStep` | 非法输出 → 错误卡片 |

## 异常路径

| 异常 | 处理 |
|---|---|
| 插件在批准后被修改 | 指纹不匹配 → 不运行、通知重新批准、`widgets://config` |
| 插件超时 | 进程树被杀，运行记为超时 |
| stdout 超上限 | 截断并报错 |
| 轨道隐藏 / 卡片被隐藏 | 一律不启动（"隐藏的卡片永不运行"） |
| 无 app cache 目录 | snapshot 的 `fatal` 说明原因，什么都不跑 |
| 应用退出 / 更新重启 | `WidgetHost::kill_all()` 在 `kill_child_processes` 中，位于 omp 与 Chromium 之后、终端之前 |
| 前端崩溃 | 不影响调度（调度在 Rust） |

## 安全边界

- 每次 spawn **之前**必须做指纹校验，没有任何路径可以跳过。
- 执行的是已校验的**副本**，不是校验过的原路径（消除 TOCTOU）。
- 前端只发送插件 id、批准指纹与视图状态，**从不**发送路径、命令、触发方式或上下文。
- 插件以用户权限运行；其审批独立于 omp 的工具审批。

## 关联组件

- 纯逻辑：`OMP_WIDGETS`
- Rust：`widgets/{config,schedule,trust,snapshot,host,run,context,redact}.rs`
- 命令：`widgets_state`、`widgets_reload`、`widgets_approve`、`widgets_set_view`、`widgets_refresh`
- 事件：`widgets://config`、`widgets://run`、`widgets://removed`
- 组件：`design/widgets/{widget-card,widget-blocks,widget-approval,widget-error}.jsx`

## 相关业务流

→ 详见 [手机远程访问](手机远程访问.md)
→ 详见 [会话全生命周期](会话全生命周期.md)
