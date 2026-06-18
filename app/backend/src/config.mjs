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

function normalizeRuntime(value, appEnv) {
  const runtime = String(value || "").trim().toLowerCase();
  if (runtime === "openai") return "openai";
  if (runtime === "dev" || runtime === "development" || runtime === "simulated") return "dev";
  return appEnv === "production" ? "openai" : "dev";
}

export function loadConfig(overrides = {}) {
  const env = { ...process.env, ...overrides };
  const dataDir = path.resolve(appRoot, env.DATA_DIR || "./backend/data");
  const openaiBaseUrl = normalizeBaseUrl(env.OPENAI_BASE_URL);
  const openaiApiMode = env.OPENAI_API_MODE
    || (openaiBaseUrl.includes("api.openai.com") ? "responses" : "chat_completions");
  const appEnv = env.APP_ENV || "development";

  return {
    appEnv,
    host: env.BACKEND_HOST || "127.0.0.1",
    port: Number(env.BACKEND_PORT || 8787),
    appBasePath: normalizeBasePath(env.APP_BASE_PATH || ""),
    dataDir,
    storeFile: path.join(dataDir, "store.json"),
    aiRuntime: normalizeRuntime(env.AI_RUNTIME, appEnv),
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
