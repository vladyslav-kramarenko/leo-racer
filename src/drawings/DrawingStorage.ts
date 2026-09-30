import { STORE_CUSTOM_ASSETS, withStore } from '../storage/database';

export const CUSTOM_ASSET_VERSION = 1;

export interface CustomAsset {
  id: string;
  createdAt: number;
  /** Ready-to-render image (transparent PNG/WebP from AI, or the resized original). */
  processedImage: Blob;
  /** AI classification. */
  canMove: boolean;
  /** Parent override: null = follow AI. */
  manualOverride: boolean | null;
  version: number;
  confidence: number | null;
  source: 'ai' | 'original';
}

export function effectiveCanMove(asset: Pick<CustomAsset, 'canMove' | 'manualOverride'>): boolean {
  return asset.manualOverride ?? asset.canMove;
}

/** IndexedDB persistence for custom drawings. Local only — nothing is uploaded for storage. */
export const DrawingStorage = {
  async list(): Promise<CustomAsset[]> {
    const all = await withStore<CustomAsset[]>(STORE_CUSTOM_ASSETS, 'readonly', (s) => s.getAll());
    return all.sort((a, b) => a.createdAt - b.createdAt);
  },

  async put(asset: CustomAsset): Promise<void> {
    await withStore(STORE_CUSTOM_ASSETS, 'readwrite', (s) => s.put(asset));
  },

  async remove(id: string): Promise<void> {
    await withStore(STORE_CUSTOM_ASSETS, 'readwrite', (s) => s.delete(id));
  },
};
