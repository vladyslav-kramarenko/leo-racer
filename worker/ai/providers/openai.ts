import { CLASSIFY_PROMPT, CLEANUP_PROMPT, type DrawingAIProvider, type ProcessedDrawing, type ProcessOptions } from '../DrawingAI';

interface OpenAIOptions {
  apiKey: string;
  imageModel?: string;
  classifierModel?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

const DEFAULT_IMAGE_MODEL = 'gpt-image-1';
const DEFAULT_CLASSIFIER_MODEL = 'gpt-4.1-mini';

/**
 * OpenAI adapter: one image-edit call cleans the drawing onto a transparent background,
 * one small vision call classifies canMove. Both run in parallel. Nothing is stored.
 */
export class OpenAIDrawingProvider implements DrawingAIProvider {
  readonly name = 'openai';
  private readonly baseUrl: string;

  constructor(private readonly options: OpenAIOptions) {
    this.baseUrl = options.baseUrl ?? 'https://api.openai.com/v1';
  }

  async process(image: ArrayBuffer, { mimeType }: ProcessOptions): Promise<ProcessedDrawing> {
    const [cleaned, classification] = await Promise.all([
      this.cleanup(image, mimeType),
      this.classify(image, mimeType),
    ]);
    return { image: cleaned, mimeType: 'image/png', ...classification };
  }

  private async cleanup(image: ArrayBuffer, mimeType: string): Promise<ArrayBuffer> {
    const form = new FormData();
    const ext = mimeType.split('/')[1] ?? 'png';
    form.append('model', this.options.imageModel ?? DEFAULT_IMAGE_MODEL);
    form.append('image', new File([image], `drawing.${ext}`, { type: mimeType }));
    form.append('prompt', CLEANUP_PROMPT);
    form.append('background', 'transparent');
    form.append('output_format', 'png');
    form.append('input_fidelity', 'high');
    form.append('quality', 'medium');
    form.append('size', 'auto');
    form.append('n', '1');

    const res = await this.request('/images/edits', { method: 'POST', body: form });
    const body = (await res.json()) as { data?: { b64_json?: string }[] };
    const b64 = body.data?.[0]?.b64_json;
    if (!b64) throw new Error('OpenAI image edit returned no image');
    return base64ToArrayBuffer(b64);
  }

  private async classify(image: ArrayBuffer, mimeType: string): Promise<{ canMove: boolean; confidence: number }> {
    const payload = {
      model: this.options.classifierModel ?? DEFAULT_CLASSIFIER_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: CLASSIFY_PROMPT },
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${arrayBufferToBase64(image)}`, detail: 'low' },
            },
          ],
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'drawing_classification',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              canMove: { type: 'boolean' },
              confidence: { type: 'number' },
            },
            required: ['canMove', 'confidence'],
          },
        },
      },
    };
    const res = await this.request('/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = body.choices?.[0]?.message?.content;
    try {
      const parsed = JSON.parse(content ?? '') as { canMove?: unknown; confidence?: unknown };
      const confidence = typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5;
      return { canMove: parsed.canMove === true, confidence };
    } catch {
      // Classification is advisory; a parent can always switch MOVES/STAYS.
      return { canMove: false, confidence: 0 };
    }
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${this.options.apiKey}` },
      signal: AbortSignal.timeout(this.options.timeoutMs ?? 80_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`OpenAI ${path} failed: ${res.status} ${text.slice(0, 300)}`);
    }
    return res;
  }
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
