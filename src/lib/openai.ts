export type OpenAIChatRequest = {
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  maxTokens?: number;
  temperature?: number;
  reasoningEffort?: string;
  jsonSchema?: {
    name: string;
    strict?: boolean;
    schema: Record<string, unknown>;
  };
  stream?: boolean;
  signal?: AbortSignal;
  baseUrl?: string;
  apiKey?: string;
  extraHeaders?: Record<string, string>;
  extraBody?: Record<string, unknown>;
};

export type OpenAIUsage = {
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  reasoningTokens: number;
};

export type StreamHandlers = {
  onDelta?: (text: string, mode: "append" | "replace") => void;
};

function usesCompletionTokens(model: string): boolean {
  return /^(gpt-5|gpt-oss)/i.test(model) || model.includes("gpt-oss");
}

function bodyOf(req: OpenAIChatRequest): Record<string, unknown> {
  const max = req.maxTokens ?? 220;
  const body: Record<string, unknown> = {
    model: req.model,
    messages: req.messages,
    stream: req.stream ?? false,
    ...req.extraBody,
  };
  if (usesCompletionTokens(req.model)) {
    body.max_completion_tokens = max;
    if (req.reasoningEffort) body.reasoning_effort = req.reasoningEffort;
  } else {
    body.max_tokens = max;
    if (req.temperature != null) body.temperature = req.temperature;
    if (req.reasoningEffort) body.reasoning_effort = req.reasoningEffort;
  }
  if (req.stream) body.stream_options = { include_usage: true };
  if (req.jsonSchema) {
    body.response_format = {
      type: "json_schema",
      json_schema: {
        name: req.jsonSchema.name,
        strict: req.jsonSchema.strict ?? true,
        schema: req.jsonSchema.schema,
      },
    };
  }
  return body;
}

export async function openaiChat(
  req: OpenAIChatRequest,
  handlers?: StreamHandlers,
): Promise<{ text: string; usage: OpenAIUsage; ttfbMs: number; totalMs: number }> {
  const t0 = performance.now();
  let ttfbMs = -1;
  const key = req.apiKey ?? process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  const base = (req.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...req.extraHeaders,
    },
    body: JSON.stringify(bodyOf(req)),
    signal: req.signal,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI-compat ${res.status}: ${err.slice(0, 800)}`);
  }

  if (!req.stream) {
    ttfbMs = performance.now() - t0;
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        prompt_tokens_details?: { cached_tokens?: number };
        completion_tokens_details?: { reasoning_tokens?: number };
      };
    };
    const text = json.choices?.[0]?.message?.content ?? "";
    handlers?.onDelta?.(text, "replace");
    return {
      text,
      usage: usageOf(json.usage),
      ttfbMs,
      totalMs: performance.now() - t0,
    };
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("OpenAI stream had no body");
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let usage: OpenAIUsage = {
    promptTokens: 0,
    completionTokens: 0,
    cachedTokens: 0,
    reasoningTokens: 0,
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n");
    buffer = parts.pop() ?? "";
    for (const raw of parts) {
      const line = raw.trim();
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      let chunk: {
        choices?: Array<{ delta?: { content?: string | null } }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          prompt_tokens_details?: { cached_tokens?: number };
          completion_tokens_details?: { reasoning_tokens?: number };
        };
      };
      try {
        chunk = JSON.parse(data) as typeof chunk;
      } catch {
        continue;
      }
      if (chunk.usage) usage = usageOf(chunk.usage);
      const piece = chunk.choices?.[0]?.delta?.content;
      if (piece == null || piece === "") continue;
      if (ttfbMs < 0) ttfbMs = performance.now() - t0;
      text += piece;
      handlers?.onDelta?.(piece, "append");
    }
  }

  return {
    text,
    usage,
    ttfbMs: ttfbMs < 0 ? performance.now() - t0 : ttfbMs,
    totalMs: performance.now() - t0,
  };
}

function usageOf(usage: {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
  completion_tokens_details?: { reasoning_tokens?: number };
} | undefined): OpenAIUsage {
  return {
    promptTokens: usage?.prompt_tokens ?? 0,
    completionTokens: usage?.completion_tokens ?? 0,
    cachedTokens: usage?.prompt_tokens_details?.cached_tokens ?? 0,
    reasoningTokens: usage?.completion_tokens_details?.reasoning_tokens ?? 0,
  };
}
