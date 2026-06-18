import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..", "..");

function normalizeBasePath(value) {
  if (!value || value === "/") return "";
  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  return withLeadingSlash.replace(/\/+$/, "");
}

function normalizeBaseUrl(value) {
  return (value || "https://api.openai.com/v1").replace(/\/+$/, "");
}

export function loadConfig(overrides = {}) {
  const env = { ...process.env, ...overrides };
  const dataDir = path.resolve(appRoot, env.DATA_DIR || "./backend/data");
  const openaiBaseUrl = normalizeBaseUrl(env.OPENAI_BASE_URL);
  const openaiApiMode = env.OPENAI_API_MODE
    || (openaiBaseUrl.includes("api.openai.com") ? "responses" : "chat_completions");

  return {
    appEnv: env.APP_ENV || "development",
    host: env.BACKEND_HOST || "127.0.0.1",
    port: Number(env.BACKEND_PORT || 8787),
    appBasePath: normalizeBasePath(env.APP_BASE_PATH || ""),
    dataDir,
    storeFile: path.join(dataDir, "store.json"),
    aiRuntime: env.AI_RUNTIME || "simulated",
    openaiBaseUrl,
    openaiApiMode,
    openaiApiKey: env.OPENAI_API_KEY || "",
    openaiModel: env.OPENAI_MODEL || "gpt-4.1-mini",
    openaiTimeoutMs: Number(env.OPENAI_TIMEOUT_MS || 30000),
    openaiMaxRetries: Number(env.OPENAI_MAX_RETRIES || 2),
    allowedOrigins: (env.ALLOWED_ORIGINS || "http://127.0.0.1:5173,http://localhost:5173")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  };
}
