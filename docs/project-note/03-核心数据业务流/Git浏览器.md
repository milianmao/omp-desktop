---
last_updated: 2026-10-25
source_files: [src-tauri/src/git_browser/, src-tauri/src/workspace.rs, src/app/git-browser.js, src/app/use-git-browser.jsx, src/design/git/, docs/architecture/git-browser.md]
related_memory: []
---

# Git 浏览器

覆盖活动标签页项目的全窗口浮层：文件树（带 git 状态）、整文件内联 diff、提交图。所有 git 读取在 Rust 用 gix 完成，webview 只保存视图状态。

## 触发点

| 触发 | 入口 | 说明 |
|---|---|---|
| 状态栏 git 按钮 | `design/chrome.jsx` | 打开在"第一个变更文件" |
| `desktop.panel.changes` | 默认 `Ctrl+Shift+G`（macOS `Shift+Cmd+G`） | 可改键 |
| 编辑工具卡的文件按钮 | `chat/tool-card.jsx` `onOpenFile(path)` | 直接打开到该文件 |
| 聊天里的文件链接 + Ctrl/⌘ | `handleChatLinkClick` | 预览 → git 浏览器 |
| 文件预览的"Open in git browser" | `chat/file-preview.jsx` | 用 Rust 的 project-relative 路径 |

## 数据流路径

```
open(gitOpen = {path, project})
  → useGitBrowser
     → invoke("git_browser_status", {path})
        → git_browser::open(path)
           · spawn_gate::discover（持有门禁 guard，读完才释放）
           · 在内存中剥掉仓库自身 config 的 filter driver
        → status.rs：HEAD→index / index→worktree 两层状态合并 → 折叠成 TreeNode
        → 返回 StatusView {repo, tree, changed, truncated}
     → invoke("git_browser_file", {path, relPath})      → FileView（内联行 diff）
     → invoke("git_browser_log", {path})                → LogView（--all 拓扑序 + lane 布局）
     → invoke("git_browser_commit", {path, sha})        → CommitView（vs 第一父提交）
     → invoke("git_browser_commit_file", {path, sha, relPath})
  → OMP_GIT_BROWSER 纯函数整形（树行、展开、筛选、hunk 起点、copy-diff 文本）
  → design/git/{file-tree,file-view,history,git-browser}.jsx 渲染

写操作（仅用户显式动作）
  → workspace_accept  (git add)
  → workspace_reject  (git checkout)
  → 返回后刷新整个浏览器
```

## 关键节点详解

| 节点 | 位置 | 核心逻辑 | 异常处理 |
|---|---|---|---|
| 仓库打开 | `git_browser/mod.rs` `open` | 相对路径以 **work dir** 为根；剥掉仓库级 filter driver | 非 git 仓库 → `Err("not a git repository")` 原样显示 |
| 状态合并 | `status.rs` | 未跟踪 → `Untracked`；index 新增 → `Added`；删除 → `Deleted`；重命名只显示新路径 | 超过 20 000 文件 → `truncated: true` |
| 内联 diff | `file.rs` | worktree bytes vs HEAD blob；worktree 侧走 filter 管线（`core.autocrlf`、`eol`/`text`），`core.safecrlf` 覆盖为 false | 二进制（前 8 KiB 有 NUL）、过大、缺失各有对应 `kind` |
| 提交图 | `log.rs` + `graph.rs` | HEAD + 所有 ref 的拓扑序，lane 布局有上限 | 截断标记 |
| 路径校验 | `workspace::validate_relative_path` | 拒绝 `..`、`.git` 组件、绝对路径 | 提交树内路径只做文本校验（不解析今天磁盘上的符号链接） |
| 过滤器风险 | `git_browser::open` | 仓库自己定义的 `filter.*.clean/process` 一律移除 | 用户/系统/环境级驱动保留（是用户自己的选择） |
| 子模块 | `status.rs` | 不进入子模块工作树；仅比较 commit | — |

## 异常路径

| 异常 | 处理 |
|---|---|
| 文件夹不是 git 仓库 | 浮层显示 Rust 的错误文本 |
| 文件已被删除 | `FileView.kind = "Missing"`；diff 全部为 `rem` |
| 文件是二进制/过大 | `kind = "Binary"` / `"TooLarge"`，状态而非错误 |
| 仓库含恶意 filter 驱动 | 仓库级驱动被移除，预览不会执行命令 |
| 预览时其它 Chromium 正在启动 | git 读取持有 spawn gate，Chromium 启动等它读完（防句柄继承） |
| 未暂存的重命名 | 旧路径 `Deleted` + 新路径 `Untracked`（与 `git status` 一致） |
| 无 upstream | `ahead`/`behind` 为 `null` |

## 安全边界

- webview 只发送：项目路径、项目相对文件路径、sha。**从不**发送 git 参数。
- 读取一律 gix；`git` 二进制只用于 stage/discard（用户显式动作）。
- 在 `git_browser/` 里加 `git` 子进程会重新引入 PATH 与输出解析问题——这是已被移除的旧做法。

## 关联组件

- 纯逻辑：`OMP_GIT_BROWSER`
- Rust：`git_browser/{mod,status,file,log,graph,commit}.rs`、`workspace.rs`
- 命令：`git_browser_status`、`git_browser_file`、`git_browser_log`、`git_browser_commit`、`git_browser_commit_file`、`workspace_accept`、`workspace_reject`
- 组件：`design/git/{file-tree,file-view,history,git-browser}.jsx`

## 相关业务流

→ 详见 [会话全生命周期](会话全生命周期.md)（git 监视随标签页启动与停止）
→ 详见 [浏览器面板与CDP代理](浏览器面板与CDP代理.md)（共用 spawn gate）
