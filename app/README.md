# Agent Roundtable Studio Web MVP

首期 Web 版采用前后端分离：

- `backend/`：Node 原生 HTTP API，负责任务画像、Agent 匹配、圆桌编排、结构化事件、报告生成。
- `frontend/`：静态 Web 前端，负责问题工作台、Agent 推荐、圆桌现场、Agent 库、输出中心。

当前默认使用模拟 AI Runtime，保证不配置 OpenAI API Key 也能端到端验证。

## 本地运行

```powershell
cd D:\AI\AIchat\outputs\agent-roundtable-studio-open-spec\app
node backend/src/server.mjs
```

另开一个终端：

```powershell
cd D:\AI\AIchat\outputs\agent-roundtable-studio-open-spec\app
node frontend/server.mjs
```

访问：

```text
http://127.0.0.1:5173
```

后端健康检查：

```text
http://127.0.0.1:8787/health
```

## 验证

```powershell
npm test
npm run build
npm run validate:openspec
```

## 环境变量

复制 `.env.example` 为部署环境变量参考，不要把真实密钥写入仓库。

首期默认：

```text
AI_RUNTIME=simulated
```

接入真实模型时，后端必须只从服务端环境读取 `OPENAI_API_KEY`，前端不得接触密钥。

## 华为云部署建议

部署前先处理安全：

1. 更换已暴露的 root 密码。
2. 创建非 root 部署用户。
3. 配置 SSH Key 登录。
4. 限制或禁用 root 密码登录。
5. 安全组仅开放 SSH、HTTP、HTTPS。
6. 生产密钥使用服务器环境变量或独立 secret 文件，不提交到源码。

部署形态：

```text
Nginx
  /       -> frontend/dist
  /api    -> backend 127.0.0.1:8787
```

后端推荐使用 `systemd` 或进程管理器守护。
