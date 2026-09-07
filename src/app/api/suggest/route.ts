import { findBanned } from "@/lib/banned";
import { runCoachModel } from "@/lib/coach";
import { coachModel, coachProvider } from "@/lib/coach-config";
import { TUCSON_CARD, type CallCard } from "@/lib/card";
import { buildMessages, parseLine } from "@/lib/suggest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  seq?: number;
  prior?: string[];
  themPartial?: string;
  themSettled?: boolean;
  beat?: string;
  onGlass?: string;
  tape?: string;
  already?: string[];
  card?: CallCard;
  nudge?: string;
  reasoningEffort?: string;
  structured?: boolean;
  stream?: boolean;
  maxTokens?: number;
  temperature?: number;
};

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  const seq = body.seq ?? 0;
  const provider = coachProvider();
  const model = coachModel();
  const messages = buildMessages({
    card: body.card ?? TUCSON_CARD,
    prior: body.prior ?? [],
    themPartial: body.themPartial ?? "",
    themSettled: Boolean(body.themSettled),
    beat: body.beat,
    onGlass: body.onGlass,
    tape: body.tape,
    already: body.already,
    nudge: body.nudge,
    pack: "turn",
  });
  const stream = body.stream !== false;
  const encoder = new TextEncoder();

  const send = (
    controller: ReadableStreamDefaultController<Uint8Array>,
    event: string,
    data: unknown,
  ) => {
    controller.enqueue(
      encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
    );
  };

  const streamOut = new ReadableStream<Uint8Array>({
    async start(controller) {
      send(controller, "meta", { seq, provider, model });
      try {
        const result = await runCoachModel(
          {
            messages,
            provider,
            model,
            reasoningEffort: body.reasoningEffort,
            structured: body.structured !== false,
            stream,
            maxTokens: body.maxTokens ?? 220,
            temperature: body.temperature ?? 0.3,
            signal: req.signal,
          },
          {
            onDelta(text, mode) {
              send(controller, "delta", {
                seq,
                text,
                mode,
                line: parseLine(text),
              });
            },
          },
        );
        const line = parseLine(result.text);
        const spoken = `${line.agree} ${line.say}`.trim();
        send(controller, "done", {
          seq,
          text: result.text,
          line,
          banned: findBanned(spoken),
          ttfbMs: Math.round(result.ttfbMs),
          totalMs: Math.round(result.totalMs),
          usage: result.usage,
          provider,
          model,
        });
      } catch (err) {
        if (req.signal.aborted) {
          send(controller, "abort", { seq });
        } else {
          send(controller, "error", {
            seq,
            message: err instanceof Error ? err.message : "Coach failed",
          });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(streamOut, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
