# Git Commit Checklist

## 每次提交前对照检查

### 1. 文件漏提检查

```bash
git status --short
```

- [ ] `package.json` 改了？确认 `git add` 包含了
- [ ] `package-lock.json` 改了？**必须和 `package.json` 一起提**
- [ ] 新增的 JS 文件？确认 `git add` 了
- [ ] New native module（`modules/*/`）？确认 `.gitignore` 没有误拦截

### 2. 新增依赖

```bash
npx expo install <package>
```

- [ ] 确认 `package.json` 和 `package-lock.json` 都有变化
- [ ] 提交时**这两个文件都要 `git add`**

### 3. 新增文件/目录

- [ ] 文件是否被 `.gitignore` 误拦截？
  - `.gitignore` 中的裸规则（如 `android/` 不带 `/` 前缀）会**递归匹配所有子目录**
  - 可以在 `.gitignore` 中加 `!modules/*/android/` 排除

### 4. 提交前验证

```bash
npm test                      # 测试必须通过
git add <files>               # 只提需要的文件
git status                    # 确认提交列表 = 你的预期
```

### 5. 提交信息

```
<版本号>: <一句话描述>

例：
1.2.71: check install permission before APK download
1.2.70: remove redundant brand header lines
1.2.69: export monthly/yearly report as PDF + share
```

---

## 历史踩坑记录

| 版本 | 症状 | 原因 | 预防 |
|------|------|------|------|
| 1.2.69 | CI 构建失败：找不到 `expo-print` | `npx expo install expo-print` 改了 `package.json`，但 `git add` 漏了 | 对照清单 #1 |
| 1.2.67 | Native 模块的 Android 代码没被 git 追踪 | `.gitignore` 中 `android/` 匹配了 `modules/*/android/` | 对照清单 #3 |
