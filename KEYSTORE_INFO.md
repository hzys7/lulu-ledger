# Release Keystore 管理

## 重要警告

**`keys/` 目录下的 keystore 文件是 APP 签名的唯一凭证，丢失意味着无法升级已安装的 APP —— 用户必须卸载重装，数据丢失。**

请在多个位置备份（云盘 + U 盘 + 邮箱附件 等）。

## 当前 keystore

| 项目 | 值 |
| --- | --- |
| 文件 | `keys/lululedger-release.keystore` |
| 别名 | `lululedger` |
| 密码 | 见你的本地密码管理器（不要提交到这里） |
| 有效期 | 25 年（生成时起） |
| 算法 | RSA 2048 |

**密码默认值（仅供本地参考，不要提交到 Git）**：`lululedger2026`

## 重新生成 keystore

```powershell
$env:JAVA_HOME = ''C:\Android\jdk-17''
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
& keytool -genkeypair -v `
  -keystore ''C:\AI-code\记账APP\keys\lululedger-release.keystore'' `
  -alias lululedger `
  -keyalg RSA -keysize 2048 -validity 9125 `
  -storepass lululedger2026 -keypass lululedger2026 `
  -dname ''CN=Lulu Ledger, OU=Personal, O=Lulu, L=Shanghai, ST=Shanghai, C=CN''
```

**生成后**：
1. 把 `.keystore` 文件备份到至少 2 个不同位置（云盘/U 盘等）
2. **永远不要把 keystore 文件 push 到 Git**（`.gitignore` 已包含 `*.keystore` 和 `keys/`，但 `.gitkeep` 例外）
3. **永远不要把密码 commit 到代码** —— `app/build.gradle` 的默认值仅供本地开发参考

## 在另一台机器上构建

如果你 clone 了这个 repo 到另一台机器，想要重新打包 APK：

1. 把 keystore 文件放到 `keys/lululedger-release.keystore`
2. 用环境变量覆盖默认值：
   ```powershell
   $env:LULU_KEYSTORE_FILE = ''C:\path\to\keys\lululedger-release.keystore''
   $env:LULU_KEYSTORE_PASS = ''your_password''
   $env:LULU_KEY_ALIAS = ''lululedger''
   $env:LULU_KEY_PASS = ''your_password''
   cd android
   .\gradlew assembleRelease
   ```

`app/build.gradle` 的 `signingConfigs.release` 会优先读取环境变量，没有就 fallback 到 `keys/lululedger-release.keystore` + 默认密码。

## 验证 APK 签名

```powershell
& apksigner verify --print-certs --verbose app-release.apk
```

应看到 `Verified using v2 scheme (APK Signature Scheme v2): true`，且证书 DN 包含 `CN=Lulu Ledger`。