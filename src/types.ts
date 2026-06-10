export type CameraMove =
  | "static"
  | "slow_zoom_in"
  | "slow_zoom_out"
  | "pan_left"
  | "pan_right"
  | "tracking_shot"
  | "aerial_descent"
  | "handheld_follow"
  | "dolly_forward"
  | "orbit";

export type AspectRatio = "16:9" | "9:16" | "1:1";

export type DurationSeconds = 5 | 8 | 10;

export interface Scene {
  sceneIndex: number;
  durationSeconds: DurationSeconds;
  visualDescription: string;
  cameraMovement: CameraMove;
  lighting: string;
  mood: string;
  audioNote: string;
  veoPrompt: string;
}

export interface VideoScript {
  title: string;
  totalDurationSeconds: number;
  aspectRatio: AspectRatio;
  styleGuide: string;
  scenes: Scene[];
}

export type VeoJobStatus =
  | "queued"
  | "submitted"
  | "polling"
  | "downloaded"
  | "failed";

export interface VeoJob {
  sceneIndex: number;
  prompt: string;
  durationSeconds: DurationSeconds;
  status: VeoJobStatus;
  operationName?: string;
  videoUri?: string;
  outputPath?: string;
}

export interface VeoSubmitRequest {
  instances: Array<{
    prompt: string;
  }>;
  parameters: {
    aspectRatio: AspectRatio;
    durationSeconds: DurationSeconds;
    sampleCount: 1;
  };
}

export interface GoogleApiError {
  code?: number;
  message?: string;
  status?: string;
  details?: unknown[];
  [key: string]: unknown;
}

export interface VeoOperationResponse {
  name?: string;
  done?: boolean;
  error?: GoogleApiError;
  response?: {
    generateVideoResponse?: {
      generatedSamples?: Array<{
        video?: {
          uri?: string;
          videoUri?: string;
        };
      }>;
    };
    videos?: Array<{
      videoUri?: string;
      uri?: string;
    }>;
    generatedVideos?: Array<{
      video?: {
        uri?: string;
        videoUri?: string;
      };
      videoUri?: string;
    }>;
    video?: {
      uri?: string;
      videoUri?: string;
    };
  };
}

export interface RenderedScene {
  sceneIndex: number;
  segmentPath: string;
  operationName: string;
  videoUri: string;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown error";
}

export function errorToJson(error: unknown): unknown {
  if (error instanceof VeoError || error instanceof VeoSceneError) {
    return error.toJSON();
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return error;
}

export class VeoError extends Error {
  public readonly statusCode?: number;
  public readonly apiError?: unknown;

  public constructor(message: string, statusCode?: number, apiError?: unknown) {
    super(message);
    this.name = "VeoError";
    this.statusCode = statusCode;
    this.apiError = apiError;
  }

  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      apiError: this.apiError,
      stack: this.stack,
    };
  }
}

export class VeoSceneError extends Error {
  public readonly scene: Scene;
  public readonly causeError: unknown;

  public constructor(scene: Scene, causeError: unknown) {
    super(`Scene ${scene.sceneIndex} failed: ${errorMessage(causeError)}`);
    this.name = "VeoSceneError";
    this.scene = scene;
    this.causeError = causeError;
  }

  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      scene: this.scene,
      cause: errorToJson(this.causeError),
      stack: this.stack,
    };
  }
}
