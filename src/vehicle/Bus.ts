import * as THREE from 'three';
import type { VehicleState } from '../driving/VehicleController';
import { box, buildColoredGeometry, cyl, makeCanvas } from '../world/geometry';
import type { VehicleModel } from './VehicleModel';

const BUS_YELLOW = '#ffc21a';
const BLACK = '#26282c';
const GLASS = '#a6dcff';
const WHITE = '#fafafa';
const RED = '#ff4d3d';
const WHEEL_RADIUS = 0.55;

/** Friendly low-poly yellow school bus facing -Z. */
export class Bus implements VehicleModel {
  readonly object = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly wheels: THREE.Mesh[] = [];

  constructor() {
    const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    const windows: Parameters<typeof buildColoredGeometry>[0] = [];
    for (let i = 0; i < 5; i++) {
      const z = -1.4 + i * 1.05;
      windows.push({ geometry: box(0.05, 0.75, 0.8), color: GLASS, position: [-1.26, 2.0, z] });
      windows.push({ geometry: box(0.05, 0.75, 0.8), color: GLASS, position: [1.26, 2.0, z] });
    }

    const bodyGeometry = buildColoredGeometry([
      // Main box
      { geometry: box(2.5, 2.0, 6.2), color: BUS_YELLOW, position: [0, 1.55, 0.4] },
      // Roof
      { geometry: box(2.35, 0.25, 6.0), color: '#ffd24d', position: [0, 2.67, 0.4] },
      // Hood
      { geometry: box(2.2, 1.1, 1.5), color: BUS_YELLOW, position: [0, 1.1, -3.3] },
      // Black stripes
      { geometry: box(2.54, 0.12, 6.24), color: BLACK, position: [0, 1.25, 0.4] },
      { geometry: box(2.54, 0.12, 6.24), color: BLACK, position: [0, 0.75, 0.4] },
      // Windscreen
      { geometry: box(2.2, 0.9, 0.05), color: GLASS, position: [0, 2.05, -2.72] },
      // Rear window
      { geometry: box(1.8, 0.7, 0.05), color: GLASS, position: [0, 2.05, 3.52] },
      // Bumpers
      { geometry: box(2.4, 0.3, 0.25), color: BLACK, position: [0, 0.6, -4.1] },
      { geometry: box(2.5, 0.3, 0.25), color: BLACK, position: [0, 0.6, 3.55] },
      // Headlights and tail lights
      { geometry: cyl(0.16, 0.16, 0.08, 10), color: WHITE, position: [-0.75, 1.25, -4.06], rotation: [Math.PI / 2, 0, 0] },
      { geometry: cyl(0.16, 0.16, 0.08, 10), color: WHITE, position: [0.75, 1.25, -4.06], rotation: [Math.PI / 2, 0, 0] },
      { geometry: box(0.3, 0.3, 0.06), color: RED, position: [-0.95, 1.1, 3.54] },
      { geometry: box(0.3, 0.3, 0.06), color: RED, position: [0.95, 1.1, 3.54] },
      // Roof lights
      { geometry: box(0.3, 0.18, 0.12), color: '#ff9f1a', position: [-0.8, 2.45, -2.66] },
      { geometry: box(0.3, 0.18, 0.12), color: '#ff9f1a', position: [0.8, 2.45, -2.66] },
      // Side mirrors
      { geometry: box(0.1, 0.35, 0.25), color: BLACK, position: [-1.45, 1.9, -2.6] },
      { geometry: box(0.1, 0.35, 0.25), color: BLACK, position: [1.45, 1.9, -2.6] },
      ...windows,
    ]);
    const bodyMesh = new THREE.Mesh(bodyGeometry, material);
    this.body.add(bodyMesh);

    const wheelGeometry = buildColoredGeometry([
      { geometry: cyl(WHEEL_RADIUS, WHEEL_RADIUS, 0.4, 14), color: BLACK, rotation: [0, 0, Math.PI / 2] },
      { geometry: cyl(0.25, 0.25, 0.42, 8), color: '#c9c9c9', rotation: [0, 0, Math.PI / 2] },
    ]);
    for (const [x, z] of [
      [-1.2, -2.9],
      [1.2, -2.9],
      [-1.2, 2.3],
      [1.2, 2.3],
    ]) {
      const wheel = new THREE.Mesh(wheelGeometry, material);
      wheel.position.set(x, WHEEL_RADIUS, z);
      this.wheels.push(wheel);
      this.object.add(wheel);
    }

    this.object.add(this.body, createBlobShadow());
  }

  animate(dtSec: number, state: VehicleState, timeSec: number): void {
    const spin = (state.speed / WHEEL_RADIUS) * dtSec;
    for (const wheel of this.wheels) wheel.rotation.x -= spin;
    // Gentle lean away from the turn and a soft idle bounce — comfortable, never jerky.
    this.body.rotation.z = THREE.MathUtils.clamp(state.lateralVelocity * 0.025, -0.08, 0.08);
    this.body.position.y = Math.sin(timeSec * 9) * 0.015;
  }
}

function createBlobShadow(): THREE.Mesh {
  const { canvas, ctx } = makeCanvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,0.45)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 8.6),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, 0.04, -0.3);
  return mesh;
}
