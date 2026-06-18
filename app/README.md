# Agent Roundtable Studio Web MVP

首期 Web 版采用前后端分离的代码结构，部署时收敛为单容器服务：

- `backend/`：Node 原生 HTTP API，负责任务画像、Agent 匹配、圆桌编排、结构化事件、报告生成。
- `frontend/`：静态 Web 前端，负责问题工作台、Agent 推荐、圆桌现场、Agent 库、输出中心。
- `deploy/`：Docker Compose、华为云部署脚本和 `8181` 网关分发配置。

当前默认使用模拟 AI Runtime，保证不配置 OpenAI API Key 也能端到端验证。

## 本地运行

开发模式可以分别启动后端和前端：

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

单服务模式可以先构建前端，再由后端同时提供页面、API 和健康检查：

```powershell
cd D:\AI\AIchat\outputs\agent-roundtable-studio-open-spec\app
npm run build
node backend/src/server.mjs
```

访问：

```text
http://127.0.0.1:8787/
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

首期上线采用 Docker Compose + 现有 `8181` 网关，不新增公网端口白名单。

部署前先处理安全：

1. 更换已暴露的 root 密码。
2. 创建非 root 部署用户。
3. 配置 SSH Key 登录。
4. 限制或禁用 root 密码登录。
5. 安全组仅开放 SSH 和已有 `8181` 网关端口。
6. 生产密钥使用服务器环境变量或独立 secret 文件，不提交到源码。

部署形态：

```text
gateway-nginx-8181
  /agent-roundtable-studio/        -> agent-roundtable-studio:8787/
  /agent-roundtable-studio/api/    -> agent-roundtable-studio:8787/api/
  /agent-roundtable-studio/health  -> agent-roundtable-studio:8787/health
```

应用容器不直接映射公网端口，数据挂载到：

```text
/opt/agent-roundtable-studio/data
```

部署脚本：

```bash
cd /opt/agent-roundtable-studio/repo/app
bash deploy/scripts/deploy-container.sh
BASE_URL=http://113.44.223.11:8181/agent-roundtable-studio bash deploy/scripts/remote-smoke.sh
```

完整说明见：

```text
deploy/huawei-cloud.md
```
