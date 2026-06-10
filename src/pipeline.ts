import { generateScript } from "./scriptGen";
import { errorToJson } from "./types";

export async function runPipeline(topic: string, apiKey: string): Promise<void> {
  try {
    const script = generateScript(topic);
    console.log("[pipeline] Generated script:");
    console.log(JSON.stringify(script, null, 2));

    console.log("[pipeline] Video generation API has been removed. Script generation complete.");
  } catch (error: unknown) {
    console.error("[pipeline] Pipeline failure:");
    console.error(JSON.stringify(errorToJson(error), null, 2));
    throw new Error(`Pipeline failed`);
  }
}
