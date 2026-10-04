import { CONFIG } from '../game/config';
import type { SessionPhase, SessionState } from './SessionState';

/**
 * Play-time limit. Pure state machine — the Game decides what "ending" looks like.
 *
 *   idle ──start()──► running ──limit reached──► ending ──duration elapsed──► finished
 *                        ▲                                                    │
 *                        └──────────────── restart() (parent only) ───────────┘
 *
 * Time only counts while `active` (not while the Parent Menu is open).
 */
export class SessionManager {
  private readonly state: SessionState = {
    phase: 'idle',
    startedAt: null,
    elapsedActiveMs: 0,
    limitMs: null,
    endingElapsedMs: 0,
    finishReason: null,
  };

  constructor(
    limitMinutes: number | null = null,
    private readonly endingDurationMs: number = CONFIG.session.endingDurationMs,
  ) {
    this.setLimitMinutes(limitMinutes);
  }

  get phase(): SessionPhase {
    return this.state.phase;
  }

  snapshot(): Readonly<SessionState> {
    return { ...this.state };
  }

  start(now: number = Date.now()): void {
    if (this.state.phase !== 'idle') return;
    this.state.phase = 'running';
    this.state.startedAt = now;
  }

  /** Changing the limit mid-session applies to the current session. */
  setLimitMinutes(minutes: number | null): void {
    this.state.limitMs = minutes === null || !(minutes > 0) ? null : minutes * 60_000;
  }

  /** Advance time. Returns the phase after this tick. */
  tick(dtMs: number, active: boolean): SessionPhase {
    if (!active || dtMs <= 0) return this.state.phase;
    const s = this.state;
    if (s.phase === 'running') {
      s.elapsedActiveMs += dtMs;
      if (s.limitMs !== null && s.elapsedActiveMs >= s.limitMs) this.beginEnding();
    } else if (s.phase === 'ending') {
      s.endingElapsedMs += dtMs;
      if (s.endingElapsedMs >= this.endingDurationMs) s.phase = 'finished';
    }
    return s.phase;
  }

  beginEnding(): void {
    if (this.state.phase !== 'running') return;
    this.state.phase = 'ending';
    this.state.endingElapsedMs = 0;
    this.state.finishReason = 'timeLimit';
  }

  /** 0 at the start of the ending sequence, 1 when it is complete. */
  endingProgress(): number {
    if (this.state.phase === 'finished') return 1;
    if (this.state.phase !== 'ending') return 0;
    return Math.min(1, this.state.endingElapsedMs / this.endingDurationMs);
  }

  remainingMs(): number | null {
    if (this.state.limitMs === null) return null;
    return Math.max(0, this.state.limitMs - this.state.elapsedActiveMs);
  }

  /** Parent action only: begin a fresh session. */
  restart(now: number = Date.now()): void {
    this.state.phase = 'running';
    this.state.startedAt = now;
    this.state.elapsedActiveMs = 0;
    this.state.endingElapsedMs = 0;
    this.state.finishReason = null;
  }
}
