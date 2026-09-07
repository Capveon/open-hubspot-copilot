export type ReasoningEffort = "instant" | "low" | "medium" | "high";

export type MercuryChatRequest = {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  maxTokens?: number;
  temperature?: number;
  reasoningEffort?: ReasoningEffort;
  realtime?: boolean;
  stream?: boolean;
  diffusing?: boolean;
  jsonSchema?: {
    name: string;
    strict?: boolean;
    schema: Record<string, unknown>;
  };
  signal?: AbortSignal;
};

export type MercuryUsage = {
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  reasoningTokens: number;
};

export type StreamHandlers = {
  onDelta?: (text: string, mode: "append" | "replace") => void;
};

function apiKey(): string {
  const key = process.env.INCEPTION_API_KEY;
  if (!key) throw new Error("INCEPTION_API_KEY is not set");
  return key;
}

function baseUrl(): string {
  return (process.env.INCEPTION_BASE_URL ?? "https://api.inceptionlabs.ai/v1").replace(
    /\/$/,
    "",
  );
}

function bodyOf(req: MercuryChatRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: "mercury-2",
    messages: req.messages,
    max_tokens: req.maxTokens ?? 128,
    temperature: req.temperature ?? 0.6,
    reasoning_effort: req.reasoningEffort ?? "instant",
    realtime: req.realtime ?? true,
    stream: req.stream ?? false,
  };
  if (req.stream) body.stream_options = { include_usage: true };
  if (req.diffusing) body.diffusing = true;
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

export async function mercuryChat(
  req: MercuryChatRequest,
  handlers?: StreamHandlers,
): Promise<{ text: string; usage: MercuryUsage; ttfbMs: number; totalMs: number }> {
  const t0 = performance.now();
  let ttfbMs = -1;
  const res = await fetch(`${baseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(bodyOf(req)),
    signal: req.signal,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Mercury ${res.status}: ${err.slice(0, 800)}`);
  }

  if (!req.stream) {
    ttfbMs = performance.now() - t0;
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
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
  if (!reader) throw new Error("Mercury stream had no body");
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let usage: MercuryUsage = {
    promptTokens: 0,
    completionTokens: 0,
    cachedTokens: 0,
    reasoningTokens: 0,
  };
  const replace = Boolean(req.diffusing);

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
      if (replace) {
        text = piece;
        handlers?.onDelta?.(text, "replace");
      } else {
        text += piece;
        handlers?.onDelta?.(piece, "append");
      }
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
} | undefined): MercuryUsage {
  return {
    promptTokens: usage?.prompt_tokens ?? 0,
    completionTokens: usage?.completion_tokens ?? 0,
    cachedTokens: usage?.prompt_tokens_details?.cached_tokens ?? 0,
    reasoningTokens: usage?.completion_tokens_details?.reasoning_tokens ?? 0,
  };
}
