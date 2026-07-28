import {
  GoogleGenAI,
  type GenerateContentParameters,
  type GenerateContentResponse,
} from "@google/genai";

export type GeminiTextPart = {
  text: string;
};

export type GeminiContent = {
  role: "user" | "model";
  parts: GeminiTextPart[];
};

export type GeminiGenerateContentRequest = {
  model: string;
  contents: GeminiContent[];
  config?: {
    abortSignal?: AbortSignal;
    systemInstruction?: {
      parts: GeminiTextPart[];
    };
    temperature?: number;
    maxOutputTokens?: number;
    responseMimeType?: "application/json";
    responseJsonSchema?: unknown;
  };
};

export type GeminiGenerateContentResponse = {
  text?: string;
  modelVersion?: string;
  candidates?: Array<{
    finishReason?: string;
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

export interface GeminiSDKClient {
  generateContent(
    request: GeminiGenerateContentRequest,
  ): Promise<GeminiGenerateContentResponse>;
}

function extractText(response: GenerateContentResponse): string | undefined {
  const parts = response.candidates?.[0]?.content?.parts;

  if (!parts) {
    return undefined;
  }

  const text = parts
    .filter((part) => part.thought !== true)
    .map((part) => part.text ?? "")
    .join("");

  return text || undefined;
}

export function createGeminiSDKClient(apiKey: string): GeminiSDKClient {
  const sdk = new GoogleGenAI({ apiKey });

  return {
    async generateContent(request) {
      const sdkRequest: GenerateContentParameters = request;
      const response = await sdk.models.generateContent(sdkRequest);

      return {
        text: extractText(response),
        modelVersion: response.modelVersion,
        candidates: response.candidates?.map((candidate) => ({
          finishReason: candidate.finishReason,
        })),
        promptFeedback: response.promptFeedback
          ? {
              blockReason: response.promptFeedback.blockReason,
            }
          : undefined,
        usageMetadata: response.usageMetadata
          ? {
              promptTokenCount: response.usageMetadata.promptTokenCount,
              candidatesTokenCount:
                response.usageMetadata.candidatesTokenCount,
              totalTokenCount: response.usageMetadata.totalTokenCount,
            }
          : undefined,
      };
    },
  };
}
