# 配置 GitHub Actions 自动构建

Workflow 文件 `.github/workflows/build-android.yml` 已配置好。要让 CI 成功签名 APK，需要在 GitHub 仓库添加 4 个 **Secrets**（仓库设置 → Secrets and variables → Actions → New repository secret）。

## 1. 把 keystore 文件转成 base64

```powershell
$bytes = [System.IO.File]::ReadAllBytes(''C:\AI-code\记账APP\keys\lululedger-release.keystore'')
$base64 = [Convert]::ToBase64String($bytes)
$base64 | Set-Content -Path ''keystore-base64.txt'' -Encoding ASCII -NoNewline
Get-Content ''keystore-base64.txt''
```

把输出的整段 base64 字符串（很长，单行）复制下来。

## 2. 在 GitHub 添加 4 个 Secrets

打开 https://github.com/hzys7/lulu-ledger/settings/secrets/actions → "New repository secret"，逐个添加：

| Secret 名称 | 值 |
| --- | --- |
| `LULU_KEYSTORE_BASE64` | 上面 base64 转换的整段字符串 |
| `LULU_KEYSTORE_PASS` | `lululedger2026`（或者你后来改的密码） |
| `LULU_KEY_ALIAS` | `lululedger` |
| `LULU_KEY_PASS` | `lululedger2026`（或者你后来改的密码） |

> **注意**：Secret 名称必须**完全一致**（区分大小写），workflow 文件里硬编码了这些名字。

## 3. 触发构建

### 自动触发
push 到 `main` 分支即自动触发。

### 手动触发
打开 https://github.com/hzys7/lulu-ledger/actions → 选 "Build Android APK" → 点 "Run workflow"。

## 4. 下载产物

构建完成后（约 14 分钟首次，后续 5-8 分钟）：

1. 进 https://github.com/hzys7/lulu-ledger/actions
2. 点最新的 workflow run
3. 滚到页面底部 "Artifacts" 区域
4. 下载 `lulu-ledger-apk`（或 `lulu-ledger-aab`）

Artifacts 保留 90 天，过期前记得下载到本地。

## 5. 如果构建失败

常见错误：

### "Could not find signingConfigs block in build.gradle"
Expo SDK 大版本升级导致 `app/build.gradle` 结构变化。修复 `tools/patch-build-gradle.js` 里的正则。

### "Keystore was tampered with, or password was incorrect"
检查 4 个 Secrets 值是否正确。注意 `LULU_KEYSTORE_PASS` 和 `LULU_KEY_PASS` 默认值相同（keystore 密码和 key 密码一致），但你可以设置成不同。

### Gradle 依赖下载超时
首次构建 ~14 分钟，正常。如果卡在 30+ 分钟，cancel 后重试。

## 6. 升级到多架构（可选）

当前只打 `arm64-v8a`（覆盖 99% 现代手机）。如果想给老设备用：

编辑 `.github/workflows/build-android.yml`，把两处：

```yaml
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
./gradlew bundleRelease -PreactNativeArchitectures=arm64-v8a
```

改成：

```yaml
./gradlew assembleRelease
./gradlew bundleRelease
```

但首次构建会从 14 分钟涨到 30+ 分钟。