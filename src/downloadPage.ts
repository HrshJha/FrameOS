import { writeFile } from "node:fs/promises";
import path from "node:path";
import { errorMessage, type VideoScript } from "./types";

export async function writeDownloadPage(
  videoPath: string,
  script: VideoScript,
  outputPath = path.join("output", "index.html"),
): Promise<string> {
  try {
    const relativeVideoPath = path.basename(videoPath);
    const html = renderDownloadPage(relativeVideoPath, script);

    await writeFile(outputPath, html, "utf8");
    return outputPath;
  } catch (error: unknown) {
    throw new Error(`Failed to write video download page: ${errorMessage(error)}`);
  }
}

function renderDownloadPage(videoFileName: string, script: VideoScript): string {
  const title = escapeHtml(script.title);
  const videoSrc = encodeURI(videoFileName);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    :root {
      color-scheme: dark;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #0b0d10;
      color: #f4f5f6;
    }

    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 32px;
      box-sizing: border-box;
    }

    main {
      width: min(960px, 100%);
    }

    h1 {
      margin: 0 0 8px;
      font-size: clamp(28px, 5vw, 56px);
      line-height: 1;
      letter-spacing: 0;
    }

    p {
      margin: 0 0 22px;
      color: #a8b0bb;
      font-size: 15px;
    }

    video {
      width: 100%;
      max-height: 72vh;
      display: block;
      background: #000;
      border: 1px solid #242a33;
      border-radius: 8px;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 18px;
    }

    a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 42px;
      padding: 0 14px;
      border-radius: 6px;
      border: 1px solid #303846;
      color: #f4f5f6;
      text-decoration: none;
      font-size: 14px;
      font-weight: 600;
    }

    a.primary {
      background: #f4f5f6;
      border-color: #f4f5f6;
      color: #0b0d10;
    }
  </style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <p>${script.totalDurationSeconds}s · ${script.aspectRatio} · ${escapeHtml(script.styleGuide)}</p>
    <video src="${videoSrc}" controls playsinline preload="metadata"></video>
    <div class="actions">
      <a class="primary" href="${videoSrc}" download>Download MP4</a>
      <a href="${videoSrc}" target="_blank" rel="noopener">Open video file</a>
    </div>
  </main>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
