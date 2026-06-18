# 华为云首期部署说明

> 不要在任何配置文件、脚本或仓库中写入服务器密码、OpenAI API Key 或其他密钥。

## 1. 服务器安全基线

1. 更换已暴露的 root 密码。
2. 创建部署用户，例如 `arsdeploy`。
3. 为部署用户配置 SSH Key。
4. 禁用或限制 root 密码登录。
5. 华为云安全组仅开放：
   - `22/tcp`：SSH，仅允许可信 IP 更好。
   - `80/tcp`：HTTP。
   - `443/tcp`：HTTPS。
6. 后端服务只监听 `127.0.0.1:8787`，不要直接暴露到公网。

## 2. 目录建议

```text
/opt/agent-roundtable-studio
  app/
    backend/
    frontend/dist/
    deploy/
  data/
  logs/
  env/
```

## 3. 后端环境变量

示例：

```text
APP_ENV=production
BACKEND_HOST=127.0.0.1
BACKEND_PORT=8787
DATA_DIR=/opt/agent-roundtable-studio/data
AI_RUNTIME=simulated
OPENAI_API_KEY=
OPENAI_MODEL=
ALLOWED_ORIGINS=https://your-domain.example
```

真实 `OPENAI_API_KEY` 只能存在服务器环境或 secret 文件中。

## 4. Nginx 反向代理

```nginx
server {
    listen 80;
    server_name _;

    root /opt/agent-roundtable-studio/app/frontend/dist;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8787/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /health {
        proxy_pass http://127.0.0.1:8787/health;
    }
}
```

## 5. systemd 服务示例

```ini
[Unit]
Description=Agent Roundtable Studio Backend
After=network.target

[Service]
Type=simple
User=arsdeploy
WorkingDirectory=/opt/agent-roundtable-studio/app
EnvironmentFile=/opt/agent-roundtable-studio/env/backend.env
ExecStart=/usr/bin/node backend/src/server.mjs
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

## 6. 发布检查

- `npm test`
- `npm run build`
- `openspec validate web-mvp-frontend-backend --strict --no-interactive`
- 浏览器访问前端。
- 检查 `/health`。
- 完成一次问题输入到报告生成的端到端流程。
