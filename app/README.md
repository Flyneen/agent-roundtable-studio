# Agent Roundtable Studio Web

首期 Web 版已从 Node 单体原型调整为 Java + Python 微服务容器化架构：

- `backend-java/`：Java API Gateway，对外提供静态页面、`/api/*`、`/health`，并保持 8181 网关路径兼容。
- `ai-orchestrator-python/`：Python AI Orchestrator，负责任务画像、Agent 选择、个人 Agent 自动补位、结构化圆桌、报告生成和 OpenAI-compatible 模型调用。
- `frontend/`：静态 Web 前端，展示问题工作台、任务画像、Agent 组建过程、运行证据、圆桌事件和报告。
- `backend/`：旧 Node 原型，仅保留作历史参考，不再作为主后端路径。
- `deploy/`：Docker Compose、华为云部署脚本和 8181 网关配置。

生产路径不再把 `simulated` 当主运行时。未配置真实 API Key 时，Python Orchestrator 会明确标记为 `dev_degraded_missing_key` 或 `dev`，用于联调，不作为生产质量验收。

## 本地运行

构建前端：

```powershell
cd D:\AI\AIchat\outputs\agent-roundtable-studio-open-spec\app
npm run build
```

启动 Python AI Orchestrator：

```powershell
$env:AI_RUNTIME="dev"
$env:ORCHESTRATOR_HOST="127.0.0.1"
$env:ORCHESTRATOR_PORT="8790"
$env:DATA_DIR="./ai-orchestrator-python/data"
python ai-orchestrator-python/src/orchestrator.py
```

另开终端启动 Java API Gateway：

```powershell
cd D:\AI\AIchat\outputs\agent-roundtable-studio-open-spec\app
.\backend-java\build.ps1
$env:BACKEND_HOST="127.0.0.1"
$env:BACKEND_PORT="8787"
$env:APP_BASE_PATH=""
$env:STATIC_ROOT="./frontend/dist"
$env:AI_ORCHESTRATOR_URL="http://127.0.0.1:8790"
java -cp backend-java/build/classes com.ars.AgentRoundtableGateway
```

访问：

```text
http://127.0.0.1:8787/
```

## 真实模型运行

不要使用已暴露过的 Key。重新生成供应商 Key 后，只写入服务器环境变量或 secret 文件。

阿里 DashScope OpenAI-compatible 示例：

```text
AI_RUNTIME=openai
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
OPENAI_API_MODE=chat_completions
OPENAI_API_KEY=<只写服务器环境>
OPENAI_MODEL=qwen-plus
OPENAI_TIMEOUT_MS=45000
OPENAI_MAX_RETRIES=1
```

## 验证

本地基础验证：

```powershell
npm run build
python -m py_compile ai-orchestrator-python/src/orchestrator.py
.\backend-java\build.ps1
```

真实 UI 验收：

```powershell
npm install --no-save playwright
npx playwright install chromium
$env:BASE_URL="http://113.44.223.11:8181/agent-roundtable-studio"; npm run test:ui
```

远程烟测：

```bash
BASE_URL=http://113.44.223.11:8181/agent-roundtable-studio bash deploy/scripts/remote-smoke.sh
```

## 华为云部署

部署形态：

```text
gateway-nginx-8181
  /agent-roundtable-studio/        -> agent-roundtable-studio:8787/
  /agent-roundtable-studio/api/    -> agent-roundtable-studio:8787/api/
  /agent-roundtable-studio/health  -> agent-roundtable-studio:8787/health

agent-roundtable-studio            -> Java API Gateway
ai-orchestrator-python             -> Python AI Orchestrator
/opt/agent-roundtable-studio/data  -> 持久化数据
```

部署脚本：

```bash
cd /opt/agent-roundtable-studio/repo/app
bash deploy/scripts/deploy-container.sh
BASE_URL=http://113.44.223.11:8181/agent-roundtable-studio bash deploy/scripts/remote-smoke.sh
```
