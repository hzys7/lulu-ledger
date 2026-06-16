# 推送到 GitHub 操作指南

本仓库已经在本地初始化并提交完毕（commit `a345c57`），但**尚未推送到 GitHub**。以下是完成推送的步骤。

## 1. 在 GitHub 上创建空仓库

1. 打开 https://github.com/new
2. 填写：
   - **Owner**：你的 GitHub 用户名
   - **Repository name**：`lulu-ledger`（推荐）或 `记账APP`
   - **Description**：`小璐记账 - 现代化极简记账 APP`
   - **Visibility**：Private（推荐）/ Public
3. **不要**勾选 "Add a README file"、".gitignore"、"license"（我们本地已经有了）
4. 点击 "Create repository"

## 2. 选一种认证方式

### 方式 A：Personal Access Token (PAT) — 最简单

1. 打开 https://github.com/settings/tokens/new
2. Note: `lulu-ledger-push`
3. Expiration: 90 days
4. 勾选权限：**`repo`**（全部）和 **`workflow`**
5. 点击 "Generate token"
6. **复制 token**（只显示一次！）

然后告诉 Codex 这个 token，Codex 会帮你 push。

### 方式 B：SSH key — 更长期

```powershell
ssh-keygen -t ed25519 -C "your_email@example.com"
# 一路回车

# 显示公钥
cat ~/.ssh/id_ed25519.pub
```

把输出的公钥（以 `ssh-ed25519 ...` 开头）复制到 https://github.com/settings/keys/new

然后告诉 Codex "用 SSH"，Codex 会切换 remote 为 `git@github.com:你的用户名/lulu-ledger.git`。

## 3. 推送命令（如果自己来）

```powershell
cd C:\AI-code\记账APP

# PAT 方式
git remote add origin https://github.com/你的用户名/lulu-ledger.git
git push -u origin main
# 弹窗要求输入用户名和密码：用户名填 GitHub 用户名，密码填 PAT

# SSH 方式
git remote add origin git@github.com:你的用户名/lulu-ledger.git
git push -u origin main
```

## 4. 推送后建议

- 在 GitHub 仓库页面 → Settings → Collaborators → 邀请协作者（如果需要）
- Settings → Secrets and variables → Actions 准备一个 `LULU_KEYSTORE` secret（base64 编码的 keystore 文件），未来接 GitHub Actions 自动打包

## 5. 后续工作流

修改代码后：
```powershell
cd C:\AI-code\记账APP
git add -A
git commit -m "feat: 添加新功能"
git push
```

新机器 clone：
```powershell
git clone https://github.com/你的用户名/lulu-ledger.git
cd lulu-ledger
npm install
```