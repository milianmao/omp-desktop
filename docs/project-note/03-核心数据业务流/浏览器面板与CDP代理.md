---
last_updated: 2026-10-25
source_files: [src-tauri/src/browser/, src/app/browser.js, src/app/browser-screen.js, src/app/use-browser.jsx, src/design/browser-*.jsx, docs/architecture/browser.md]
related_memory: []
---

# 浏览器面板与 CDP 代理

一个标签页拥有一个 headless Chromium，由它的 omp agent 与浏览器面板共享。**Chromium 不开放任何端口**。

## 触发点

| 触发 | 入口 | 说明 |
|---|---|---|
| 面板打开 | `desktop.browser.toggle` / 状态栏 / 侧列默认值 | 面板打开本身就会触发懒启动 |
| agent 请求 CDP | omp 的 browser 工具连 `browser.cdpUrl` | 占位端口 → 代理 → broker |
| 标注 | 面板进入标注模式后点选页面元素 | 只在面板自己发出 mouseup 后短暂开窗 |
| 页面 tab 操作 | 工具栏 / `browser_tab_*` | — |

## 数据流路径

```
start_session
  → BrowserManager::allocate(id)
       · 绑 127.0.0.1:0 得到占位端口
       · 写 <app cache>/browser/<pid>/<id>.yml:
             browser: { cdpUrl: "http://127.0.0.1:<port>", relay: false }
  → spawn omp 时追加 --config=<overlay>（**最后一个** token）

omp browser 工具
  → 连占位端口
  → proxy/peer.rs::same_user  （同 OS 用户校验，先于读请求）
  → proxy/http.rs::admit      （origin-form、单一 Host、禁浏览器专有头、/json* 外必须 Upgrade）
  → proxy/mod.rs::route       （未知路径 404、畸形 upgrade 400）
  → broker 会话（浏览器级或页面级）
  → Chromium（--remote-debugging-pipe，唯一边界）

面板
  → live.js → browser_* 命令 → view → broker 客户端
  → 帧: broker → Chromium screencast → panel channel（state/tabs/pick/frames）→ useBrowser
  → canvas 绘制；输入经 focus sink 回传；帧 ack 驱动流控
```

## 关键节点详解

| 节点 | 位置 | 核心逻辑 | 异常处理 |
|---|---|---|---|
| 浏览器发现 | `process/locate.rs` | 纯函数：按平台与位置顺序（Linux 真二进制优先、PATH 启动器最后；Chrome for Testing 位置随平台变） | 找不到 → 面板报错 |
| 启动 | `process/launch.rs` | 最多尝试 3 个候选；`--headless=new`、`--remote-debugging-pipe`、私有 `--user-data-dir`、`--disable-features=BackForwardCache` | 每候选记录 stderr 尾部 2 KiB；超时/pid 文件失败即停 |
| 懒启动 | `Slot::ensure` | 每次启动都重读设置；每标签页一把锁防重复启动 | 配置路径失效 → 511/503 错误，**不**回落其它浏览器 |
| broker | `broker/route.rs` | 每个客户端一个 root session，进出时增删 `sessionId`，id 映射回客户端自己的编号 | 客户端注册在路由 attach 应答时完成；detach 立即结束 |
| 准入 | `proxy/http.rs::admit` | 机械判据（见 [关键设计决策 D12](../02-功能结构和策略/关键设计决策.md)） | 拒绝 = 403，且**不会**触发启动 |
| 同用户校验 | `proxy/peer.rs` | Linux `/proc/net/tcp` uid；Windows `GetExtendedTcpTable` + 进程创建时间 + token SID；macOS `lsof` | 无法判定即拒绝（fail closed） |
| 观察 tap | `proxy/tap.rs` | 只观察不改传输；解析与 follow 回调在观察线程 | tap 失败只关闭该连接的观察，不影响转发 |
| 标注 | `annotate/` | 用 CSSOM（`element.style`）+ `textContent` 安装覆盖层，装进 `omp-annotate` 隔离世界 | 页面 CSP/Trusted Types 无法阻止 |
| 帧流控 | `view/frames.rs` | 面板未 ack 即停发 | — |

## 异常路径

| 异常 | 处理 |
|---|---|
| 无 app cache 目录（完全无法托管浏览器） | 启动时不带 overlay，面板没有浏览器（日志一次）；这是唯一允许"无浏览器运行"的情形 |
| 标签页分配失败 | `start_session` 失败 → 前端回滚关闭标签页（绝不静默无浏览器运行） |
| 候选浏览器崩溃/提前关闭调试管道 | 换下一个（≤3 次） |
| 全部候选失败 | 面板 channel 发 `error`，对 agent 返回 HTTP 503 |
| 非同一 OS 用户连接占位端口 | 不做任何应答直接关闭 |
| 请求头带 `Origin` / `Sec-Fetch-*` | 403（DNS rebinding 与网页驱动防护） |
| 超过并发上限 | 第 33 个已准入连接收到 503；超过未审核队列时最久等待者被切断 |
| WebSocket 非 UTF-8 二进制帧 | 以 1003 关闭该连接 |
| 单条命令/帧超 `MAX_COMMAND` | 只失败该连接 |
| agent 跟随（follow/hold） | 只读 tap 推断意图；不可推断时不改变面板焦点 |
| 回退缓存保留标注世界 | `--disable-features=BackForwardCache`（Chromium 只认最后一个该 flag） |

## 安全模型

- `--remote-debugging-pipe` 是唯一入口；broker 独占。**永远不要**加 `--remote-debugging-port`。
- Chromium 启动期间 `spawn_gate` 排他，防止其它子进程继承管道句柄。
- 占位端口对全机可见，因此准入分两层：连接级（内核态属主）+ 请求级（头部形状）。
- 面板不向 webview 暴露页面内容以外的能力；页面永不加载在应用 webview 里。

## 关联组件

- 纯逻辑：`OMP_BROWSER`（地址规范化、标注文本合并、坐标与 CDP 键事件、Esc 路由、chip、菜单行）、`OMP_BROWSER_SCREEN`（canvas、ack、输入）
- Rust：`browser/{mod,process,broker,proxy,view,annotate,cdp,wire,waiters,commands}.rs`
- 命令：`browser_settings`、`browser_set_path`、`browser_pick_path`、`browser_open_panel`、`browser_navigate`、`browser_history`、`browser_tab_*`、`browser_input`、`browser_frame_ack`、`browser_annotate`、`browser_capture`、`browser_scroll_to`
- 设置：`<app config>/browser.json`（`{path: ""}`）

## 相关业务流

→ 详见 [终端面板全链路](终端面板全链路.md)
→ 详见 [会话全生命周期](会话全生命周期.md)
