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

  tilt: {
    /** Tilt within ±deadZoneDeg of centre is ignored. */
    deadZoneDeg: 4,
    /** Tilt at which steering reaches full lock. */
    fullLockDeg: 28,
    /** Low-pass factor per 60 Hz frame (0..1, higher = more responsive). */
    smoothing: 0.18,
    /** Change needed for tilt to take steering ownership from another device. */
    activityThreshold: 0.05,
  },

  touch: {
    /** Bottom fraction of the screen that acts as the brake pedal. */
    brakeZone: 0.28,
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
    /** Normal cruising speed in m/s (~30 km/h); accelerator boosts it up to 3×. */
    speed: 8.3,
    /** Braking deceleration, m/s² (7.5 m/s → stop in ~1.2 s). */
    brakeDecel: 6,
    /** Pick-up after releasing the brake, m/s² (0 → cruise in ~2.5 s). */
    acceleration: 3,
    /** Brake-light flash frequency, Hz. Keep below 3 Hz (photosensitivity guidance). */
    brakeLightHz: 1.25,
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

  session: {
    /** Gentle ending: drive on, pull over, slow down, stop. */
    endingDurationMs: 25_000,
    /** Ending progress (0..1) at which slowing down begins / the bus is stopped. */
    slowFrom: 0.4,
    stopAt: 0.88,
    /** Lateral offset of the pull-off spot (right shoulder, inside the soft limit). */
    pullOverOffset: 2.2,
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
    /** Share of moving drawings that use real lanes instead of the roadside. */
    laneMovingChance: 0.45,
    /** Relative spawn weight per drawing frequency setting. */
    frequencyWeight: { rare: 0.35, normal: 1, often: 2.5 },
  },

  lanes: {
    /** Lane centre offset from the road centre (right-hand traffic: same direction on the right). */
    laneOffset: 1.8,
    /** Where NPCs pull over to make way for the bus. */
    shoulderOffset: 5.6,
    /** Minimum sideways gap to the bus (centre to centre) before an NPC moves aside. */
    clearance: 2.9,
    /** NPCs start moving aside when the bus is this close along the road. */
    lookAhead: 32,
    lookBehind: 10,
    /** Sideways speed of an NPC making way, m/s. */
    dodgeSpeed: 3.2,
  },

  traffic: {
    /** Pool size; also the hard cap for the busiest setting. */
    maxVehicles: 8,
    sameDirectionSpeed: 0.65,
    oppositeDirectionSpeed: 0.75,
    /** Overtakers (e.g. the sports car in Nature) drive this many times the bus speed. */
    overtakeSpeed: 2.1,
    density: {
      off: { max: 0, intervalSec: [999, 999] },
      low: { max: 3, intervalSec: [10, 16] },
      normal: { max: 5, intervalSec: [5, 9] },
      busy: { max: 8, intervalSec: [2.5, 5] },
    },
  },
} as const;

export type GameConfig = typeof CONFIG;
