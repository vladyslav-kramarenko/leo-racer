import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { VehicleState } from '../driving/VehicleController';
import { CONFIG } from '../game/config';
import { box, buildColoredGeometry, cyl, ico, makeCanvas, type ColoredPart } from '../world/geometry';
import type { VehicleModel } from './VehicleModel';

const BUS_YELLOW = '#ffc21a';
const ROOF_YELLOW = '#ffd34f';
const BLACK = '#26282c';
const DARK = '#3a3d42';
const GLASS = '#a6dcff';
const CHROME = '#d9dde2';
const WHITE = '#fafafa';
const WHEEL_RADIUS = 0.55;
const LIGHT_DIM = new THREE.Color('#8a2018');
const LIGHT_ON = new THREE.Color('#ff2a1a');

/** Front axle sits under the hood, rear axle under the body. */
const FRONT_AXLE_Z = -3.2;
const REAR_AXLE_Z = 2.3;

interface BrakeLight {
  material: THREE.MeshBasicMaterial;
  glow: THREE.Sprite;
}

const rbox = (w: number, h: number, d: number, r: number, segments = 3) => new RoundedBoxGeometry(w, h, d, segments, r);

/** Upper half of a cylinder lying along Z, squashed into a gently domed roof. */
function domedRoof(width: number, length: number, rise: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(width / 2, width / 2, length, 18, 1, false, Math.PI / 2, Math.PI);
  g.rotateX(Math.PI / 2);
  g.scale(1, rise / (width / 2), 1);
  return g;
}

/** Black arch over a wheel on the body side (half torus in the YZ plane). */
function wheelArch(x: number, z: number): ColoredPart {
  const g = new THREE.TorusGeometry(0.7, 0.07, 6, 14, Math.PI);
  g.rotateY(Math.PI / 2);
  return { geometry: g, color: BLACK, position: [x, 0.56, z] };
}

function bodyParts(): ColoredPart[] {
  const parts: ColoredPart[] = [
    // Body shell with rounded edges and a domed roof.
    { geometry: rbox(2.5, 2.0, 6.2, 0.18, 4), color: BUS_YELLOW, position: [0, 1.55, 0.4] },
    { geometry: domedRoof(2.44, 6.0, 0.32), color: ROOF_YELLOW, position: [0, 2.5, 0.4] },

    // Hood, sloping slightly down to the front, with black fenders over the front wheels.
    { geometry: rbox(2.1, 1.0, 1.6, 0.22, 4), color: BUS_YELLOW, position: [0, 1.08, -3.42], rotation: [-0.05, 0, 0] },
    { geometry: rbox(0.5, 0.34, 1.4, 0.14), color: BLACK, position: [-1.05, 1.0, FRONT_AXLE_Z] },
    { geometry: rbox(0.5, 0.34, 1.4, 0.14), color: BLACK, position: [1.05, 1.0, FRONT_AXLE_Z] },

    // Grille with chrome bars.
    { geometry: rbox(1.25, 0.74, 0.08, 0.04, 2), color: DARK, position: [0, 1.08, -4.22] },
    // Headlights: chrome rim + warm lens; small amber indicators below.
    { geometry: cyl(0.2, 0.2, 0.08, 14), color: CHROME, position: [-0.8, 1.16, -4.18], rotation: [Math.PI / 2, 0, 0] },
    { geometry: cyl(0.2, 0.2, 0.08, 14), color: CHROME, position: [0.8, 1.16, -4.18], rotation: [Math.PI / 2, 0, 0] },
    { geometry: cyl(0.15, 0.15, 0.1, 14), color: '#fff6d6', position: [-0.8, 1.16, -4.2], rotation: [Math.PI / 2, 0, 0] },
    { geometry: cyl(0.15, 0.15, 0.1, 14), color: '#fff6d6', position: [0.8, 1.16, -4.2], rotation: [Math.PI / 2, 0, 0] },
    { geometry: rbox(0.22, 0.1, 0.05, 0.02, 1), color: '#ffa31a', position: [-0.8, 0.88, -4.2] },
    { geometry: rbox(0.22, 0.1, 0.05, 0.02, 1), color: '#ffa31a', position: [0.8, 0.88, -4.2] },

    // Bumpers.
    { geometry: rbox(2.5, 0.28, 0.32, 0.1), color: BLACK, position: [0, 0.55, -4.3] },
    { geometry: rbox(2.56, 0.28, 0.3, 0.1), color: BLACK, position: [0, 0.6, 3.52] },

    // Black rub rails along the sides.
    { geometry: rbox(2.54, 0.1, 6.0, 0.05, 1), color: BLACK, position: [0, 1.25, 0.4] },
    { geometry: rbox(2.54, 0.1, 6.0, 0.05, 1), color: BLACK, position: [0, 0.82, 0.4] },

    // Windscreen: two panes in a black frame, leaning back slightly.
    { geometry: rbox(2.3, 1.02, 0.04, 0.02, 1), color: BLACK, position: [0, 2.05, -2.71], rotation: [0.08, 0, 0] },
    { geometry: rbox(1.04, 0.86, 0.05, 0.02, 1), color: GLASS, position: [-0.56, 2.05, -2.74], rotation: [0.08, 0, 0] },
    { geometry: rbox(1.04, 0.86, 0.05, 0.02, 1), color: GLASS, position: [0.56, 2.05, -2.74], rotation: [0.08, 0, 0] },

    // Window band: black behind, so the gaps between panes read as window pillars.
    { geometry: rbox(2.52, 0.94, 5.2, 0.05, 1), color: BLACK, position: [0, 2.02, 0.65] },

    // Folding entry door (right side, front).
    { geometry: rbox(0.04, 1.7, 0.78, 0.02, 1), color: BLACK, position: [1.265, 1.4, -2.25] },
    { geometry: rbox(0.05, 1.5, 0.32, 0.02, 1), color: GLASS, position: [1.28, 1.42, -2.43] },
    { geometry: rbox(0.05, 1.5, 0.32, 0.02, 1), color: GLASS, position: [1.28, 1.42, -2.07] },

    // Rear emergency door (yellow, black outline) with two windows and a handle.
    { geometry: rbox(1.15, 1.8, 0.04, 0.03, 1), color: BLACK, position: [0, 1.5, 3.505] },
    { geometry: rbox(1.03, 1.68, 0.04, 0.03, 1), color: BUS_YELLOW, position: [0, 1.5, 3.515] },
    { geometry: rbox(0.42, 0.6, 0.05, 0.03, 1), color: GLASS, position: [-0.25, 2.0, 3.53] },
    { geometry: rbox(0.42, 0.6, 0.05, 0.03, 1), color: GLASS, position: [0.25, 2.0, 3.53] },
    { geometry: box(0.3, 0.05, 0.06), color: CHROME, position: [0.3, 1.45, 3.54] },

    // Boards for the SCHOOL BUS signs on the roof edge.
    { geometry: rbox(1.56, 0.3, 0.06, 0.03, 1), color: BLACK, position: [0, 2.68, 3.43] },
    { geometry: rbox(1.56, 0.3, 0.06, 0.03, 1), color: BLACK, position: [0, 2.68, -2.63] },

    // Amber roof warning lights at the front.
    { geometry: rbox(0.3, 0.18, 0.12, 0.04, 1), color: '#ff9f1a', position: [-0.8, 2.45, -2.68] },
    { geometry: rbox(0.3, 0.18, 0.12, 0.04, 1), color: '#ff9f1a', position: [0.8, 2.45, -2.68] },

    // Side mirrors on arms, plus the round cross-view mirrors on the hood corners.
    { geometry: cyl(0.03, 0.03, 0.5, 5), color: BLACK, position: [-1.4, 1.95, -2.75], rotation: [0, 0, Math.PI / 2] },
    { geometry: cyl(0.03, 0.03, 0.5, 5), color: BLACK, position: [1.4, 1.95, -2.75], rotation: [0, 0, Math.PI / 2] },
    { geometry: rbox(0.12, 0.42, 0.26, 0.05, 2), color: BLACK, position: [-1.65, 1.95, -2.75] },
    { geometry: rbox(0.12, 0.42, 0.26, 0.05, 2), color: BLACK, position: [1.65, 1.95, -2.75] },
    { geometry: cyl(0.025, 0.025, 0.45, 5), color: BLACK, position: [-1.0, 1.75, -4.05] },
    { geometry: cyl(0.025, 0.025, 0.45, 5), color: BLACK, position: [1.0, 1.75, -4.05] },
    { geometry: ico(0.13, 1), color: BLACK, position: [-1.0, 2.0, -4.05] },
    { geometry: ico(0.13, 1), color: BLACK, position: [1.0, 2.0, -4.05] },

    // Wheel arches on the body sides (rear axle).
    wheelArch(-1.27, REAR_AXLE_Z),
    wheelArch(1.27, REAR_AXLE_Z),

    // Small fuel cap.
    { geometry: cyl(0.09, 0.09, 0.03, 10), color: CHROME, position: [-1.27, 1.0, 1.3], rotation: [0, 0, Math.PI / 2] },
  ];

  // Five side windows per side.
  for (let i = 0; i < 5; i++) {
    const z = -1.55 + i * 1.08;
    parts.push({ geometry: rbox(0.05, 0.72, 0.88, 0.02, 1), color: GLASS, position: [-1.27, 2.03, z] });
    parts.push({ geometry: rbox(0.05, 0.72, 0.88, 0.02, 1), color: GLASS, position: [1.27, 2.03, z] });
  }
  // Chrome bars across the grille.
  for (let i = 0; i < 4; i++) {
    parts.push({ geometry: box(1.08, 0.05, 0.04), color: CHROME, position: [0, 0.82 + i * 0.17, -4.27] });
  }
  return parts;
}

function wheelParts(width: number): ColoredPart[] {
  const side = width / 2;
  return [
    { geometry: cyl(WHEEL_RADIUS, WHEEL_RADIUS, width, 18), color: BLACK, rotation: [0, 0, Math.PI / 2] },
    { geometry: cyl(0.34, 0.34, width + 0.02, 14), color: '#cfd3d8', rotation: [0, 0, Math.PI / 2] },
    { geometry: cyl(0.14, 0.18, 0.08, 10), color: '#8a8f96', position: [side + 0.03, 0, 0], rotation: [0, 0, Math.PI / 2] },
    { geometry: cyl(0.14, 0.18, 0.08, 10), color: '#8a8f96', position: [-side - 0.03, 0, 0], rotation: [0, 0, Math.PI / 2] },
  ];
}

/** Friendly low-poly yellow school bus facing -Z. */
export class Bus implements VehicleModel {
  readonly object = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly wheels: THREE.Mesh[] = [];
  private readonly lights: BrakeLight[] = [];
  /** Stop-sign arm on the driver's side; swings out when the bus stands still. */
  private readonly stopArm = new THREE.Group();
  private prevSpeed: number | null = null;
  private brakeStart: number | null = null;

  constructor() {
    const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.body.add(new THREE.Mesh(buildColoredGeometry(bodyParts()), material));
    this.body.add(...createSchoolBusSigns());
    this.body.add(this.createStopArm(material));

    // Tail lights and school-bus roof lights, all flashing together.
    const glowTexture = createGlowTexture();
    const lightGeometry = new RoundedBoxGeometry(0.34, 0.34, 0.06, 2, 0.06);
    for (const [x, y, size] of [
      [-0.95, 1.1, 1.3],
      [0.95, 1.1, 1.3],
      [-0.8, 2.45, 1.1],
      [0.8, 2.45, 1.1],
    ] as const) {
      const lightMaterial = new THREE.MeshBasicMaterial({ color: LIGHT_DIM.clone() });
      const light = new THREE.Mesh(lightGeometry, lightMaterial);
      light.position.set(x, y, 3.53);
      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTexture,
          color: LIGHT_ON,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          transparent: true,
        }),
      );
      glow.position.set(x, y, 3.75);
      glow.scale.setScalar(size);
      glow.visible = false;
      this.body.add(light, glow);
      this.lights.push({ material: lightMaterial, glow });
    }

    const frontWheel = buildColoredGeometry(wheelParts(0.42));
    const rearWheel = buildColoredGeometry(wheelParts(0.56)); // dual rear wheels read wider
    for (const [x, z, geometry] of [
      [-1.2, FRONT_AXLE_Z, frontWheel],
      [1.2, FRONT_AXLE_Z, frontWheel],
      [-1.17, REAR_AXLE_Z, rearWheel],
      [1.17, REAR_AXLE_Z, rearWheel],
    ] as const) {
      const wheel = new THREE.Mesh(geometry, material);
      wheel.position.set(x, WHEEL_RADIUS, z);
      this.wheels.push(wheel);
      this.object.add(wheel);
    }

    this.object.add(this.body, createBlobShadow());
  }

  animate(dtSec: number, state: VehicleState, timeSec: number): void {
    const spin = (state.speed / WHEEL_RADIUS) * dtSec;
    for (const wheel of this.wheels) wheel.rotation.x -= spin;
    const moving = state.speed / CONFIG.driving.speed;
    // Gentle lean away from the turn and a soft bounce while moving — comfortable, never jerky.
    this.body.rotation.z = THREE.MathUtils.clamp(state.lateralVelocity * 0.025, -0.08, 0.08);
    this.body.position.y = Math.sin(timeSec * 9) * 0.015 * moving;

    // Nose dips a little while braking.
    const accel = this.prevSpeed === null || dtSec <= 0 ? 0 : (state.speed - this.prevSpeed) / dtSec;
    this.prevSpeed = state.speed;
    const pitch = THREE.MathUtils.clamp(accel * 0.006, -0.04, 0.02);
    this.body.rotation.x += (pitch - this.body.rotation.x) * (1 - Math.exp(-10 * dtSec));

    // Like a real school bus: the STOP arm swings out while standing still.
    const armTarget = state.speed < 0.3 ? -Math.PI / 2 : 0;
    this.stopArm.rotation.y += (armTarget - this.stopArm.rotation.y) * (1 - Math.exp(-6 * dtSec));

    // Flash while the brake is held (kept under 3 Hz for photosensitivity safety).
    // Timed from the moment braking starts, so the lights come on instantly.
    if (!state.braking) this.brakeStart = null;
    else this.brakeStart ??= timeSec;
    const on =
      this.brakeStart !== null && Math.floor((timeSec - this.brakeStart) * CONFIG.driving.brakeLightHz * 2) % 2 === 0;
    for (const light of this.lights) {
      light.material.color.copy(on ? LIGHT_ON : LIGHT_DIM);
      light.glow.visible = on;
    }
  }

  private createStopArm(material: THREE.Material): THREE.Group {
    // Octagon faces sideways when folded against the body; the hinge is at its front edge.
    // Octagon axis along X; the extra 22.5° turn puts a flat side on top, like a real stop sign.
    const octagon: [number, number, number] = [Math.PI / 8, 0, Math.PI / 2];
    const sign = new THREE.Mesh(
      buildColoredGeometry([
        { geometry: cyl(0.3, 0.3, 0.03, 8), color: WHITE, rotation: octagon },
        { geometry: cyl(0.26, 0.26, 0.05, 8), color: '#e8453c', rotation: octagon },
        { geometry: box(0.06, 0.08, 0.3), color: WHITE },
        // Short arm back to the hinge.
        { geometry: box(0.03, 0.04, 0.14), color: BLACK, position: [0, 0, -0.34] },
      ]),
      material,
    );
    sign.position.set(0, 0, 0.4);
    this.stopArm.add(sign);
    this.stopArm.position.set(-1.32, 1.45, -2.6);
    return this.stopArm;
  }
}

/** "SCHOOL BUS" boards on the roof edge, front and back. */
function createSchoolBusSigns(): THREE.Mesh[] {
  const { canvas, ctx } = makeCanvas(256, 48);
  ctx.fillStyle = '#ffd34f';
  ctx.fillRect(0, 0, 256, 48);
  ctx.strokeStyle = BLACK;
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 252, 44);
  ctx.fillStyle = BLACK;
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SCHOOL BUS', 128, 26);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const material = new THREE.MeshBasicMaterial({ map: texture });
  const geometry = new THREE.PlaneGeometry(1.46, 0.24);

  const rear = new THREE.Mesh(geometry, material);
  rear.position.set(0, 2.68, 3.465);
  const front = new THREE.Mesh(geometry, material);
  front.position.set(0, 2.68, -2.665);
  front.rotation.y = Math.PI;
  return [rear, front];
}

function createGlowTexture(): THREE.Texture {
  const { canvas, ctx } = makeCanvas(64, 64);
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

function createBlobShadow(): THREE.Mesh {
  const { canvas, ctx } = makeCanvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,0.45)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 8.8),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, 0.04, -0.4);
  return mesh;
}
