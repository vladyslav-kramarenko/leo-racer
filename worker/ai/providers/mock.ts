import type { DrawingAIProvider, ProcessedDrawing, ProcessOptions } from '../DrawingAI';

/**
 * Local-development provider: returns the image unchanged and a deterministic
 * pseudo-random canMove, so the full drawing flow can be exercised without an AI key.
 */
export class MockDrawingProvider implements DrawingAIProvider {
  readonly name = 'mock';

  async process(image: ArrayBuffer, options: ProcessOptions): Promise<ProcessedDrawing> {
    const bytes = new Uint8Array(image);
    let hash = 0;
    for (let i = 0; i < bytes.length; i += 97) hash = (hash * 31 + bytes[i]) >>> 0;
    const mimeType = options.mimeType === 'image/png' || options.mimeType === 'image/jpeg' ? options.mimeType : 'image/webp';
    return { image, mimeType, canMove: hash % 2 === 0, confidence: 0.5 };
  }
}
