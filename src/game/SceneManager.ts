import * as THREE from 'three';
import { CONFIG } from './config';

/** Owns the renderer, scene and camera; handles resize and pixel-ratio capping. */
export class SceneManager {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;

  constructor(private readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.renderer.maxPixelRatio));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = false;
    this.renderer.domElement.id = 'game-canvas';
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, 1, 0.5, CONFIG.camera.far);
    this.resize();
    window.addEventListener('resize', this.resize);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  drawCalls(): number {
    return this.renderer.info.render.calls;
  }

  triangles(): number {
    return this.renderer.info.render.triangles;
  }

  resolution(): { width: number; height: number } {
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    return { width: size.x, height: size.y };
  }

  private readonly resize = (): void => {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.renderer.maxPixelRatio));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  };
}
