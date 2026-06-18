# 华为云首期部署说明

> 不要在任何配置文件、脚本或仓库中写入服务器密码、OpenAI API Key 或其他密钥。

## 1. 部署结论

首期 Web 版本采用容器化微服务部署：

- 对外入口：`gateway-nginx-8181` 继续作为统一公网入口，路径为 `/agent-roundtable-studio/`。
- Java API 服务：`agent-roundtable-studio` 容器，对外提供静态页面、`/api/*` 和 `/health`。
- Python AI Orchestrator：`ai-orchestrator-python` 容器，负责任务画像、Agent 编排、圆桌生成和模型供应商调用。
- 持久化数据：挂载到 `/opt/agent-roundtable-studio/data`，容器内路径为 `/data`。
- 端口策略：不新增公网白名单端口，Java 和 Python 容器都不直接暴露公网端口。

访问地址：

```text
http://113.44.223.11:8181/agent-roundtable-studio/
```

## 2. 服务器安全基线

1. 更换已暴露的 root 密码。
2. 创建部署用户，例如 `arsdeploy`。
3. 为部署用户配置 SSH Key。
4. 禁用或限制 root 密码登录。
5. 华为云安全组仅开放必要端口：
   - `22/tcp`：SSH，建议仅允许可信 IP。
   - `8181/tcp`：统一网关入口。
6. Java 和 Python 容器只加入内部 Docker 网络，不直接暴露公网端口。

## 3. 目录结构

```text
/opt/agent-roundtable-studio
  repo/
    app/
      backend-java/
      ai-orchestrator-python/
      frontend/
      deploy/
  data/
  env/
```

## 4. 环境变量

服务器环境文件：

```text
/opt/agent-roundtable-studio/env/backend.env
```

示例：

```text
APP_ENV=production
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8787
APP_BASE_PATH=/agent-roundtable-studio
STATIC_ROOT=/app/frontend/dist
AI_ORCHESTRATOR_URL=http://ai-orchestrator-python:8790
AI_ORCHESTRATOR_TIMEOUT_MS=90000
ORCHESTRATOR_HOST=0.0.0.0
ORCHESTRATOR_PORT=8790
DATA_DIR=/data
AI_RUNTIME=openai
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
OPENAI_API_MODE=chat_completions
OPENAI_API_KEY=
OPENAI_MODEL=qwen-plus
OPENAI_TIMEOUT_MS=45000
OPENAI_MAX_RETRIES=1
ALLOWED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173,http://113.44.223.11:8181,https://113.44.223.11:8181
```

真实 `OPENAI_API_KEY` 只能存在服务器环境或 secret 文件中，不能提交到 GitHub。

## 5. Docker Compose

Compose 文件位于：

```text
app/deploy/docker-compose.yml
```

部署后会创建两个主容器：

```text
agent-roundtable-studio
ai-orchestrator-python
```

二者加入同一个内部网络，Java 服务通过容器名访问 Python 服务：

```text
http://ai-orchestrator-python:8790
```

## 6. 8181 网关分发

网关片段位于：

```text
app/deploy/gateway-8181-agent-roundtable-snippet.conf
```

需要放入 `gateway-nginx-8181` 的 HTTP 和 HTTPS server block 中：

```nginx
location = /agent-roundtable-studio {
    return 301 /agent-roundtable-studio/;
}

location = /agent-roundtable-studio/health {
    proxy_pass http://agent-roundtable-studio:8787/health;
}

location /agent-roundtable-studio/api/ {
    proxy_pass http://agent-roundtable-studio:8787/api/;
}

location /agent-roundtable-studio/ {
    proxy_pass http://agent-roundtable-studio:8787/;
}
```

## 7. 自动化部署

仓库提供以下脚本：

- `deploy/scripts/deploy-container.sh`：拉取代码、构建前端、编译 Java、校验 Python、启动两个容器、检查健康、reload 8181 网关。
- `deploy/scripts/remote-smoke.sh`：对已部署站点执行线上烟测。

首次部署：

```bash
cd /opt/agent-roundtable-studio/repo/app
bash deploy/scripts/deploy-container.sh
BASE_URL=http://113.44.223.11:8181/agent-roundtable-studio bash deploy/scripts/remote-smoke.sh
```

## 8. 发布检查

- `docker ps` 中存在 `agent-roundtable-studio` 和 `ai-orchestrator-python`，状态为 running。
- `docker exec agent-roundtable-studio curl -fsS http://127.0.0.1:8787/health` 通过。
- `docker exec ai-orchestrator-python python -m py_compile /app/ai-orchestrator-python/src/orchestrator.py` 通过。
- `docker exec gateway-nginx-8181 nginx -t` 通过。
- `docker exec gateway-nginx-8181 nginx -T 2>/dev/null | grep 'agent-roundtable-studio:8787'` 能看到 `/agent-roundtable-studio` 实际转发到 Java API 服务。
- `BASE_URL=http://113.44.223.11:8181/agent-roundtable-studio bash deploy/scripts/remote-smoke.sh` 通过。
- `http://113.44.223.11:8181/` 原有服务仍可访问，不能被本应用覆盖。

## 9. 旧部署方式

旧的宿主机 systemd + 宿主机 Nginx 方式仅保留为历史参考，不再作为首期推荐上线方式。当前上线以 Docker Compose + `8181` 网关为准。
