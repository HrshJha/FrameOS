import { Download, ExternalLink, Film, Timer } from "lucide-react"
import { getChannel, OUTPUT_EXAMPLES, type OutputExample } from "@backend/data"

type OutputExamplesProps = {
  limit?: number
  compact?: boolean
  showIntro?: boolean
}

const STATUS_LABELS: Record<OutputExample["status"], string> = {
  sample_render: "sample render",
  qa_hold: "QA hold",
  rendered: "rendered",
}

export function OutputExamples({
  limit,
  compact = false,
  showIntro = true,
}: OutputExamplesProps) {
  const examples = typeof limit === "number" ? OUTPUT_EXAMPLES.slice(0, limit) : OUTPUT_EXAMPLES

  return (
    <div className="space-y-4">
      {showIntro && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Generated output examples
            </p>
            <h2 className="font-serif text-2xl mt-1">Where final renders appear.</h2>
          </div>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground text-pretty">
            These local MP4 sample assets exercise the same render_url/output_url surface that
            provider webhooks fill once Creatomate, Arcads, HeyGen, or Veo jobs complete.
          </p>
        </div>
      )}

      <div
        className={
          compact
            ? "grid grid-cols-1 md:grid-cols-3 gap-3"
            : "grid grid-cols-1 md:grid-cols-3 gap-4"
        }
      >
        {examples.map((example) => (
          <OutputExampleCard key={example.id} example={example} compact={compact} />
        ))}
      </div>
    </div>
  )
}

function OutputExampleCard({
  example,
  compact,
}: {
  example: OutputExample
  compact: boolean
}) {
  const channel = getChannel(example.channelId)

  return (
    <article className="overflow-hidden rounded-md border border-border bg-card">
      <div className="relative bg-background">
        <video
          className="aspect-[9/16] w-full bg-background object-cover"
          controls
          muted
          playsInline
          preload="metadata"
          poster={example.posterUrl}
          src={example.videoUrl}
        >
          <a href={example.videoUrl}>Open render asset</a>
        </video>
        <div className="pointer-events-none absolute left-3 top-3 rounded-sm border border-border/80 bg-background/90 px-2 py-1 font-mono text-[10px] uppercase tracking-widest">
          {STATUS_LABELS[example.status]}
        </div>
      </div>

      <div className={compact ? "p-3" : "p-4"}>
        <div className="flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>@{channel?.handle ?? "unknown"}</span>
          <span className="inline-flex items-center gap-1">
            <Timer className="size-3" />
            {example.duration}
          </span>
        </div>

        <h3 className={compact ? "mt-2 font-serif text-base leading-tight" : "mt-2 font-serif text-lg leading-tight"}>
          {example.hook}
        </h3>

        {!compact && (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
            {example.note}
          </p>
        )}

        <div className="mt-3 space-y-1 border-t border-border pt-3 font-mono text-[10px] text-muted-foreground">
          <p className="flex items-center gap-1.5">
            <Film className="size-3" />
            {example.format}
          </p>
          <p>{example.provider}</p>
          <p>{example.cost}</p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <a
            href={example.videoUrl}
            download
            className="inline-flex items-center justify-center gap-1.5 rounded-sm bg-foreground px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-background hover:bg-foreground/90"
          >
            Download video
            <Download className="size-3" />
          </a>
          <a
            href={example.videoUrl}
            className="inline-flex items-center justify-center gap-1.5 rounded-sm border border-border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-foreground hover:text-accent"
          >
            Open
            <ExternalLink className="size-3" />
          </a>
        </div>
      </div>
    </article>
  )
}
