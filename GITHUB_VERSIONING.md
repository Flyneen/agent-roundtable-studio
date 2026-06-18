# GitHub 版本管理说明

## 仓库范围

建议只把当前目录作为独立仓库：

```text
D:\AI\AIchat\outputs\agent-roundtable-studio-open-spec
```

不要把整个 `D:\AI\AIchat` 纳入 Git。这个目录里已经包含：

- OpenSpec 正式规格。
- Web MVP 变更提案、设计、任务。
- 首期 Web MVP 应用代码。
- 部署说明。

## 推荐分支

```text
main
  稳定主线，保存已验证版本。

feature/web-mvp
  首期 Web MVP 开发分支。
```

## 推荐提交节奏

1. `chore: initialize openspec web mvp repository`
2. `feat: add web mvp backend simulated runtime`
3. `feat: add web mvp frontend workspace`
4. `docs: add huawei cloud deployment guide`
5. `test: add smoke test for roundtable workflow`

## 提交前检查

```powershell
npm test
npm run build
npm run validate:openspec
git status --short
```

## 部署前检查

```powershell
openspec validate --all --strict --no-interactive
npm test
npm run build
git diff --check
```

部署完成后运行远程烟测：

```bash
BASE_URL=http://113.44.223.11:18080 bash /opt/agent-roundtable-studio/app/deploy/scripts/remote-smoke.sh
```

## GitHub 远程仓库创建方式

方式一：网页创建。

1. 打开 GitHub。
2. 新建仓库，例如 `agent-roundtable-studio`。
3. 不要勾选初始化 README、`.gitignore` 或 License。
4. 回到本地执行：

```powershell
git remote add origin https://github.com/<your-user-or-org>/agent-roundtable-studio.git
git branch -M main
git push -u origin main
```

方式二：安装并登录 GitHub CLI 后创建。

```powershell
gh repo create agent-roundtable-studio --private --source . --remote origin --push
```

## 安全要求

- 不提交 `.env`。
- 不提交服务器密码。
- 不提交 OpenAI API Key。
- 不提交 SSH 私钥。
- 不提交运行数据目录。
- 部署前必须更换已经暴露过的服务器 root 密码。
