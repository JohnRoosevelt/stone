# Stone — 多平台版本管理与发布流水线

> 解决：①web 部署和 Tauri APK 各自一套版本号、对不齐；②手动上传 R2 流程碎；
> ③想加 macOS Intel 构建但没流水线。**目标：Git tag 一把梭，全平台产出一个 release。**

---

## 1. 现状

| 维度 | 当前做法 | 痛点 |
|---|---|---|
| 触发 | `build-android.yml`：`push to main` 或 `workflow_dispatch` | 任何 push 都打 APK，CI 浪费；web 部署靠 CF Pages git 集成 |
| 版本号 | CI 里 `jq` patch 写死 `0.1.${{ github.run_number }}` | 每次都 bump；web CF Pages 没版本号概念 |
| 产物分发 | R2：`apk/stone-<sha>-<ts>.apk` + `apk/stone-latest.apk` + `apk/update.json` | 旧 APK 保留 2 个，手工清理；无 changelog；无签名校验 |
| 客户端更新源 | `updater.svelte.js` 读 R2 公开 URL | 切 GitHub 后 URL 要改 |
| macOS 构建 | **没有** | 用户手动 `bun tauri build` 在自己 Mac 上出 .app |

## 2. 目标 / 设计原则

- **单一版本来源**：Git tag（`v0.2.0`）→ 所有平台用同一个版本号
- **一次 tag 全平台构建**：web + android + mac intel 并行 → 产物落 GitHub Release
- **保留 R2 作可选镜像**（暂不实现，先彻底用 GitHub Releases）
- **现状** `build-android.yml` 改造成支持 tag 触发 + 产物上传到 release
- **新增** `build-mac.yml`（macOS Intel runner）
- **新增** `release.yml`（编排 + 创建 GitHub Release）
- 不动 `main` 分支策略，不引入 `dev` 分支 / PR 流程（单人维护不需要）

## 3. 推荐方案

### 3.1 版本号 = Git tag

**核心规则**：
- 不在 `package.json` / `tauri.conf.json` 里手写版本号
- 所有版本号从 `git describe --tags --abbrev=0` 或 `github.ref_name` 取
- 发版流程：`git tag v0.2.0 && git push --tags`
- 客户端用 semver 校验（已有）

**`tauri.conf.json` 改造**：

```diff
- "version": "0.1.0"
+ "version": "$npm_package_version"
```

`$npm_package_version` 是 Tauri 2 支持的占位符，build 时从 `package.json` 读。
`package.json` 保持 `"version": "0.1.0"`（dev 用的占位）。CI 在打 release 时再用 `jq` 把它覆盖成 tag 里的版本号。

### 3.2 触发矩阵

| 事件 | 行为 | 涉及 workflow |
|---|---|---|
| `push to main` | CF Pages 自动 build + deploy（现状，不动）| CF Pages git 集成 |
| `push tag v*` | 全平台 release：web + android + mac → 产物落 GitHub Release | `release.yml` 编排 `build-android.yml` + `build-mac.yml` + `build-web.yml` |
| `workflow_dispatch` | 手动触发单个 build（用于重打 / 调试）| 每个 build workflow 都有 |

**全平台都触发吗？是的。** tag 推上去 = 三个 build job 并行跑，每个出产物，最后 release job 统一收集。
**调试想单平台？** 用 `workflow_dispatch` 单独跑那个 build workflow（不改 tag）。

### 3.3 workflow 文件结构

```
.github/workflows/
  build-android.yml   (改造) — 接受 tag 触发 + 产物上传到 release
  build-mac.yml       (新)   — macOS Intel runner, 出 .dmg / .app
  build-web.yml       (新)   — 跑 bun build + 部署到 CF Pages
  release.yml         (新)   — 编排：等所有 build 完成 → 创建 GitHub Release
```

**为什么不把 build 步骤都塞进 release.yml？** 三个平台 runner 完全不同（ubuntu / macos / ubuntu），
独立 file 让每个 workflow 可单独 trigger + cache + 失败重试。release.yml 只做"收集 + 发布"。

### 3.4 `build-android.yml` 改造

**触发**：
```yaml
on:
  push:
    tags: ['v*']
  workflow_dispatch:    # 保留，调试用
```

**版本号**：
```yaml
- name: Set version from tag
  run: |
    if [[ "${{ github.ref_type }}" == "tag" ]]; then
      VERSION="${${{ github.ref_name }}#v}"   # v0.2.0 → 0.2.0
    else
      VERSION="0.0.0-${{ github.run_number }}"  # 手动 dispatch 时用
    fi
    jq --arg v "$VERSION" '.version = $v' src-tauri/tauri.conf.json > tmp
    mv tmp src-tauri/tauri.conf.json
```

**产物上传**：改用 `softprops/action-gh-release`：
```yaml
- name: Upload to release
  if: startsWith(github.ref, 'refs/tags/v')
  uses: softprops/action-gh-release@v2
  with:
    files: |
      dist/stone.apk
      dist/update.json
    generate_release_notes: true
```

**删除**：R2 上传步骤 + 旧 APK 清理步骤（先彻底切 GitHub，R2 镜像以后再说）

### 3.5 `build-mac.yml`（新）

```yaml
name: Build macOS
on:
  push:
    tags: ['v*']
  workflow_dispatch:

jobs:
  build:
    runs-on: macos-latest      # Intel + Apple Silicon 通用 runner
    timeout-minutes: 60
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - name: Cache Rust target
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: src-tauri/target
      - name: Build
        run: |
          bun install --frozen-lockfile
          bunx tauri build --target universal-apple-darwin
      - name: Locate artifacts
        run: |
          # 找 .dmg 和 .app
          DMG=$(find src-tauri/target -name "*.dmg" | head -1)
          cp "$DMG" dist/stone.dmg
      - name: Upload to release
        if: startsWith(github.ref, 'refs/tags/v')
        uses: softprops/action-gh-release@v2
        with:
          files: dist/stone.dmg
```

**首次 build 慢（20+ 分钟）**：用 `Swatinem/rust-cache` 缓存 `target/`，第二次降到 5 分钟内。

**runner 选型**：
- `macos-latest`（Intel x86_64）足够——Apple Silicon runner 难申请
- 想要 universal binary：`--target universal-apple-darwin`（Tauri 2 支持）
- 想要纯 Apple Silicon：换 `macos-14`

### 3.6 `release.yml`（新，编排）

**两种实现**：

**方案 A（轻量）**：每个 build job 自己 `softprops/action-gh-release` 上传。release.yml 只做"创建空 release 占位 + 触发 build"。

**方案 B（标准）**：
```yaml
name: Release
on:
  push:
    tags: ['v*']

jobs:
  create-release:
    runs-on: ubuntu-latest
    outputs:
      upload_url: ${{ steps.create.outputs.upload_url }}
    steps:
      - uses: actions/create-release@v1   # 或 modern equivalent
        id: create
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: ${{ github.ref_name }}
          release_name: ${{ github.ref_name }}
          draft: false
          prerelease: false

  build-android:
    needs: create-release
    uses: ./.github/workflows/build-android.yml
    with:
      upload_url: ${{ needs.create-release.outputs.upload_url }}

  build-mac:
    needs: create-release
    uses: ./.github/workflows/build-mac.yml
    with:
      upload_url: ${{ needs.create-release.outputs.upload_url }}
```

**推荐方案 A**——更简单，每个 build 自己管自己的产物上传。`release.yml` 只在 web 部署上做"production deploy"标记。

### 3.7 客户端更新源切换

**`src/lib/updater.svelte.js`**：
```diff
- const MANIFEST_URL = "https://r2.lelexue.cn/apk/update.json";
+ const MANIFEST_URL = "https://github.com/<owner>/<repo>/releases/latest/download/update.json";
```

**`update.json` 格式不变**（前端不感知 URL 来源）：
```json
{
  "version": "0.2.0",
  "pub_date": "2026-06-03T07:00:00Z",
  "platforms": {
    "android": {
      "url": "https://github.com/<owner>/<repo>/releases/download/v0.2.0/stone-0.2.0.apk"
    }
  }
}
```

**`scripts/update/generate-manifest.sh`** 改造：URL 模板改用 GitHub release URL（用 `$GITHUB_REPOSITORY` env 注入 owner/repo）。

### 3.8 R2 留还是不留

| 方案 | 适用 |
|---|---|
| **彻底弃用**（先这样）| 接受 GitHub release 下载速度 |
| **保留作镜像** | 国内体验差时再启用，加个 release job step 同步 R2 |

**先彻底弃用**，两周后看反馈决定。

## 4. 边界 / 假设

- 单人维护，不需要 `dev` 分支 / PR 流程
- 不签名校验（APK 自身 keystore 签名；GitHub asset 有 SHA256）
- 不做 iOS / Windows build
- 不动 `tauri.conf.json` 其他字段
- macOS build 出 **universal binary**（Intel + Apple Silicon），不强求纯 Intel
- 第一次 build-mac 跑 30-60 分钟可接受（target cache 后会快很多）

## 5. 风险与缓解

| 风险 | 缓解 |
|---|---|
| tag 跟 main commit 不一致 | `git tag -d v0.2.0 && git push --delete origin v0.2.0` 重打 |
| macOS runner 排队慢 | 接受；如果超过 60min 失败，用 `macos-13` 备份 |
| `bunx tauri build` 在 macOS 第一次 30+ 分钟 | `Swatinem/rust-cache` 缓存 target；二次 5 分钟内 |
| GitHub Releases 国内慢 | 接受；观察两周 |
| 旧 R2 链接被客户端记住 | `update.json` 改 URL 后，客户端会读新 URL（域名变了）|

## 6. 实施步骤（按这个顺序，每步独立可验）

1. **`tauri.conf.json` version 改 `$npm_package_version`**
   - 验：`bun tauri dev` 跑起来，DebugInfo 显示 `0.1.0`
2. **改 `updater.svelte.js` 的 manifest URL → GitHub releases**
   - 验：手动 dispatch build-android，产物里有 `update.json` URL 指 GitHub
3. **改造 `build-android.yml`**：
   - 触发条件加 `tags: ['v*']`，版本号从 tag 读，产物上传改用 `softprops/action-gh-release`
   - 删 R2 上传 + 旧 APK 清理步骤
4. **新建 `build-mac.yml`**：macos-latest runner + universal-apple-darwin
5. **本地打 tag 试一次**：`git tag v0.2.0-test && git push --tags`
   - 预期：CI 跑出 release，所有产物到位
6. **清理 R2 引用**：从 secrets、`generate-manifest.sh`、文档中删除

## 7. 验证

- 打 `v0.2.0` tag → CI 跑完
- 预期产物：
  - `https://github.com/<owner>/<repo>/releases/tag/v0.2.0` 存在
  - release assets: `stone-0.2.0.apk` + `stone-0.2.0.dmg` + `update.json`
  - CF Pages 生产环境部署了新版本
- 客户端测：Tauri 里点"检查更新"，应能拉到 v0.2.0

## 8. 验证时间预估

| 步骤 | 首次 | 二次+ |
|---|---|---|
| 1 (占位符) | < 1 分钟（本地 build）| - |
| 2 (URL 改) | < 1 分钟 | - |
| 3 (build-android) | **20-30 分钟**（缓存后）| 5 分钟 |
| 4 (build-mac) | **30-60 分钟**（macOS runner + 无 cache）| 8-15 分钟 |
| 5 (打 tag) | 30-60 分钟（首次会慢）| 5-10 分钟 |
| 6 (清理) | < 5 分钟 | - |

**你担心的"验证时间太长"是步骤 3-5**。我能做的是：
- 步骤 1-2 完全本地搞定，不进 CI（< 5 分钟）
- 步骤 3-4 用 `workflow_dispatch` 单独触发，能并发跑；不上 tag 之前不发 release
- 步骤 5 才用 tag 触发"全平台一把梭"——这是最终验证，跑一次就够了

**Next step**：你说"开干"我从步骤 1 开始。或者你想先调整方案里的任何决策。
