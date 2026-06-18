export class OpenAIAdapter {
  constructor(config) {
    this.config = config;
  }

  isConfigured() {
    return Boolean(this.config.openaiApiKey);
  }

  async createStructuredResponse({ instructions, input, schemaName }) {
    if (!this.isConfigured()) {
      const error = new Error("OpenAI API key is not configured. Use AI_RUNTIME=simulated or set OPENAI_API_KEY.");
      error.status = 503;
      throw error;
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.config.openaiApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.config.openaiModel,
        instructions,
        input: JSON.stringify(input),
        metadata: {
          schema_name: schemaName || "agent_roundtable_studio"
        }
      })
    });

    if (!response.ok) {
      const text = await response.text();
      const error = new Error(`OpenAI API request failed: ${response.status} ${text}`);
      error.status = 502;
      throw error;
    }

    return response.json();
  }
}
