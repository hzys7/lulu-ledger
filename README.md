# 小璐记账 (Lulu Ledger)

> 一款现代化的 AI 智能记账 APP，基于 Expo + React Native。

## 功能特性

### 📊 核心记账
- **首页仪表盘**：净资产总览 + 资金账户 + 快捷入口
- **记一笔**：智能分类选择 + 自定义数字键盘 + 消费心情标记
- **全部记录**：按日分组 + 搜索筛选 + 月份切换
- **统计分析**：周/月/年报 + 分类饼图 + 趋势折线图 + 对比柱状图
- **净资产**：多账户管理（微信/支付宝/银行卡/现金）+ 余额联动
- **预算管理**：按分类设定预算 + 实时进度追踪 + 超支预警

### 🤖 AI 智能功能
- **自然语言记账**：输入"昨天外卖35元"，AI 自动识别分类和金额
- **财务问答**：询问"这个月花了多少钱"，AI 实时分析回答
- **月度复盘**：AI 生成包含健康评分、消费画像、省钱建议的复盘报告
- **消费预测**：基于历史数据预测下月支出范围和趋势
- **消费心理分析**：结合心情数据，分析消费动机和行为模式
- **智能分类建议**：输入备注时自动推荐最可能的分类
- **消费目标追踪**：设定目标金额，AI 追踪进度并给出建议
- **异常消费检测**：自动识别异常消费模式并提醒
- **周期性消费检测**：发现重复消费模式（如每月订阅）

### 🎨 设计特色
- **极简风格**：现代极简设计，大量留白，细腻字间距
- **深色模式**：OLED 友好配色，降低屏幕刺眼感
- **自定义图表**：使用 react-native-svg 手绘饼图、折线图、柱状图
- **流畅交互**：优化的动画和手势，流畅的用户体验

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Expo SDK 56 / React Native 0.85 / React 19 |
| 导航 | React Navigation 7（底部 Tab + Stack） |
| 状态 | React Context（Settings/Books/Data 三层拆分） |
| 存储 | AsyncStorage + Schema 版本管理 |
| 图表 | react-native-svg 手绘组件 |
| AI | DeepSeek API + 本地规则引擎 |
| 构建 | GitHub Actions CI/CD + 自动更新 |
| 原生 | 本地 Expo 模块（APK 安装器） |

## 项目结构

```
.
├── App.js                     # 入口：路由配置
├── app.json                   # Expo 配置
├── src/
│   ├── screens/               # 12 个页面
│   │   ├── HomeScreen.js      # 首页仪表盘
│   │   ├── RecordsScreen.js   # 全部记录
│   │   ├── AddTransactionScreen.js  # 记一笔
│   │   ├── StatisticsScreen.js     # 统计分析
│   │   ├── NetWorthScreen.js       # 净资产
│   │   ├── BudgetScreen.js         # 预算管理
│   │   ├── AiChatScreen.js         # AI 记账
│   │   ├── AiQAScreen.js           # AI 问答
│   │   ├── AiMonthlyReportScreen.js # AI 月度复盘
│   │   ├── GoalScreen.js           # 消费目标
│   │   ├── SettingsScreen.js       # 设置
│   │   └── settings/              # 设置子页面
│   ├── components/            # 20+ 复用组件
│   │   ├── charts/            # 图表组件（饼图/折线/柱状）
│   │   ├── PieRing.js         # 环形饼图
│   │   ├── TransactionItem.js # 交易列表项
│   │   └── ...
│   ├── context/               # 全局状态（3 层 Context）
│   │   ├── SettingsContext.js  # 设置
│   │   ├── BooksContext.js     # 账本
│   │   └── DataContext.js      # 数据
│   ├── utils/                 # 30+ 工具函数
│   │   ├── ai*.js             # AI 功能模块（10+）
│   │   ├── storage.js         # 存储层
│   │   ├── currency.js        # 货币格式化
│   │   └── ...
│   ├── hooks/                 # 自定义 Hooks
│   └── theme/                 # 设计系统（颜色/间距/字号）
├── modules/                   # 本地 Expo 原生模块
│   └── lulu-apk-installer/    # APK 安装器
├── tools/                     # 工具脚本（图标生成等）
├── keys/                      # 签名密钥（不提交）
└── .github/workflows/         # CI/CD 配置
```

## 快速开始

### 开发环境

```bash
# 安装依赖
npm install

# 启动开发服务器
npx expo start

# 或使用 tunnel 模式（远程设备）
npx expo start --tunnel
```

### 构建 APK

```bash
# 1. 生成原生工程
npx expo prebuild --platform android --clean

# 2. 构建 Release APK
cd android && ./gradlew assembleRelease

# 3. 输出路径
# android/app/build/outputs/apk/release/app-release.apk
```

### CI/CD

推送到 `main` 分支后，GitHub Actions 自动：
1. 构建签名 APK + AAB
2. 上传为 Artifact（保留 90 天）
3. 触发自动更新检查

## AI 功能配置

在设置页面 → AI 配置 中：

1. 选择 AI 提供商（DeepSeek / OpenAI / 自定义）
2. 输入 API Key
3. 启用 AI 功能

支持的功能：
- 自然语言记账
- 财务问答
- 月度复盘报告
- 消费预测
- 心理分析

## 版本管理

- 版本号：`app.json` 的 `version` 字段
- 版本码：`android/app/build.gradle` 的 `versionCode`
- 保持两者同步

## 图标

- 当前图标：黑底圆角 + 白色"记"字 + 金色 ¥ 标识
- 生成脚本：`python tools/gen_icons.py`

## License

Private / 个人项目
