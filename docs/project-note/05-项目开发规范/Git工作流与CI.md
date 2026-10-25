---
last_updated: 2026-10-25
source_files: [AGENTS.md, CHANGELOG.md, .github/workflows/tests.yml, .github/workflows/ci.yml, .github/workflows/release.yml, .github/scripts/updater-json.mjs, package.json, src-tauri/Cargo.toml, src-tauri/tauri.conf.json, src-tauri/tauri.release.conf.json]
related_memory: []
---

# Git 工作流与 CI

本文记录仓库的分支/合并实践、提交信息规范、三个 GitHub Actions 工作流、发布流程，以及用本地命令替代 Actions 分钟数的验证方式。所有命令均逐字取自工作流文件或 `AGENTS.md`。

## 一、分支与合并实践

以下结论只来自 `git log` 的事实（430 个提交、54 个 merge commit），不含推测性流程规定。

### 1.1 历史形态

- 主干为 `master`（`origin/HEAD -> origin/master`），本地与远端只有这一个长期分支；`main` 只出现在 `ci.yml` 的 `branches` 列表中，历史里没有 `main` 分支的提交。
- 工作分支短生命周期，合入后删除；分支名以类型前缀开头，统计 54 条 merge 信息中的前缀分布：`fix/` 24、`feat/` 18、`chore/` 4、`bugfix/` 1。
- 功能/修复分支通过 PR 或本地 `git merge` 合入 `master`，然后由 `chore: release vX.Y.Z` 提交打点。没有 tag 驱动的日常提交。

### 1.2 三种可见的合入方式

| 形态 | 提交信息示例 |
|---|---|
| GitHub PR 合并 | `15f67b3 Merge pull request #67 from unclesamwk/feat/remote-push-when-locked` |
| 本地分支合并 | `e657dc7 Merge branch 'feat/settings-page-37': Settings page as an app tab (#37)` |
| 单提交携带 PR 号（squash 风格） | `bec9424 feat(settings): Settings page as an app tab, replacing the Tweaks panel (#37)` |

补充观察：

- `git log` 中 64 条提交信息含 `(#NN)`，即 PR 号写在标题末尾，而非正文 footer。
- 同步上游用 merge 而非 rebase：`8ddfe0b Merge remote-tracking branch 'origin/master' into fix/local-network-usage`。
- 合入前常有一段 `fix(<scope>): address PR #NN review findings…` 的评审修正提交（例：`03b5014`、`783de88`、`f2471fe`），即评审意见以新提交的形式留在分支上，而非 amend 到原提交。
- 多人协作：`ApoC`、`Miroslav Drbal`、`Samuel Warkentin` 为主要作者；PR 分别来自 `unclesamwk`、`apoc`、`isfrustratedprogrammer`、`deepNraj` 等分支。
- 本地克隆不含 tag（`git tag` 为空），tag 与 release 的对应关系只能从 `chore: release vX.Y.Z` 提交与 `CHANGELOG.md` 的版本小节推断 [待核实]。

## 二、提交信息规范

采用 Conventional Commits 风格：`<type>(<scope>): <英文小写描述>`。实测前缀分布（非 merge 提交）：`fix` 157、`feat` 105、`chore` 34、`test` 16、`refactor` 28、`docs` 21、`ci` 4、`perf` 3。

| 前缀 | 用途 | 真实示例 |
|---|---|---|
| `feat(scope):` | 新功能 | `dfa846b feat(remote): detect screen lock on Windows and Linux`<br>`dc8601d feat(remote): send push notifications only while the desktop is locked`<br>`06fcb1f feat(widgets): attention signal for rail plugins` |
| `fix(scope):` | 缺陷修复 | `408b6c0 fix(settings): keep pairing countdown interval independent of onClose identity`<br>`ef36523 fix(remote): validate the whole mailto contact address`<br>`2a5903f fix(widgets): insert-target review follow-ups` |
| `test(scope):` | 只改测试 | `c544a2d test(browser): tolerate only macOS EINVAL on set_read_timeout after shutdown`<br>`2123a59 test(remote): order collision test actions by tab, not arrival`<br>`d284479 test(workspace): assert git argv instead of spawning a fake git` |
| `refactor:` / `refactor(scope):` | 不改行为的重构 | `2173a27 refactor: deduplicate test helpers and pairing state in PR-touched files`<br>`2141353 refactor(remote): split push.rs`<br>`767e886 refactor(settings): schema rows drive custom-row labels and visibility (#37)` |
| `chore: release vX.Y.Z` | 版本发布提交 | `81bafc0 chore: release v0.12.1`<br>`26f916f chore: release v0.12.0`<br>`7e6ba11 chore: release v0.11.0` |
| `ci:` | 工作流本身 | `7e1f89e ci: run on Node 24 (checkout/setup-node v5)`<br>`a450a63 ci: run the full test suite in CI and before every release build`<br>`9987875 ci: assemble updater feed once after all signed builds` |
| `docs(scope):` | 文档 | `6405179 docs(config): qualify memory-only store comments and list memory-only stores`<br>`6406b7d docs(browser): document the reworked browser panel`<br>`044af3d docs: slim AGENTS.md, move feature internals to docs/architecture` |
| `perf:` | 性能 | `5dc3dde perf: precompile JSX for release builds (startup ~1.7s -> ~0.1s)`<br>`2b4d668 perf: memo bubble components + stable message IDs + useCallback handlers`<br>`f489f48 perf: trim oldest message row when 13x13 minimap grid fills; fix grid to 13 cols` |

约定细节：

- `scope` 与代码目录对齐：`(widgets)` 40 次、`(remote)` 20 次、`(browser)` 15 次、`(terminal)` 12 次，此外有 `(settings)`、`(approval)`、`(agent)`、`(workspace)`、`(macos)`、`(windows)` 等平台/模块名。
- 描述用英文、小写起句、无句末句号；一个提交一件事，可用分号并列（见 `4e4ada7`、`d284479`）。
- 标题可携带 PR 号 `(#37)`；少量历史提交不带前缀（`init: omp-desktop — Tauri shell for omp --mode rpc`、`feat: plan mode`、`Merge …` 之外仅 1 条），属早期遗留，不构成新约定。

## 三、三个工作流

### 3.1 `tests.yml` — 可复用测试门禁

唯一被 `workflow_call` 调用的工作流，CI 与发布共用同一套测试，二者无法漂移。

```yaml
name: Tests

on:
  workflow_call:

permissions:
  contents: read
```

两个 job：

| job | `name` | 运行环境 | 关键步骤 |
|---|---|---|---|
| `rust` | `cargo test · ${{ matrix.os }}` | matrix `os: [windows-latest, ubuntu-22.04, macos-latest]`，`fail-fast: false` | `dtolnay/rust-toolchain@stable`；`swatinem/rust-cache@v2`（`workspaces: src-tauri`）；Linux 装 `libwebkit2gtk-4.1-dev` 等；`working-directory: src-tauri` 下 `cargo test --locked` |
| `js` | `JS regression scripts` | `ubuntu-latest` | `actions/setup-node@v5` + `node-version: '24'`，然后 `npm test` |

关键环境变量：`rust` job 的 `cargo test` 步骤设 `OMP_REQUIRE_CHROMIUM: "1"`。文件内注释说明其语义：runner 镜像自带 Google Chrome，找不到浏览器时真实 Chromium 测试**失败**而不是静默跳过。`AGENTS.md` 的 Commands 表给出同一开关（本地默认跳过）。

`js` job 无需 `npm ci`：`npm test` 是一串零依赖的 `node tests/test-*.mjs`。

### 3.2 `ci.yml` — PR 与主干推送

```yaml
name: CI

on:
  push:
    branches: [main, master]
    paths:
      - 'src-tauri/**'
      - 'src/**'
      - 'tests/**'
      - 'package.json'
      - 'scripts/**'
      - '.github/scripts/**'
      - '.github/workflows/ci.yml'
      - '.github/workflows/tests.yml'
  pull_request:
    branches: [main, master]
```

- 唯一 job：`test`，内容为 `uses: ./.github/workflows/tests.yml`。
- `paths` 过滤只作用于 `push`；`pull_request` 无 paths 限制，因此任何 PR 都会跑全量测试。
- 纯文档/CHANGELOG 改动在 `master` 上不触发 CI（不在 paths 列表内），但那次提交若通过 PR 合入仍会跑。
- 文件头注释明确不做打包：`# No bundle build here — that lives in release.yml.`

### 3.3 `release.yml` — tag 驱动的发布流水线

```yaml
name: Release

on:
  push:
    tags:
      - 'v[0-9]+.[0-9]+.[0-9]+'       # v1.2.3
      - 'v[0-9]+.[0-9]+.[0-9]+-*'     # v1.2.3-beta.1
  workflow_dispatch:                    # allow manual trigger from Actions UI
    inputs:
      tag:
        description: 'Tag to build (e.g. v0.2.0)'
        required: true
```

并发与命名：

```yaml
concurrency:
  group: release-${{ inputs.tag || github.ref_name }}
  cancel-in-progress: false
```

一个 tag 只允许一次运行（两次运行写同一个 draft 会交错）。`env.TAG` 同为 `${{ inputs.tag || github.ref_name }}`，被两个下游 job 共用。

三个 job：

1. `test` — `uses: ./.github/workflows/tests.yml`。测试不过则后续 job 不启动。
2. `build`（`name: build · ${{ matrix.label }}`）— `needs: test`，`permissions.contents: write`，matrix：

   | `label` | `os` | `args` / `rust-target` |
   |---|---|---|
   | `windows-x64` | `windows-latest` | `''` |
   | `macos-arm64` | `macos-latest` | `--target aarch64-apple-darwin` |
   | `macos-x64` | `macos-latest` | `--target x86_64-apple-darwin` |
   | `linux-x64` | `ubuntu-22.04` | `''` |

   步骤顺序要点：先跑 `Require updater signing key`（检查 `secrets.TAURI_SIGNING_PRIVATE_KEY` 非空，秒级失败而非编译后失败）→ `setup-node@v5`（`node-version: '24'`，`cache: npm`）→ `rust-toolchain@stable` → rust-cache → Linux 系统依赖（多装 `squashfs-tools`）→ `npm ci` → `tauri-apps/tauri-action@v0`；Linux 另跑 `Check AppImage file modes (Linux only)` 检查 AppImage 内文件权限位（`AppRun`/目录/可执行位对非 root uid 必须可用）。

   发布参数：`includeUpdaterJson: false`（feed 由下一个 job 统一生成）、`releaseDraft: true`（人工审阅后再发布）、`prerelease: ${{ contains(env.TAG, '-') }}`，构建参数 `args: ${{ matrix.args }} --config src-tauri/tauri.dist.conf.json --config src-tauri/tauri.release.conf.json`。
3. `updater-json`（`name: updater feed (latest.json)`）— `needs: build`，`runs-on: ubuntu-latest`，`permissions.contents: write`。先 `gh release download "$TAG" --repo "$GITHUB_REPOSITORY" --pattern '*.sig' --dir sigs`，再执行：

   ```
   node .github/scripts/updater-json.mjs \
     --sigdir sigs \
     --repo "$GITHUB_REPOSITORY" \
     --tag "$TAG" \
     --app-version "$(jq -r .version src-tauri/tauri.conf.json)" \
     --changelog CHANGELOG.md \
     > latest.json
   ```

   随后用 `jq -e '(.version | length > 0) and (.platforms | length > 0)' latest.json` 防止空/截断文件上线，最后 `gh release upload "$TAG" latest.json --repo "$GITHUB_REPOSITORY" --clobber`。

`updater-json` 为何集中一次生成（`.github/scripts/updater-json.mjs` 头部注释）：四个并行 build job 各自读改写同一 release asset 会丢更新，静默把某平台从 feed 里删掉。脚本在缺少某平台的签名产物时退出 1；对 stable tag 与 `tauri.conf.json` 版本不一致也报错——那意味着忘了 bump 版本，feed 会宣告旧版本，导致已在旧版本的安装永远收不到更新（prerelease tag 例外，因为 `releases/latest/` 不服务 prerelease）。

用户可见时机：应用读 `releases/latest/download/latest.json`，因此发布只有在 draft 被人工发布且未标记 pre-release 后才到达用户。

### 3.4 手动 dry run

Actions → Release → Run workflow，或：

```
gh workflow run release.yml --ref <branch> -f tag=vX.Y.Z-rc.N
```

用 `-rc.N` 前缀 tag 构建所选分支/ref，产出以该 tag 命名的 draft；验证完删除 draft。**不得**用已发布的 tag 做 dry run——其 asset 会被覆盖。`AGENTS.md` 同时规定：仅当用户要求时才做 dry run。

## 四、发布流程（`AGENTS.md` § Changelog workflow）

`CHANGELOG.md` 遵循 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)。开发期每个用户可见改动写入顶部 `## [Unreleased]`，置于 `### Added` / `### Fixed` / `### Changed` 之下。

用户说 "release X.Y.Z" 时执行七步：

1. 把 `## [Unreleased]` 改名为 `## [X.Y.Z] - YYYY-MM-DD`（当天日期）。
2. 在其上方插入新的空 `## [Unreleased]`。
3. 把 `src-tauri/Cargo.toml` 与 `src-tauri/tauri.conf.json` 的 `version` 改为 `X.Y.Z`。
4. 更新 `src-tauri/Cargo.lock`：`cargo update --manifest-path src-tauri/Cargo.toml --package omp-desktop`。
5. 提交：`git add CHANGELOG.md src-tauri/Cargo.toml src-tauri/tauri.conf.json src-tauri/Cargo.lock && git commit -m "chore: release vX.Y.Z"`。
6. 打 tag：`git tag vX.Y.Z`。
7. 推送：`git push origin master --tags`。

历史印证：`81bafc0`、`26f916f` 等 release 提交的 `--stat` 恰为四个文件（`CHANGELOG.md`、`src-tauri/Cargo.lock`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`），与第 5 步的 `git add` 列表一致。

版本一致性：`release.yml` 头部前置条件要求 `src-tauri/tauri.conf.json` 与 `src-tauri/Cargo.toml` 的版本和 tag 一致（去掉前导 `v`）。

### 4.1 签名密钥不变量

- `bundle.createUpdaterArtifacts` 只存在于 `src-tauri/tauri.release.conf.json`，因此本地 `npm run build` 不会因为没有密钥而失败。
- 更新签名私钥只存在于仓库 secret `TAURI_SIGNING_PRIVATE_KEY`（及可选 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`），**永不入库**。
- 这是 minisign 密钥，与 Authenticode / Apple 公证无关；应用只接受其公钥（`src-tauri/tauri.conf.json` 的 `plugins.updater.pubkey`）签名的构建。
- 私钥丢失 = 已安装的副本再也无法验证任何更新；轮换密钥会让所有已安装副本失联。上游建议保留备份。
- macOS 未配置证书时按 `bundle.macOS.signingIdentity "-"` 临时签名（未签名包在 Apple Silicon 上会显示为"已损坏"，#60）；公证需 `APPLE_CERTIFICATE`、`APPLE_CERTIFICATE_PASSWORD`、`APPLE_SIGNING_IDENTITY`、`APPLE_ID`、`APPLE_PASSWORD`、`APPLE_TEAM_ID`。Windows Authenticode 通过 `windows.certificateThumbprint` 配置。

→ 更新机制的客户端实现见 [技术栈与中间件](../01-架构总览/技术栈与中间件.md)；`latest.json` 与 updater 的契约细节见 [部署与运行架构](../01-架构总览/部署与运行架构.md)。

## 五、本地验证替代 Actions

`AGENTS.md` § CI / release 明确：Actions 分钟数有限，进行中的分支先在本地验证，dry run 只在用户要求时做。

| 目的 | 本地命令 | 对应工作流步骤 |
|---|---|---|
| 全部 JS 回归 | `npm test` | `tests.yml` 的 `js` job |
| 单个 JS 回归 | `node tests/test-<name>.mjs`（或 `npm run test:<name>`） | 同上，按需缩小 |
| Rust 测试 | `cd src-tauri && cargo test` | `tests.yml` 的 `rust` job（CI 额外加 `--locked`） |
| 真实 Chromium 测试不跳过 | `OMP_REQUIRE_CHROMIUM=1`（环境变量，再跑 `cargo test`） | CI 同一开关 |
| 类型/编译检查 | `cd src-tauri && cargo check --locked` | 已包含在 `cargo test --locked` 中 |
| 格式 | `cd src-tauri && cargo fmt` | CI **不**检查 |
| Lint | `cd src-tauri && cargo +nightly clippy --all-targets --all-features -- -W clippy::pedantic -W clippy::nursery -D warnings` | CI **不**运行；`clippy.toml` 的 `disallowed-methods`（`spawn_gate` 之外的 `Command::spawn` 等）只在此生效 |
| 前端产物（`dist/` + CSP 检查 + `?v=` 打戳） | `npm run build:frontend` | 发布链的隐含前置（也是 `npm test` 的最后一步） |
| 打包冒烟（不产出安装包） | `npx tauri build --no-bundle --config src-tauri/tauri.dist.conf.json` | `release.yml` 的 build 步骤去掉 bundle |

注意两条"本地有、CI 无"的检查项：`cargo fmt` 与 nightly clippy（含 `clippy.toml` 的 `disallowed-methods`）只在本地跑，CI 不跑 clippy。因此交 PR 前必须自行执行，否则 pedantic/nursery 的告警（`redundant_clone`、`too_many_arguments`、`assigning_clones`）会在合并后才暴露。

`npm run build`（`tauri build --config src-tauri/tauri.dist.conf.json`）没有签名密钥，会因为没有 `createUpdaterArtifacts` 而正常产包；它不能替代 `release.yml` 的验收。

→ 测试分层与覆盖要求见 [测试策略](./测试策略.md)；提交前代码风格细节见 [编码规范](./编码规范.md)；版本演进见 [版本历史](../06-迭代与变更/版本历史.md)。
