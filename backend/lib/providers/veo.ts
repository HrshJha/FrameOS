import { GoogleGenAI } from "@google/genai";
import { createProviderError, type ProviderClient, type ProviderResult } from "./types";

interface VeoInput {
  prompt: string;
  aspectRatio?: "16:9" | "9:16";
}

interface VeoOutput {
  videoUrl: string;
  operationId?: string;
}

export const veoClient: ProviderClient<VeoInput, VeoOutput> = {
  async call(input): Promise<ProviderResult<VeoOutput>> {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    
    if (!apiKey) {
      return this.mock(input);
    }

    try {
      const ai = new GoogleGenAI({ apiKey });

      let operation = await ai.models.generateVideos({
        model: "veo-3.1-generate-preview",
        source: {
          prompt: input.prompt,
        },
        config: {
          aspectRatio: input.aspectRatio ?? "9:16",
          numberOfVideos: 1,
        },
      });

      // Poll using ai.operations.getVideosOperation until done
      while (!operation.done) {
        await new Promise((resolve) => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation });
      }

      const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;

      if (!videoUri) {
        return {
          success: false,
          error: createProviderError(
            "VEO_GENERATION_FAILED",
            "Video generation completed but no URI was returned",
            "veo"
          ),
        };
      }

      return {
        success: true,
        data: {
          videoUrl: videoUri,
          operationId: operation.name,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: createProviderError(
          "VEO_ERROR",
          error instanceof Error ? error.message : "Unknown Veo error",
          "veo",
          error
        ),
      };
    }
  },

  mock(input): Promise<ProviderResult<VeoOutput>> {
    return Promise.resolve({
      success: true,
      data: {
        videoUrl: `https://storage.googleapis.com/veo-mock-videos/mock-video-${Date.now()}.mp4`,
        operationId: `mock-operation-${Date.now()}`
      },
    });
  },
};
