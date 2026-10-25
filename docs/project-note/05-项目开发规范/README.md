---
last_updated: 2026-10-25
source_files: [AGENTS.md, package.json, .github/workflows/, src-tauri/Cargo.toml]
related_memory: []
---

# 05 · 项目开发规范

本分类回答"写代码、写测试、提交与发布要遵守什么"。全部规则可追溯到 `AGENTS.md` 或真实配置文件。

| 文档 | 一句话摘要 | 什么时候读 |
|---|---|---|
| [编码规范](编码规范.md) | 通用原则、Rust（工具链/`Result<T,String>`/克隆阶梯/async/七个 unsafe 模块）、前端（无打包器/IIFE 规则/唯一别名/CSP）、God-file 上限与拆分规则、命名与放置约定、评审 Do/Don't 21 条 | 动手写代码前 |
| [测试策略](测试策略.md) | JS 45 个回归脚本的三种加载写法与 `npm test` 双注册规则；Rust 的 `#[cfg(test)]`、`test_support.rs`、按套件分文件的测试、真实 Chromium 测试与 `OMP_REQUIRE_CHROMIUM=1`；"什么算覆盖"；按改动类型的验证矩阵；实测清单数字 | 写测试、判断"这个改动要不要加测试" |
| [Git工作流与CI](Git工作流与CI.md) | 分支与三种合入形态、提交前缀实测统计、三个 workflow 的逐字引用、发布七步、签名密钥不变量、本地验证代替 Actions | 提交、开 PR、发版、改 CI |

## 四条最容易被忽略的硬要求

1. **`cargo fmt` → `cargo test --locked` → pedantic+nursery clippy**，CI 不跑 clippy，必须本地跑。
2. **新增 `src/app/*.js` 或 `tests/*.mjs`** 必须同时进 `package.json` 的 `test` 链和 `test:<name>` 脚本。
3. **新增加载文件** 必须插到 `src/index.html` 的正确位置（按依赖顺序），绝不追加到末尾。
4. **新增 `live.js` 发送的 RPC 命令** 必须加进 `ALLOWED_COMMAND_TYPES`，否则 Rust 侧测试会失败。

→ 返回 [知识库总索引](../README.md)
→ 详见 [已知问题与陷阱](../06-迭代与变更/已知问题与陷阱.md)
