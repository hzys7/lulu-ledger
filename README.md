# 璐璐记账 (Lulu Ledger)

> 一款现代化的极简记账 APP，基于 Expo + React Native。

## 功能

- 首页：收支总览 + 消费记录 + 月份/收入支出切换
- 统计：扇形图分类占比 + 月度趋势 + 月度对比
- 记一笔：添加/编辑/删除交易
- 净资产：管理多账户（微信/支付宝/银行卡）+ 余额联动
- 设置：预算管理、数据导出等

## 技术栈

- Expo SDK 56 / React Native 0.85 / React 19
- React Navigation 7（底部 Tab + Stack）
- AsyncStorage 持久化
- react-native-svg 自绘图表
- TypeScript-free（纯 JS）

## 目录结构

```
.
|-- App.js                  # 入口：Tab + Stack 路由
|-- app.json                # Expo 配置（包名/图标/splash）
|-- assets/                 # 静态资源（图标的最终 PNG）
|-- src/
|   |-- context/            # FinanceContext（全局状态）
|   |-- screens/            # 5 个主屏
|   |-- components/         # 复用组件
|   |-- utils/              # 工具：存储/格式化
|   `-- theme.js            # 主题色/间距/字号
|-- tools/                  # 工具脚本（图标生成 + 签名 patch）
|   |-- gen_icons.py        # 记字图标生成
|   |-- gen_cat_icon.py     # 小猫头像图标生成（备选）
|   `-- patch-build-gradle.js  # 给 prebuild 后的 build.gradle 注入 release 签名
|-- keys/                   # 签名 keystore（不提交，详见 KEYSTORE_INFO.md）
|-- android/                # Prebuild 生成的原生工程（不提交，gitignore）
|-- .github/workflows/      # GitHub Actions 配置
|-- .gitignore
`-- package.json
```

## 开发环境

```bash
npm install
npx expo start
npx expo start --tunnel
```

## 打包 Android APK

详细步骤见 [BUILD.md](./BUILD.md)。简要：

1. 安装 JDK 17 到 C:\Android\jdk-17
2. 安装 Android SDK（cmdline-tools + platform-tools + build-tools 35 + platforms android-35）
3. 接受所有 SDK licenses
4. 生成 release keystore（见 [KEYSTORE_INFO.md](./KEYSTORE_INFO.md)）
5. `npx expo prebuild --platform android --clean`
6. `cd android && ./gradlew assembleRelease`
7. APK 输出：`android/app/build/outputs/apk/release/app-release.apk`

## 持续集成 (GitHub Actions)

`.github/workflows/build-android.yml` 在每次 push 到 main 时自动构建签名后的 APK + AAB，并把产物上传为 Artifact（保留 90 天）。

需要的 GitHub Secrets（[配置说明](./KEYS_SETUP.md)）：

- `LULU_KEYSTORE_BASE64` - keystore 的 base64 编码
- `LULU_KEYSTORE_PASS` - keystore 密码
- `LULU_KEY_ALIAS` - 密钥别名
- `LULU_KEY_PASS` - 密钥密码

手动触发：https://github.com/hzys7/lulu-ledger/actions → 选 workflow → "Run workflow"。

## 版本号

- 修改 `android/app/build.gradle` 的 `versionCode` + `versionName`
- 修改 `app.json` 的 `version`（保持同步）

## 图标

- 当前图标：黑底圆角 + 白色"记"字 + 金色 ¥ 标识
- 源：`tools/gen_icons.py`（用 PIL 绘制）
- 改色/换字后 `python tools/gen_icons.py` 重新生成

## License

Private / 个人项目。