---
last_updated: 2026-10-25
source_files: [docs/architecture/, src/live.js, src-tauri/src/lib.rs]
related_memory: []
---

# 03 · 核心数据业务流

本分类是知识库的核心：每条流程独立成文，格式统一为 **触发点 → 数据流路径 → 关键节点详解 → 异常路径 → 关联组件**。

## 流程清单

| 文档 | 覆盖范围 | 关键不变式 |
|---|---|---|
| [会话全生命周期](会话全生命周期.md) | 打开 / 切换 / 重启 / 关闭 / 启动恢复；omp+Chromium+shell+widget+git 的一次性协商与拆除 | 一个标签页一个 omp；`close_tab` 是唯一终点；`stop_session` 不碰浏览器与终端 |
| [提示提交与排队](提示提交与排队.md) | 提交路由（prompt / steer / follow-up / goal / local）、帧构造、白名单、队列条操作 | 命令与技能必须走 `prompt`，永不走 `steer`/`follow_up` |
| [工具审批与Ask对话框](工具审批与Ask对话框.md) | `select`/`ask` 两类 `extension_ui_request`、自动审批、授权绑定、审批模式重启 | 授权与提示绑定（session+requestId），不看活动标签页 |
| [终端面板全链路](终端面板全链路.md) | 注册表、六步 open、pump/流控、replay、树杀、键路由 | webview 从不发路径；`terminal_write`/`resize` 必须保持同步命令 |
| [浏览器面板与CDP代理](浏览器面板与CDP代理.md) | 占位端口、overlay、懒启动、broker 会话、准入、tap、标注、帧流控 | Chromium 无端口，broker 独占管道 |
| [轨道Widget插件](轨道Widget插件.md) | 配置/指纹/副本、调度器规则、运行与终止、前端解析 | 每次 spawn 前指纹校验，执行已校验副本 |
| [手机远程访问](手机远程访问.md) | TLS 服务器、配对鉴权、hub 发布、tracker、Web Push、锁屏探测 | webview 是唯一事实源；token 永不进 webview |
| [Git浏览器](Git浏览器.md) | 文件树/内联 diff/提交图、gix 读取、filter driver 剥离、stage/discard | 读取一律 gix；webview 从不发 git 参数 |
| [回合结果与重试](回合结果与重试.md) | 六级运行状态、失败气泡、自动重试行、job 行、Stop 的两种语义 | omp 的 `producedOutput` 决定重试何时结束；前端只做展示 |
| [目标模式](目标模式.md) | goal 建立/恢复/暂停、自动继续配置、plan 互斥、abort 暂停 | 首条 objective 必须走 `prompt`（`steer` 不带 goal 上下文） |
| [系统打开文件夹](系统打开文件夹.md) | 三平台投递、单实例转发、队列即事实源、路径规范化 | 只用 `args_os()`；前端从 Rust 队列取，不信事件载荷 |

## 读法

1. 先读 [会话全生命周期](会话全生命周期.md) —— 其余十条都以"标签页"为作用域。
2. 需要改哪条链路，再读对应文档；每篇的"异常路径"表格是最值得先看的部分。
3. 结构性原因（为什么这样设计）在 [关键设计决策](../02-功能结构和策略/关键设计决策.md)；具体坑在 [已知问题与陷阱](../06-迭代与变更/已知问题与陷阱.md)。

## 覆盖判据

每篇都包含：**触发点**（含前置条件）、**数据流路径**（带 `文件:行` 的节点链）、**异常处理**。边界场景（降级/超时/冲突/不可用/不可变状态）写在各自"异常路径"表中。

→ 返回 [知识库总索引](../README.md)
→ 详见 [核心功能模块](../02-功能结构和策略/核心功能模块.md)
