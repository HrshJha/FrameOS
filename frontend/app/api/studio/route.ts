// Live AI generation endpoint for Frame OS · /studio
// Streams a structured "reel brief" — the unit the rest of the pipeline consumes.
import { generateObject } from "ai"
import { reelBriefSchema } from "@backend/schemas/reel-brief"
import { studioRequestSchema } from "@backend/schemas/studio-request"
import { checkStudioRateLimit } from "@backend/auth/ratelimit"

export const maxDuration = 60

const DEFAULT_STUDIO_MODELS = ["gemini-1.5-flash", "gemini-1.5-flash-8b"]

export async function POST(req: Request) {
  console.log("POST /api/studio hit")
  console.log(process.env.GOOGLE_GENERATIVE_AI_API_KEY ? "Google key present" : "GOOGLE KEY MISSING")

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return Response.json(
      { error: "GOOGLE_GENERATIVE_AI_API_KEY is missing. Add it to frontend/.env.local and restart Next." },
      { status: 500 },
    )
  }

  // Use IP for rate limiting, fallback to generic "studio-req"
  const ip = req.headers.get("x-forwarded-for") ?? "studio-req"
  const { success } = await checkStudioRateLimit(ip)
  
  if (!success) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait a minute before generating again." }), {
      status: 429,
      headers: { "Content-Type": "application/json" }
    })
  }

  const body = await req.json().catch(() => ({}))
  const parsed = studioRequestSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid studio request", details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  const { niche, format, trend, channelHandle, language } = parsed.data

  const system = `You are the scripting service inside Frame OS — an autonomous media infrastructure layer that runs 10+ Instagram Reels channels at 2+ reels/day each. You output structured reel briefs that the rest of the pipeline (voiceover, asset gen, caption, scheduler) consumes directly.

Style rules:
- Sound like a human who actually posts on Reels in 2026. Avoid LinkedIn-isms ("game-changer", "unlock", "leverage").
- Hooks must earn the first 3 seconds. Curiosity gap > clickbait. No "POV:", no "Here's why...", no listicle openers.
- Never invent statistics. If a number is needed, frame it as "research suggests" or generic.
- Match the language: ${language}. If HI, write romanized Hindi (Hinglish) the way creators actually speak it.
- Match the channel voice — keep it tight.
- Output exactly 3 hooks.
- Output 3 or 4 script beats.
- Output 5-10 lowercase hashtags without the # symbol.
- Keep caption at or under 220 characters.

Channel: @${channelHandle}
Niche: ${niche}
Format: ${format}
Angle: ${trend}
Output language: ${language}

Return only the structured object — no preamble.`

  const { google } = await import("@ai-sdk/google")

  const prompt = `Generate one production-ready reel brief for @${channelHandle} (niche: ${niche}). Format: ${format}. Lean into the angle: ${trend}.`
  const modelIds = getStudioModelIds()
  const failures: StudioModelFailure[] = []

  for (const modelId of modelIds) {
    try {
      console.log(`Studio generation using ${modelId}`)

      const result = await generateObject({
        model: google(modelId),
        schema: reelBriefSchema,
        schemaName: "ReelBrief",
        schemaDescription:
          "A production-ready Instagram Reel brief with exactly 3 hooks, 3-4 script beats, a short caption, hashtags, voice direction, thumbnail prompt, and QA risk notes.",
        system,
        prompt,
        maxRetries: 1,
        experimental_repairText: repairReelBriefText,
      })

      return toObjectTextStreamResponse(result.object, {
        headers: {
          "X-Studio-Model": modelId,
        },
      })
    } catch (error) {
      const failure = toStudioModelFailure(modelId, error)
      failures.push(failure)
      console.warn(`Studio generation failed for ${modelId}`, failure)

      if (failure.statusCode === 401 || failure.statusCode === 403) {
        break
      }
    }
  }

  return Response.json(
    {
      error: "Studio generation failed because the configured Google model(s) are unavailable right now.",
      retryable: failures.some((failure) => failure.retryable),
      failures,
    },
    { status: failures.some((failure) => failure.retryable) ? 503 : 500 },
  )
}

type StudioModelFailure = {
  model: string
  message: string
  statusCode?: number
  retryable?: boolean
}

function getStudioModelIds() {
  return (
    process.env.STUDIO_GOOGLE_MODELS?.split(",")
      .map((model) => model.trim())
      .filter(Boolean) ?? DEFAULT_STUDIO_MODELS
  )
}

function toObjectTextStreamResponse(value: unknown, init?: ResponseInit) {
  const encoder = new TextEncoder()
  const json = JSON.stringify(value)

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let index = 0; index < json.length; index += 256) {
        controller.enqueue(encoder.encode(json.slice(index, index + 256)))
      }
      controller.close()
    },
  })

  return new Response(stream, {
    ...init,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      ...init?.headers,
    },
  })
}

function toStudioModelFailure(model: string, error: unknown): StudioModelFailure {
  const provider = getProviderErrorInfo(error)

  return {
    model,
    message: getErrorMessage(error),
    statusCode: provider.statusCode,
    retryable: provider.retryable,
  }
}

function getProviderErrorInfo(error: unknown): { statusCode?: number; retryable?: boolean } {
  if (!error || typeof error !== "object") {
    return {}
  }

  const maybeError = error as {
    statusCode?: unknown
    isRetryable?: unknown
    lastError?: unknown
  }

  if (typeof maybeError.statusCode === "number" || typeof maybeError.isRetryable === "boolean") {
    return {
      statusCode: typeof maybeError.statusCode === "number" ? maybeError.statusCode : undefined,
      retryable: typeof maybeError.isRetryable === "boolean" ? maybeError.isRetryable : undefined,
    }
  }

  if (maybeError.lastError) {
    return getProviderErrorInfo(maybeError.lastError)
  }

  return {}
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

async function repairReelBriefText({ text }: { text: string }) {
  try {
    const parsed = JSON.parse(extractJsonObject(text))

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null
    }

    const candidate = parsed as {
      cluster?: unknown
      hooks?: unknown
      script?: {
        hook?: unknown
        context?: unknown
        beats?: unknown
        cta?: unknown
      }
      caption?: unknown
      hashtags?: unknown
      voiceDirection?: unknown
      thumbnailPrompt?: unknown
      riskNotes?: unknown
    }

    const repaired = {
      ...candidate,
      cluster: stringOrNull(candidate.cluster),
      hooks: arrayOfStrings(candidate.hooks)?.slice(0, 3),
      script: candidate.script
        ? {
            hook: stringOrNull(candidate.script.hook),
            context: stringOrNull(candidate.script.context),
            beats: repairBeats(candidate.script.beats),
            cta: stringOrNull(candidate.script.cta),
          }
        : undefined,
      caption: stringOrNull(candidate.caption)?.slice(0, 220),
      hashtags: arrayOfStrings(candidate.hashtags)
        ?.map((tag) => tag.replace(/^#+/, "").trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 10),
      voiceDirection: stringOrNull(candidate.voiceDirection),
      thumbnailPrompt: stringOrNull(candidate.thumbnailPrompt),
      riskNotes: stringOrNull(candidate.riskNotes),
    }

    const validated = reelBriefSchema.safeParse(repaired)

    return validated.success ? JSON.stringify(validated.data) : null
  } catch {
    return null
  }
}

function extractJsonObject(text: string) {
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found")
  }

  return text.slice(start, end + 1)
}

function stringOrNull(value: unknown) {
  return typeof value === "string" ? value.trim() : null
}

function arrayOfStrings(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim())
    : null
}

function repairBeats(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined
  }

  return value
    .map((beat) => {
      if (!beat || typeof beat !== "object" || Array.isArray(beat)) {
        return null
      }

      const candidate = beat as { line?: unknown; broll?: unknown }
      const line = stringOrNull(candidate.line)
      const broll = stringOrNull(candidate.broll)

      return line && broll ? { line, broll } : null
    })
    .filter((beat): beat is { line: string; broll: string } => Boolean(beat))
    .slice(0, 4)
}
