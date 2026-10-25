// i18n-zh-logic.js — Simplified Chinese dictionary for strings produced by
// pure logic modules: live.js notes, goal, turn status, terminal-xterm
// exit lines, marked-setup "Copy code", etc.
// Filled by the logic i18n step; keys are the exact English source strings.
// Keys that other dictionaries already carry ("goal", "off", "Session",
// "Agent", "Copy code", "{n} lines", "Wait for the current turn to
// finish.") are intentionally absent here: addLang merges into one zh
// table and a duplicate key would trip test-i18n's hygiene check.
(function () {
  window.OMP_I18N.addLang("zh", {
    // ── app/terminal-xterm.js — exit / failure lines (ANSI verbatim) ──
    "\r\n\x1b[2mshell exited{code} \u2014 press Enter to restart\x1b[0m\r\n":
      "\r\n\x1b[2mshell 已退出{code} \u2014 按 Enter 重启\x1b[0m\r\n",
    "\r\n\x1b[31mcould not start the shell: {error}\x1b[0m \u2014 press Enter to retry\r\n":
      "\r\n\x1b[31m无法启动 shell：{error}\x1b[0m \u2014 按 Enter 重试\r\n",

    // ── live.js — agent exit / startup failure notes ──────────────────
    "**Agent process exited:** {reason}": "**智能体进程已退出：** {reason}",
    "**This profile has no model credentials yet.**": "**此配置文件还没有模型凭据。**",
    "omp's RPC mode refuses to start without a usable model, so this tab has no agent — which is also why `/login` and the provider list do nothing here.":
      "omp 的 RPC 模式在没有可用模型时拒绝启动，因此此标签页没有智能体——这也是 `/login` 和提供商列表在此处不起作用的原因。",
    "Log in once from a terminal, then reopen the tab:": "请先在终端登录一次，然后重新打开此标签页：",
    "omp reported: {reason}": "omp 报告：{reason}",

    // ── live.js — respawn / open / restore notes ──────────────────────
    "Profile switch": "配置文件切换",
    "Approval mode change": "审批模式变更",
    "**{what} failed:** {error}": "**{what} 失败：** {error}",
    "**Could not open project:** {error}": "**无法打开项目：** {error}",
    "**Could not reopen tabs whose folder no longer exists:**": "**无法重新打开文件夹已不存在的标签页：**",
    "**Could not reopen {name}:** {error}": "**无法重新打开 {name}：** {error}",
    "a tab": "某个标签页",

    // ── live.js — asks, goal, rename, approvals, branch/fork ──────────
    "Enter value…": "输入值…",
    "Describe the goal first.": "请先描述目标。",
    "Not connected": "未连接",
    "Rename failed: {error}": "重命名失败：{error}",
    "**Approve and remember failed:** {error}. The prompt is open again.": "**批准并记住失败：** {error}。该提示已重新打开。",
    "**Approved, but the rule was not saved:** {detail}": "**已批准，但规则未保存：** {detail}",

    // ── app-live.jsx — plan comments, login ───────────────────────────
    "Line comments:": "逐行意见：",
    "**Login failed ({name}):** {error}": "**登录失败（{name}）：** {error}",

    // ── app/goal.js — composer gate ───────────────────────────────────
    "Exit plan mode first: omp does not start a goal in plan mode.": "请先退出计划模式：omp 不会在计划模式下开始目标。",
    "This tab already has a goal. Drop it, or let it complete, to start another.": "此标签页已有目标。请先丢弃它或等它完成，才能开始新的目标。",
    "Plan mode is off while this tab has a goal.": "此标签页有目标时，计划模式不可用。",

    // ── app/goal.js — strip ───────────────────────────────────────────
    "you stopped the turn": "你停止了这个回合",
    "wrapping up": "正在收尾",
    "budget used up": "预算已用完",
    "stopped": "已停止",
    "unknown": "未知",
    // CHIPS (stripView); TONES are CSS-facing and stay English.
    "active": "进行中",
    "paused": "已暂停",
    "budget reached": "预算已达",
    "complete": "已完成",

    // ── app/goal.js — transcript rows (fmtSeconds + rowView) ─────────
    "{n} s": "{n} 秒",
    "{m} min {s} s": "{m} 分 {s} 秒",
    "{m} min": "{m} 分",
    "goal set": "目标已设定",
    "budget {budget}": "预算 {budget}",
    "no budget": "无预算",
    "goal paused": "目标已暂停",
    "goal resumed": "目标已恢复",
    "omp asked the agent to wrap up": "omp 已请智能体收尾",
    "goal complete": "目标已完成",
    "goal dropped": "目标已丢弃",
    "continuing toward the goal": "正在朝目标继续",

    // ── app/session-prefs.js — busy-close dialog ──────────────────────
    // ("retrying a failed request" lives in i18n-zh-shell.js already.)
    "working": "工作中",
    "waiting for your answer": "等待你的回答",
    "running background jobs": "正在运行后台任务",
    "untitled tab": "未命名标签页",
    "Close a busy tab?": "关闭繁忙的标签页？",
    "This tab's agent is still at work. Closing the tab stops it.": "此标签页的智能体仍在工作，关闭标签页会将其停止。",
    // ("close tab" lives in i18n-zh-settings.js / i18n-zh-shell.js already.)
    "Quit with a busy tab?": "有一个繁忙的标签页，仍要退出吗？",
    "Quit with {n} busy tabs?": "有 {n} 个繁忙的标签页，仍要退出吗？",
    "A tab's agent is still at work. Quitting stops it.": "某个标签页的智能体仍在工作，退出会将其停止。",
    "These tabs' agents are still at work. Quitting stops them.": "这些标签页的智能体仍在工作，退出会将它们停止。",
    "quit": "退出",

    // ── app/message-queue.js — refusal note (fence kept at the site) ──
    "Steer": "转向",
    "Follow-up": "追问",
    "**{what} not sent:** {error}": "**{what} 未发送：** {error}",

    // ── app/turn-status.js ────────────────────────────────────────────
    "Provider request failed": "提供商请求失败",

    // ── app/updater.js ────────────────────────────────────────────────
    "update check failed": "检查更新失败",
    "update failed": "更新失败",

    // ── app/widgets.js — parse / run error text ───────────────────────
    "stdout is not JSON": "stdout 不是 JSON",
    "stdout is not a JSON object": "stdout 不是 JSON 对象",
    "plugin reports an invalid version, this desktop supports {supported}": "插件报告的版本无效，本桌面支持 {supported}",
    "plugin reports version {reported}, this desktop supports {supported}": "插件报告的版本为 {reported}，本桌面支持 {supported}",
    "output has no \"blocks\" array": "输出缺少 \"blocks\" 数组",
    "plugin printed no output": "插件没有输出",

    // ── app/keymap.js — action labels (ids never) ─────────────────────
    "Interrupt turn": "中断回合",
    "Cycle thinking level": "切换思考级别",
    "Cycle model forward": "向后切换模型",
    "Cycle model backward": "向前切换模型",
    "Select model": "选择模型",
    "Toggle plan mode": "切换计划模式",
    "Send message": "发送消息",
    "New session": "新建会话",
    "Resume session": "恢复会话",
    "Command bridge": "命令桥",
    "Session history": "会话历史",
    // "Keyboard shortcuts", "Approvals", "Prompt history" and
    // "Check for updates" live in i18n-zh-settings.js already.
    "Open settings": "打开设置",
    "Toggle project sidebar": "切换项目侧边栏",
    "Toggle browser panel": "切换浏览器面板",
    "New tab": "新建标签页",
    "Close tab": "关闭标签页",
    "Next tab": "下一个标签页",
    "Previous tab": "上一个标签页",
    "Move tab left": "左移标签页",
    "Move tab right": "右移标签页",
    "Plan kanban": "计划看板",
    "Git browser": "Git 浏览器",
    "Usage statistics": "用量统计",
    "Compact session": "压缩会话",
    "Export session to HTML": "将会话导出为 HTML",
    "Collapse all blocks": "折叠全部卡片",
    "Expand all blocks": "展开全部卡片",
    "Toggle terminal": "切换终端",

    // ── app/slash-commands.js — hints + group names (names never) ─────
    "draft a plan before writing code": "写代码前先拟一份计划",
    "start a goal the agent works on until done": "开始一个由智能体持续完成的目标",
    "interrupt and redirect mid-tool": "在工具执行中打断并转向",
    "compact context window": "压缩上下文窗口",
    "start a fresh session (history kept on disk)": "开始全新会话（历史保留在磁盘上）",
    "browse and resume saved sessions": "浏览并恢复已保存的会话",
    "re-ask a prompt or fork, from the conversation tree": "从会话树重问一条提示词或分叉",
    "conversation tree with prompt-cache status": "带提示词缓存状态的会话树",
    "switch model": "切换模型",
    "cycle thinking level": "切换思考级别",
    "authenticate with a model provider": "向模型提供商登录认证",
    "open the kanban surface": "打开看板视图",
    "open the browser panel; /browser <url> loads a page": "打开浏览器面板；/browser <url> 加载页面",
    "export this session to HTML": "将此会话导出为 HTML",
    "view and rebind keyboard shortcuts": "查看并重新绑定键盘快捷键",
    "open settings": "打开设置",
    "collapse every tool card and thinking block in this tab": "折叠此标签页的全部工具卡片与思考块",
    "expand every tool card and thinking block in this tab": "展开此标签页的全部工具卡片与思考块",
    "check for OMP Desktop updates": "检查 OMP Desktop 更新",
    "show or hide this tab's shell panel": "显示或隐藏此标签页的 shell 面板",
    "Mode": "模式",
    "View": "视图",
    "Commands": "命令",
    "Skills": "技能",
    "Custom": "自定义",

    // ── app/browser.js — /browser notes ───────────────────────────────
    "**/browser:** the panel shows this tab's page itself, so there is no `{mode}` mode to switch. `/browser <url>` loads a page.":
      "**/browser：**面板本身就显示此标签页的页面，没有可切换的 `{mode}` 模式。`/browser <url>` 用于加载页面。",
    "**/browser:** `{input}` is not a web address.": "**/browser：**`{input}` 不是网页地址。",

    // ── app/use-goal-mode.jsx ─────────────────────────────────────────
    "could not read omp's setting": "无法读取 omp 的设置",
    "could not change the setting": "无法更改设置",
    "Could not start the goal.": "无法开始目标。",

    // ── app/use-keymap.jsx ────────────────────────────────────────────
    "Keybinding configuration could not be loaded.": "无法加载按键绑定配置。",

    // ── app/use-git-browser.jsx ───────────────────────────────────────
    "this tab has no project folder": "此标签页没有项目文件夹",
    "Delete {path}? It has no committed version — this cannot be undone.": "删除 {path}？它没有已提交的版本——此操作无法撤销。",

    // ── app/use-pane-widths.jsx — handle aria labels ──────────────────
    "resize project sidebar": "调整项目侧边栏宽度",
    "resize subagent pane": "调整子智能体面板宽度",
    "resize ambient rail": "调整卡片栏宽度",
    "resize conversation tree": "调整会话树宽度",
  });
})();
