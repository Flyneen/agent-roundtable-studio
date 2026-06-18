# 华为云首期部署说明

> 不要在任何配置文件、脚本或仓库中写入服务器密码、OpenAI API Key 或其他密钥。

## 1. 部署结论

首期 Web 版本采用容器化部署：

- 应用服务：单个 `agent-roundtable-studio` 容器，同时提供前端静态页面、`/api/*` 和 `/health`。
- 持久化数据：挂载到 `/opt/agent-roundtable-studio/data`，容器内路径为 `/data`。
- 公网入口：复用已有 `gateway-nginx-8181`，路径为 `/agent-roundtable-studio/`。
- 端口策略：不新增公网白名单端口，应用容器不直接映射公网端口。

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
6. 应用容器只加入内部 Docker 网络，不直接暴露公网端口。

## 3. 目录结构

```text
/opt/agent-roundtable-studio
  repo/
    app/
      backend/
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
DATA_DIR=/data
AI_RUNTIME=simulated
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_MODE=responses
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
OPENAI_TIMEOUT_MS=30000
OPENAI_MAX_RETRIES=2
ALLOWED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173,http://113.44.223.11:8181,https://113.44.223.11:8181
```

真实 `OPENAI_API_KEY` 只能存在服务器环境或 secret 文件中，不能提交到 GitHub。

如果接入阿里或其他 OpenAI-compatible 服务，服务器环境变量改为：

```text
AI_RUNTIME=openai
OPENAI_BASE_URL=<第三方 OpenAI-compatible base url>
OPENAI_API_MODE=chat_completions
OPENAI_API_KEY=<只写在服务器环境或 secret 中>
OPENAI_MODEL=<第三方模型名称>
```

不要把真实 Key 写入仓库、前端或文档。已经暴露过的 Key 必须在供应商侧作废后重新生成。

## 5. Docker Compose

Compose 文件位于：

```text
app/deploy/docker-compose.yml
```

部署后会创建容器：

```text
agent-roundtable-studio
```

容器加入外部网络：

```text
1panel-network
```

如果 `gateway-nginx-8181` 不在该网络中，部署脚本会把网关容器连接到该网络，使 Nginx 可以通过容器名访问：

```text
http://agent-roundtable-studio:8787
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

完整片段包含必要的 `X-Forwarded-*` 头和 `proxy_redirect off`，以文件内容为准。

## 7. 自动化部署

仓库提供以下脚本：

- `deploy/scripts/deploy-container.sh`：从 GitHub 拉取代码、构建镜像、运行容器、检查容器健康、reload 8181 网关。
- `deploy/scripts/deploy-from-github.sh`：兼容入口，当前会转到容器化部署脚本。
- `deploy/scripts/remote-smoke.sh`：对已部署站点执行线上烟测。

首次部署：

```bash
cd /tmp
git clone https://github.com/Flyneen/agent-roundtable-studio.git
cd agent-roundtable-studio/app
bash deploy/scripts/deploy-container.sh
BASE_URL=http://113.44.223.11:8181/agent-roundtable-studio bash deploy/scripts/remote-smoke.sh
```

后续更新：

```bash
cd /opt/agent-roundtable-studio/repo/app
git pull --ff-only origin main
bash deploy/scripts/deploy-container.sh
BASE_URL=http://113.44.223.11:8181/agent-roundtable-studio bash deploy/scripts/remote-smoke.sh
```

## 8. 发布检查

- `docker ps` 中存在 `agent-roundtable-studio`，状态为 running。
- `docker exec agent-roundtable-studio node --input-type=module -e "const r = await fetch('http://127.0.0.1:8787/health'); if (!r.ok) process.exit(1);"` 通过。
- `docker exec gateway-nginx-8181 nginx -t` 通过。
- `BASE_URL=http://113.44.223.11:8181/agent-roundtable-studio bash deploy/scripts/remote-smoke.sh` 通过。
- `http://113.44.223.11:8181/` 原有服务仍可访问，不能被本应用覆盖。

## 9. 旧部署方式

旧的宿主机 systemd + 宿主机 Nginx `18080/443` 方式仅保留为历史参考，不再作为首期推荐上线方式。当前上线以 Docker Compose + `8181` 网关为准。
