export type TimerMode = 'idle' | 'workout' | 'rest';

export interface WorkoutTimerState {
  mode: TimerMode;
  exerciseName: string;
  currentSet: number;
  totalSets: number;
  elapsedSeconds: number;
  restRemainingSeconds: number;
  totalRestSeconds: number;
  isPaused: boolean;
}

type Listener = (state: WorkoutTimerState) => void;

class WorkoutTimerService {
  private state: WorkoutTimerState = {
    mode: 'idle',
    exerciseName: '',
    currentSet: 1,
    totalSets: 4,
    elapsedSeconds: 0,
    restRemainingSeconds: 0,
    totalRestSeconds: 60,
    isPaused: false,
  };

  private listeners: Set<Listener> = new Set();
  private timerInterval: NodeJS.Timeout | null = null;

  getState(): WorkoutTimerState {
    return {...this.state};
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    // Deliver current state immediately so subscriber doesn't have to wait for next tick
    try {
      listener(this.getState());
    } catch {}
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * notify — broadcasts current state to all subscribers.
   * Each subscriber is called inside its own try/catch so one bad
   * subscriber (e.g. a React component that has already unmounted)
   * cannot break the ticker or silence other subscribers. (R4 fix)
   */
  private notify() {
    const current = this.getState();
    this.listeners.forEach(cb => {
      try {
        cb(current);
      } catch (e) {
        // Subscriber threw — remove it to prevent repeated errors
        this.listeners.delete(cb);
        console.warn('[WorkoutTimerService] Removed broken subscriber:', e);
      }
    });
  }

  startWorkout(
    exerciseName: string = 'Active Session',
    currentSet: number = 1,
    totalSets: number = 4,
  ) {
    this.state = {
      ...this.state,
      mode: 'workout',
      exerciseName,
      currentSet,
      totalSets,
      isPaused: false,
    };
    this.startTicker();
    this.notify();
  }

  startRest(
    seconds: number = 60,
    exerciseName?: string,
    currentSet?: number,
    totalSets?: number,
  ) {
    this.state = {
      ...this.state,
      mode: 'rest',
      restRemainingSeconds: seconds,
      totalRestSeconds: seconds,
      exerciseName: exerciseName ?? this.state.exerciseName,
      currentSet: currentSet ?? this.state.currentSet,
      totalSets: totalSets ?? this.state.totalSets,
      isPaused: false,
    };
    this.startTicker();
    this.notify();
  }

  pause() {
    if (this.state.mode === 'idle') { return; }
    this.state = {...this.state, isPaused: true};
    this.notify();
  }

  resume() {
    if (this.state.mode === 'idle') { return; }
    this.state = {...this.state, isPaused: false};
    this.notify();
  }

  stop() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.state = {
      mode: 'idle',
      exerciseName: '',
      currentSet: 1,
      totalSets: 4,
      elapsedSeconds: 0,
      restRemainingSeconds: 0,
      totalRestSeconds: 60,
      isPaused: false,
    };
    this.notify();
  }

  private startTicker() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    this.timerInterval = setInterval(() => {
      // Guard: do nothing if paused or idle
      if (this.state.isPaused || this.state.mode === 'idle') {
        return;
      }

      try {
        if (this.state.mode === 'workout') {
          this.state = {...this.state, elapsedSeconds: this.state.elapsedSeconds + 1};
          this.notify();
        } else if (this.state.mode === 'rest') {
          const nextRest = Math.max(0, this.state.restRemainingSeconds - 1);
          const nextMode: TimerMode = nextRest === 0 ? 'workout' : 'rest';
          this.state = {
            ...this.state,
            elapsedSeconds: this.state.elapsedSeconds + 1,
            restRemainingSeconds: nextRest,
            mode: nextMode,
          };
          this.notify();
        }
      } catch (e) {
        // Ticker body threw — log but keep interval alive
        console.warn('[WorkoutTimerService] Ticker error:', e);
      }
    }, 1000);
  }
}

export const workoutTimerService = new WorkoutTimerService();
