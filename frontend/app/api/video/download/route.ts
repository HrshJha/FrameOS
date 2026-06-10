import { readFile } from "node:fs/promises"
import { resolve, sep } from "node:path"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ALLOWED_FILES = new Set(["final.mp4", "index.html"])

export async function GET(req: Request) {
  const url = new URL(req.url)
  const runId = url.searchParams.get("runId")
  const fileName = url.searchParams.get("file") ?? "final.mp4"

  if (!runId || !/^[a-zA-Z0-9_-]+$/.test(runId)) {
    return Response.json({ error: "Invalid runId" }, { status: 400 })
  }

  if (!ALLOWED_FILES.has(fileName)) {
    return Response.json({ error: "Invalid file" }, { status: 400 })
  }

  const runDirectory = resolve(process.cwd(), "../output/studio-renders", runId)
  const filePath = resolve(runDirectory, fileName)

  if (!filePath.startsWith(`${runDirectory}${sep}`)) {
    return Response.json({ error: "Invalid file path" }, { status: 400 })
  }

  try {
    const file = await readFile(filePath)
    const isVideo = fileName.endsWith(".mp4")

    return new Response(file, {
      headers: {
        "Content-Type": isVideo ? "video/mp4" : "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("Video download failed", error)
    return Response.json({ error: "Generated video file was not found" }, { status: 404 })
  }
}
