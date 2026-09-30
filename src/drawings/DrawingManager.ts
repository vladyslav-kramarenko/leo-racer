import { CUSTOM_ASSET_VERSION, DrawingStorage, type CustomAsset } from './DrawingStorage';

type Listener = (assets: readonly CustomAsset[], added?: CustomAsset) => void;

/** In-memory list of drawings, kept in sync with IndexedDB. */
export class DrawingManager {
  private assets: CustomAsset[] = [];
  private readonly listeners = new Set<Listener>();
  private storageOk = true;

  async load(): Promise<void> {
    try {
      this.assets = await DrawingStorage.list();
    } catch (err) {
      this.storageOk = false;
      console.warn('[leo] drawings storage unavailable', err);
    }
    this.emit();
  }

  list(): readonly CustomAsset[] {
    return this.assets;
  }

  isStorageAvailable(): boolean {
    return this.storageOk;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async add(input: {
    image: Blob;
    canMove: boolean;
    confidence: number | null;
    source: CustomAsset['source'];
  }): Promise<CustomAsset> {
    const asset: CustomAsset = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      processedImage: input.image,
      canMove: input.canMove,
      manualOverride: null,
      version: CUSTOM_ASSET_VERSION,
      confidence: input.confidence,
      source: input.source,
    };
    this.assets = [...this.assets, asset];
    await this.persist(asset);
    this.emit(asset);
    return asset;
  }

  async setMoves(id: string, moves: boolean): Promise<void> {
    const asset = this.assets.find((a) => a.id === id);
    if (!asset) return;
    const updated: CustomAsset = { ...asset, manualOverride: moves === asset.canMove ? null : moves };
    this.assets = this.assets.map((a) => (a.id === id ? updated : a));
    await this.persist(updated);
    this.emit();
  }

  async remove(id: string): Promise<void> {
    this.assets = this.assets.filter((a) => a.id !== id);
    try {
      await DrawingStorage.remove(id);
    } catch (err) {
      console.warn('[leo] failed to delete drawing', err);
    }
    this.emit();
  }

  private async persist(asset: CustomAsset): Promise<void> {
    try {
      await DrawingStorage.put(asset);
    } catch (err) {
      // Keep it for this session even if it can't be saved.
      console.warn('[leo] failed to save drawing', err);
    }
  }

  private emit(added?: CustomAsset): void {
    for (const listener of this.listeners) listener(this.assets, added);
  }
}
