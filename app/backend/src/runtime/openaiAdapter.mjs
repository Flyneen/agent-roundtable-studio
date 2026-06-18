export class OpenAIAdapter {
  constructor(config) {
    this.config = config;
    this.timeoutMs = Number(config.openaiTimeoutMs || 30000);
    this.maxRetries = Number(config.openaiMaxRetries || 2);
  }

  isConfigured() {
    return Boolean(this.config.openaiApiKey);
  }

  async createStructuredResponse({ instructions, input, schemaName }) {
    if (!this.isConfigured()) {
      const error = new Error("OpenAI API key is not configured. Use a development-degraded runtime or set OPENAI_API_KEY.");
      error.status = 503;
      error.code = "openai_not_configured";
      throw error;
    }

    let lastError = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        return await this.requestOnce({ instructions, input, schemaName, attempt });
      } catch (error) {
        lastError = error;
        if (!isRetryable(error) || attempt === this.maxRetries) {
          throw normalizeOpenAIError(error, attempt + 1);
        }
        await delay(backoffMs(attempt));
      }
    }

    throw normalizeOpenAIError(lastError, this.maxRetries + 1);
  }

  async requestOnce({ instructions, input, schemaName, attempt }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const request = buildRequest(this.config, { instructions, input, schemaName, attempt });
      const response = await fetch(request.url, {
        method: "POST",
        signal: controller.signal,
        headers: request.headers,
        body: JSON.stringify(request.body)
      });

      if (!response.ok) {
        const text = await response.text();
        const error = new Error(`OpenAI API request failed: ${response.status}`);
        error.status = response.status;
        error.code = "openai_http_error";
        error.responseText = text.slice(0, 800);
        throw error;
      }

      const data = await response.json();
      return normalizeResponse(data, this.config.openaiApiMode);
    } catch (error) {
      if (error.name === "AbortError") {
        const timeoutError = new Error(`OpenAI API request timed out after ${this.timeoutMs}ms`);
        timeoutError.status = 504;
        timeoutError.code = "openai_timeout";
        throw timeoutError;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function buildRequest(config, { instructions, input, schemaName, attempt }) {
  const headers = {
    "Authorization": `Bearer ${config.openaiApiKey}`,
    "Content-Type": "application/json"
  };

  if (config.openaiApiMode === "chat_completions") {
    return {
      url: `${config.openaiBaseUrl}/chat/completions`,
      headers,
      body: {
        model: config.openaiModel,
        messages: [
          {
            role: "system",
            content: `${instructions}\n\n你必须只输出 JSON，不要输出 Markdown。schema_name=${schemaName || "agent_roundtable_studio"}，attempt=${attempt + 1}`
          },
          {
            role: "user",
            content: JSON.stringify(input)
          }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      }
    };
  }

  return {
    url: `${config.openaiBaseUrl}/responses`,
    headers,
    body: {
      model: config.openaiModel,
      instructions,
      input: JSON.stringify(input),
      metadata: {
        schema_name: schemaName || "agent_roundtable_studio",
        attempt: String(attempt + 1)
      }
    }
  };
}

function normalizeResponse(data, mode) {
  if (mode !== "chat_completions") return data;
  const content = data?.choices?.[0]?.message?.content || "";
  return {
    provider_response: data,
    output_text: content,
    output_json: parseJsonObject(content)
  };
}

function parseJsonObject(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function isRetryable(error) {
  return error.code === "openai_timeout"
    || error.status === 408
    || error.status === 409
    || error.status === 429
    || (Number(error.status) >= 500 && Number(error.status) < 600);
}

function normalizeOpenAIError(error, attempts) {
  const normalized = new Error(error?.message || "OpenAI API request failed");
  normalized.status = error?.status && error.status >= 400 && error.status < 500 ? 502 : error?.status || 502;
  normalized.code = error?.code || "openai_request_failed";
  normalized.details = {
    attempts,
    retryable: isRetryable(error || {}),
    upstreamStatus: error?.status || null,
    upstreamMessage: error?.responseText || null
  };
  return normalized;
}

function backoffMs(attempt) {
  return Math.min(500 * 2 ** attempt, 3000);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
