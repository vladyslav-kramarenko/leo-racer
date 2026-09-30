import type { Env } from '../env';
import { MockDrawingProvider } from './providers/mock';
import { OpenAIDrawingProvider } from './providers/openai';

export interface ProcessedDrawing {
  /** Transparent PNG/WebP ready to show in the game. */
  image: ArrayBuffer;
  mimeType: 'image/png' | 'image/webp' | 'image/jpeg';
  canMove: boolean;
  confidence: number;
}

export interface ProcessOptions {
  mimeType: string;
}

/** Every AI vendor sits behind this interface; the frontend never knows which one is used. */
export interface DrawingAIProvider {
  readonly name: string;
  process(image: ArrayBuffer, options: ProcessOptions): Promise<ProcessedDrawing>;
}

export class ProviderConfigError extends Error {}

export function createDrawingProvider(env: Env): DrawingAIProvider {
  const provider = (env.AI_PROVIDER ?? 'mock').toLowerCase();
  switch (provider) {
    case 'mock':
      return new MockDrawingProvider();
    case 'openai':
      if (!env.AI_API_KEY) throw new ProviderConfigError('AI_API_KEY is not set');
      return new OpenAIDrawingProvider({
        apiKey: env.AI_API_KEY,
        imageModel: env.AI_IMAGE_MODEL,
        classifierModel: env.AI_CLASSIFIER_MODEL,
      });
    default:
      throw new ProviderConfigError(`Unknown AI_PROVIDER "${provider}"`);
  }
}

/** Shared instruction: keep the child's drawing, only clean it. */
export const CLEANUP_PROMPT =
  "This is a photo of a young child's drawing. Preserve the child's drawing exactly: same shapes, " +
  'same colours, same wobbly lines and naive style. Do NOT redesign it, add details, or make it realistic. ' +
  'Remove the paper, table and background completely so only the drawn object remains on a transparent ' +
  'background. Clean up the edges, remove shadows and paper texture, gently correct perspective if the ' +
  'photo was taken at an angle, and centre the object.';

export const CLASSIFY_PROMPT =
  "Look at this child's drawing. Decide whether the main depicted object can move by itself " +
  '(e.g. car, bus, animal, person, dinosaur, plane, boat, tractor, robot) or is static ' +
  '(e.g. tree, house, flower, cone, sun, mountain, sign). Reply with JSON only.';
