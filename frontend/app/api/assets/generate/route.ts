import { NextRequest, NextResponse } from "next/server";
import { veoClient } from "@backend/providers/veo";

export const maxDuration = 300; // Veo API can take a few minutes

// ─── POST: Direct beat-based video generation (no DB required) ─────────────
// Accepts { beats: [{ line, broll }] } and returns generated video URLs.
// This is the primary way the Studio UI triggers video generation locally.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const beats: { line?: string; broll?: string }[] = body?.beats ?? [];

    if (!Array.isArray(beats) || beats.length === 0) {
      return NextResponse.json(
        { error: "Request body must include a non-empty `beats` array with `broll` prompts." },
        { status: 422 }
      );
    }

    const results: {
      beatIndex: number;
      success: boolean;
      videoUrl?: string;
      error?: string;
      prompt?: string;
    }[] = [];

    for (let i = 0; i < beats.length; i++) {
      const beat = beats[i];
      const brollPrompt = beat?.broll;

      if (!brollPrompt) {
        results.push({ beatIndex: i, success: false, error: "No broll prompt provided" });
        continue;
      }

      console.log(`[POST /api/assets/generate] Generating Veo B-roll for beat ${i}: "${brollPrompt.slice(0, 60)}..."`);

      const veoResult = await veoClient.call({
        prompt: brollPrompt,
        aspectRatio: "9:16",
      });

      if (veoResult.success && veoResult.data) {
        results.push({
          beatIndex: i,
          success: true,
          videoUrl: veoResult.data.videoUrl,
          prompt: brollPrompt,
        });
      } else {
        console.error(`[POST /api/assets/generate] Veo generation failed for beat ${i}`, veoResult.error);
        results.push({
          beatIndex: i,
          success: false,
          error: veoResult.error?.message ?? "Unknown Veo error",
          prompt: brollPrompt,
        });
        // Don't break on error — try remaining beats
      }
    }

    return NextResponse.json({
      beatsTotal: beats.length,
      generatedCount: results.filter((r) => r.success).length,
      results,
    });
  } catch (error) {
    console.error("[POST /api/assets/generate] Unexpected error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── GET: Cron/worker-style generation from database ───────────────────────
// Queries Supabase for reels in the 'assets' stage. Falls back to mock data
// if the database is unreachable (e.g. running locally without Supabase).
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || process.env.STUDIO_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let reel: { id: string; stage: string; brief_id: string };
  let beats: { line?: string; broll?: string }[] = [];
  let briefId: string;
  let isMock = false;

  try {
    const { createServiceSupabaseClient } = await import("@backend/supabase/service");
    const supabase = createServiceSupabaseClient();

    const { data: dueReels, error } = await supabase
      .from("reels")
      .select(`
        id,
        stage,
        brief_id,
        brief:briefs(payload)
      `)
      .eq("stage", "assets")
      .limit(1);

    if (error) throw error;

    if (!dueReels || dueReels.length === 0) {
      return NextResponse.json({ generated: 0, message: "No reels pending asset generation" });
    }

    const rawReel = dueReels[0];
    const brief = rawReel.brief as any;
    const payload = brief?.payload || {};

    reel = { id: rawReel.id, stage: rawReel.stage, brief_id: rawReel.brief_id };
    briefId = rawReel.brief_id;
    beats = payload.script?.beats || [];
  } catch (dbError) {
    console.warn("⚠️ Supabase query failed. Falling back to mock reels for asset generation.", dbError);
    isMock = true;

    // Use mock reels from local data
    const { REELS } = await import("@backend/data");
    const mockReel = REELS.find((r) => r.stage === "assets");

    if (!mockReel) {
      return NextResponse.json({ generated: 0, message: "No mock reels in assets stage" });
    }

    briefId = "mock-brief-" + mockReel.id.slice(-6);
    reel = { id: mockReel.id, stage: mockReel.stage, brief_id: briefId };

    // Provide realistic mock beats based on the mock reel's hook
    beats = [
      {
        line: mockReel.hook,
        broll: `Cinematic close-up related to "${mockReel.hook.slice(0, 40)}...", moody lighting, 4k`,
      },
      {
        line: "Supporting context for the hook.",
        broll: "A person working at a clean desk with dual monitors, overhead soft lighting, slow dolly forward",
      },
      {
        line: "Final reveal and call to action.",
        broll: "Wide aerial shot of a modern city at golden hour, slow zoom out, cinematic color grading",
      },
    ];
  }

  if (beats.length === 0) {
    return NextResponse.json({ error: "No beats found in reel brief" }, { status: 400 });
  }

  const results: any[] = [];

  for (let i = 0; i < beats.length; i++) {
    const beat = beats[i];
    const brollPrompt = beat?.broll;

    if (!brollPrompt) continue;

    console.log(`[GET /api/assets/generate] Generating Veo broll for reel ${reel.id}, beat ${i}...`);
    const veoResult = await veoClient.call({
      prompt: brollPrompt,
      aspectRatio: "9:16",
    });

    if (veoResult.success && veoResult.data) {
      if (!isMock) {
        try {
          const { createServiceSupabaseClient } = await import("@backend/supabase/service");
          const supabase = createServiceSupabaseClient();
          await supabase
            .from("assets")
            .insert({
              brief_id: briefId,
              kind: "broll",
              provider: "veo",
              storage_path: veoResult.data.videoUrl,
              status: "ready",
            });
        } catch (insertErr) {
          console.warn("⚠️ Failed to insert asset into Supabase:", insertErr);
        }
      }

      results.push({ beat: i, success: true, videoUrl: veoResult.data.videoUrl });
    } else {
      console.error(`Veo generation failed for beat ${i}`, veoResult.error);
      results.push({ beat: i, success: false, error: veoResult.error });
      break; // Stop on first error for GET (cron) flow
    }
  }

  return NextResponse.json({
    reelId: reel.id,
    isMock,
    beatsTotal: beats.length,
    generatedThisRun: results.filter((r) => r.success).length,
    results,
  });
}
