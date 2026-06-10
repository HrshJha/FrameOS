import "dotenv/config";
import { resolve } from "node:path";
import { access } from "node:fs/promises";
import { config } from "dotenv";
import { errorToJson } from "./types";
import { runPipeline } from "./pipeline";

const [, , topic] = process.argv;

if (!topic) {
  console.error('Usage: npx ts-node src/index.ts "<topic>"');
  process.exit(1);
}

void main();

async function main(): Promise<void> {
  try {
    const apiKey = await resolveApiKey();

    if (!apiKey) {
      console.error("Missing VEO_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY. Set one in your environment or frontend/.env.local.");
      process.exit(1);
    }

    await runPipeline(topic, apiKey);
  } catch (error: unknown) {
    console.error(JSON.stringify(errorToJson(error), null, 2));
    process.exit(1);
  }
}

async function resolveApiKey(): Promise<string | undefined> {
  try {
    if (process.env.VEO_API_KEY) {
      return process.env.VEO_API_KEY;
    }

    const envLocalPath = resolve(__dirname, "../frontend/.env.local");
    await access(envLocalPath);

    const result = config({ path: envLocalPath });
    const fallbackKey = result.parsed?.GOOGLE_GENERATIVE_AI_API_KEY;

    if (fallbackKey) {
      console.log("[cli] Loaded GOOGLE_GENERATIVE_AI_API_KEY from frontend/.env.local");
    }

    return fallbackKey;
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}
