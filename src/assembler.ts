import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { errorMessage } from "./types";

export async function assembleVideo(segmentPaths: string[], outputPath: string): Promise<void> {
  try {
    if (segmentPaths.length === 0) {
      throw new Error("No segment paths were provided for assembly.");
    }

    if (!ffmpegPath) {
      throw new Error("ffmpeg-static did not provide a binary path.");
    }

    const outputDirectory = path.dirname(outputPath);
    await mkdir(outputDirectory, { recursive: true });

    const concatPath = path.join(outputDirectory, "concat.txt");
    const concatList = segmentPaths
      .map((segmentPath) => `file '${escapeConcatPath(path.resolve(segmentPath))}'`)
      .join("\n");

    await writeFile(concatPath, `${concatList}\n`, "utf8");
    console.log(`[assembler] Wrote concat list: ${concatPath}`);
    console.log(`[assembler] Stitching ${segmentPaths.length} segment(s) into ${outputPath}`);

    await runFfmpeg(ffmpegPath, [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concatPath,
      "-c",
      "copy",
      outputPath,
    ]);

    console.log(`[assembler] Final video ready: ${outputPath}`);
  } catch (error: unknown) {
    throw new Error(`Failed to assemble video: ${errorMessage(error)}`);
  }
}

async function runFfmpeg(binaryPath: string, args: string[]): Promise<void> {
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(binaryPath, args, {
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stderr = "";

      child.stdout.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf8").trim();

        if (text.length > 0) {
          console.log(`[ffmpeg] ${text}`);
        }
      });

      child.stderr.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf8");
        stderr += text;

        const progressLine = text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .find((line) => line.startsWith("frame=") || line.startsWith("time="));

        if (progressLine) {
          console.log(`[ffmpeg] ${progressLine}`);
        }
      });

      child.on("error", (error) => {
        reject(error);
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(stderr || `ffmpeg exited with code ${code ?? "unknown"}`));
      });
    });
  } catch (error: unknown) {
    throw new Error(`ffmpeg failed: ${errorMessage(error)}`);
  }
}

function escapeConcatPath(filePath: string): string {
  return filePath.replace(/'/g, "'\\''");
}
