/**
 * Every tunable value lives here so it can be adjusted after hardware/child testing
 * without touching game logic.
 */
export const CONFIG = {
  keyboard: {
    /** Time to go from centre to full lock while a key is held. */
    rampUpMs: 420,
    /** Time to return from full lock to centre after release. */
    returnMs: 320,
  },

  gamepad: {
    /** Axis used before the wheel has been calibrated. */
    defaultAxis: 0,
    deadzone: 0.04,
    /** Minimum axis range accepted during calibration. */
    minCalibrationRange: 0.3,
  },

  mixer: {
    MANUAL_IDLE_TIMEOUT_MS: 8000,
    INPUT_ACTIVITY_THRESHOLD: 0.03,
    /** Manual → autopilot hand-back blend duration. */
    AUTOPILOT_BLEND_MS: 1000,
  },

  driving: {
    /** Constant forward speed in m/s (~27 km/h). */
    speed: 7.5,
    /** Lateral speed at full steering lock, m/s. */
    maxLateralSpeed: 4.2,
    /** How fast lateral velocity follows steering (1/s). */
    lateralResponse: 6,
    /** Beyond this offset the vehicle is gently pushed back. */
    softLimit: 2.4,
    /** The vehicle can never go beyond this offset from the road centre. */
    hardLimit: 3.3,
    /** Spring pulling the vehicle back once it is past the soft limit (1/s²). */
    softSpring: 5,
    /** Maximum visual yaw relative to the road, radians. */
    maxYaw: 0.28,
  },

  autopilot: {
    /** Proportional gain from offset error to steering. */
    gain: 0.9,
    /** Damping on lateral velocity. */
    damping: 0.35,
    /** Low-frequency lateral wander (metres, seconds). */
    wander: [
      { amplitude: 0.7, period: 23 },
      { amplitude: 0.35, period: 9.5 },
    ],
    /** How far ahead the road curvature is sampled, metres. */
    lookahead: 25,
    /** Offset toward the inside of curves per unit curvature. */
    curveLean: 60,
    maxSteering: 0.6,
    /** Maximum change of autopilot steering per second. */
    maxSteeringRate: 1.8,
  },

  road: {
    halfWidth: 4,
    shoulderWidth: 2.5,
    /** Length of one road texture repeat, metres. */
    textureLength: 12,
  },

  world: {
    chunkLength: 40,
    chunksAhead: 6,
    chunksBehind: 2,
    segmentsPerChunk: 16,
    terrainSize: 700,
  },

  camera: {
    distance: 11.5,
    height: 5.8,
    lookAhead: 14,
    fov: 58,
    /** Camera follow smoothing (1/s). Lower = calmer. */
    followRate: 3.5,
    /** Sideways camera shift at full steering, metres. */
    steerShift: 0.6,
    far: 260,
  },

  renderer: {
    maxPixelRatio: 1.5,
  },

  parentMenu: {
    holdMs: 2000,
    /** Size of the hidden long-press corner, px. */
    cornerSize: 72,
  },

  drawings: {
    maxUploadSide: 1536,
    uploadQuality: 0.9,
    requestTimeoutMs: 90_000,
    spriteHeight: 3.6,
    maxStaticSprites: 14,
    maxMovingSprites: 4,
    staticSpacing: { min: 30, max: 55 },
    movingIntervalSec: { min: 8, max: 16 },
    spawnDistance: 150,
  },
} as const;

export type GameConfig = typeof CONFIG;
