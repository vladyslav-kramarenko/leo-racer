export type SessionPhase = 'idle' | 'running' | 'ending' | 'finished';

export type FinishReason = 'timeLimit';

export interface SessionState {
  phase: SessionPhase;
  /** Wall-clock time START DRIVING was pressed (or the session restarted). */
  startedAt: number | null;
  /** Play time that counts toward the limit (excludes Parent Menu time). */
  elapsedActiveMs: number;
  /** null = unlimited. */
  limitMs: number | null;
  /** Time spent in the gentle ending sequence. */
  endingElapsedMs: number;
  finishReason: FinishReason | null;
}

export const PLAY_TIME_OPTIONS: readonly (number | null)[] = [null, 5, 10, 15, 20, 30];

export function playTimeLabel(minutes: number | null): string {
  return minutes === null ? 'Unlimited' : `${minutes} min`;
}
