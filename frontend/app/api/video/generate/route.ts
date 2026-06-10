import { mkdir, writeFile } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import { resolve } from "node:path"
import pLimit from "p-limit"
import { studioRequestSchema } from "@backend/schemas/studio-request"
import { assembleVideo } from "../../../../../src/assembler"
import { writeDownloadPage } from "../../../../../src/downloadPage"
import { generateScript } from "../../../../../src/scriptGen"
import { errorToJson, type RenderedScene, type Scene, VeoSceneError } from "../../../../../src/types"
import { downloadSegment, pollVeoJob, submitVeoJob } from "../../../../../src/veoClient"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 800

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const parsed = studioRequestSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid video generation request", details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  const apiKey = process.env.VEO_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY

  if (!apiKey) {
    return Response.json(
      { error: "VEO_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY is required to generate video." },
      { status: 500 },
    )
  }

  const runId = randomUUID()
  const topic = buildStudioVideoTopic(parsed.data)
  const script = generateScript(topic)
  const runDirectory = resolve(process.cwd(), "../output/studio-renders", runId)
  const segmentDirectory = resolve(runDirectory, "segments")
  const outputPath = resolve(runDirectory, "final.mp4")
  const scriptPath = resolve(runDirectory, "script.json")

  try {
    await mkdir(segmentDirectory, { recursive: true })
    await writeFile(scriptPath, JSON.stringify(script, null, 2), "utf8")

    const limit = pLimit(2)
    const renderedScenes = await Promise.all(
      script.scenes.map((scene) =>
        limit(() => renderStudioScene(scene, apiKey, segmentDirectory)),
      ),
    )
    const orderedSegmentPaths = renderedScenes
      .sort((left, right) => left.sceneIndex - right.sceneIndex)
      .map((scene) => scene.segmentPath)

    await assembleVideo(orderedSegmentPaths, outputPath)
    await writeDownloadPage(outputPath, script, resolve(runDirectory, "index.html"))

    const videoUrl = `/api/video/download?runId=${encodeURIComponent(runId)}&file=final.mp4`
    const pageUrl = `/api/video/download?runId=${encodeURIComponent(runId)}&file=index.html`

    return Response.json({
      runId,
      title: script.title,
      topic,
      totalDurationSeconds: script.totalDurationSeconds,
      aspectRatio: script.aspectRatio,
      videoUrl,
      downloadUrl: videoUrl,
      pageUrl,
      script,
      renderedScenes,
    })
  } catch (error: unknown) {
    console.error("Studio video generation failed", errorToJson(error))

    return Response.json(
      {
        error: error instanceof VeoSceneError ? error.message : "Studio video generation failed.",
        details: errorToJson(error),
        runId,
        topic,
        script,
      },
      { status: 500 },
    )
  }
}

async function renderStudioScene(
  scene: Scene,
  apiKey: string,
  segmentDirectory: string,
): Promise<RenderedScene> {
  try {
    const operationName = await submitVeoJob(scene.veoPrompt, scene.durationSeconds, apiKey)
    const videoUri = await pollVeoJob(operationName, apiKey, 10000)
    const segmentPath = resolve(segmentDirectory, `scene_${scene.sceneIndex}.mp4`)

    await downloadSegment(videoUri, segmentPath, apiKey)

    return {
      sceneIndex: scene.sceneIndex,
      segmentPath,
      operationName,
      videoUri,
    }
  } catch (error: unknown) {
    throw new VeoSceneError(scene, error)
  }
}

function buildStudioVideoTopic(input: {
  channelHandle: string
  niche: string
  format: string
  trend: string
  language: "EN" | "HI"
}) {
  const languageLabel = input.language === "HI" ? "Hinglish" : "English"
  const niche = input.niche.replace(/\s*×\s*/g, " and ")
  const trend = input.trend.replace(/^use\s+/i, "")

  return `${input.format} reel for @${input.channelHandle} about ${niche}, ${trend}, ${languageLabel}`
}
