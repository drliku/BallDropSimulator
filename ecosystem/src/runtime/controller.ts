/**
 * The runtime that sits between the simulation and the screen.
 *
 * - Fixed-timestep driver: real time accumulates and whole ticks run at 10 ticks per second
 *   per 1× of speed. Work per frame is capped so a slow frame cannot freeze the page.
 * - `alpha` (0–1) is how far the display is between the previous and current tick, used to
 *   interpolate animal positions smoothly.
 * - UI subscribers are notified at most ~6 times per second, so React never re-renders at
 *   the frame rate.
 */
import { Ecosystem } from '../sim/ecosystem';
import { EXPERIMENTS, type Experiment } from '../sim/experiments';
import type { HeatKind } from '../sim/heatmaps';
import { DEFAULT_PARAMS, DEFAULT_SETUP, type Params, type Setup } from '../sim/params';
import { randomSeed } from '../sim/rng';
import type { SeriesKey } from '../sim/history';

export const TICKS_PER_SECOND = 10;
export const SPEEDS = [1, 2, 5, 10] as const;
export type Speed = (typeof SPEEDS)[number];
const MAX_TICKS_PER_FRAME = 24;

export type CameraMode = 'free' | 'follow' | 'top' | 'cinematic';

export interface SavedRun {
  id: number;
  label: string;
  seed: number;
  color: string;
  data: Pick<Record<SeriesKey, number[]>, 'day' | 'deer' | 'wolves' | 'vegPct'>;
}

export interface ExperimentBaseline {
  id: string;
  startDay: number;
  deaths: { deer: Record<string, number>; wolf: Record<string, number> };
  births: { deer: number; wolf: number };
  kills: number;
  historyIndex: number;
}

type Listener = () => void;

const RUN_COLORS = ['#f2c14e', '#c084fc', '#5eead4', '#f472b6'];

export class Controller {
  sim: Ecosystem;
  /** Initial conditions used by the next reset. */
  setup: Setup;
  playing = true;
  speed: Speed = 1;
  alpha = 1;
  private acc = 0;
  /** Fraction of the target tick rate actually achieved recently (1 = keeping up). */
  throughput = 1;

  selectedId = -1;
  showRadius = false;
  cameraMode: CameraMode = 'free';
  /** Incremented to ask the camera rig to fly to a preset view. */
  cameraCommand = { kind: 'none' as 'none' | 'reset' | 'top' | 'cinematic' | 'follow', n: 0 };
  heat: HeatKind | null = null;
  dayNight = true;
  chartPaused = false;
  savedRuns: SavedRun[] = [];
  experiment: ExperimentBaseline | null = null;
  private nextRunId = 1;

  uiVersion = 0;
  private listeners = new Set<Listener>();
  private lastEmit = 0;

  constructor() {
    this.setup = { ...DEFAULT_SETUP };
    this.sim = new Ecosystem(this.setup, DEFAULT_PARAMS);
    this.markExperiment('balanced');
  }

  // ------------------------------------------------------------------ loop

  /** Called once per rendered frame with the real elapsed time in seconds. */
  frame(dt: number, now: number) {
    if (this.playing) {
      this.acc += Math.min(dt, 0.25) * this.speed * TICKS_PER_SECOND;
      let ran = 0;
      while (this.acc >= 1 && ran < MAX_TICKS_PER_FRAME) {
        this.sim.step();
        this.acc -= 1;
        ran++;
      }
      // Cap the backlog: if the machine cannot keep up, drop time instead of spiralling.
      if (this.acc > 2) { this.throughput = Math.max(0.05, this.throughput * 0.9); this.acc = 1; }
      else this.throughput = Math.min(1, this.throughput + 0.02);
      this.alpha = Math.min(1, this.acc);
      if (this.selectedId !== -1 && !this.sim.byId.has(this.selectedId)) this.onSelectedDied();
    }
    if (now - this.lastEmit > 160) this.emit(now);
  }

  subscribe = (fn: Listener) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  emit(now = performance.now()) {
    this.lastEmit = now;
    this.uiVersion++;
    for (const fn of this.listeners) fn();
  }

  // ------------------------------------------------------------------ time controls

  play() { this.playing = true; this.emit(); }
  pause() { this.playing = false; this.emit(); }
  toggle() { this.playing ? this.pause() : this.play(); }
  setSpeed(s: Speed) { this.speed = s; this.emit(); }
  stepOnce() {
    this.playing = false;
    this.sim.step();
    this.acc = 0;
    this.alpha = 1;
    this.emit();
  }

  /** Restore the initial conditions (current setup and parameters). */
  reset() {
    this.sim.reset(this.setup, this.sim.params);
    this.acc = 0; this.alpha = 1;
    this.selectedId = -1;
    if (this.cameraMode === 'follow') this.cameraMode = 'free';
    this.markExperiment(this.experiment?.id ?? 'custom');
    this.emit();
  }

  setSetup(s: Partial<Setup>) { Object.assign(this.setup, s); this.emit(); }
  newSeed() { this.setup.seed = randomSeed(); this.emit(); }
  setParams(p: Partial<Params>) { this.sim.setParams(p); this.emit(); }
  restoreDefaults() {
    this.sim.setParams({ ...DEFAULT_PARAMS });
    this.emit();
  }

  // ------------------------------------------------------------------ populations

  addDeer(n: number) { this.sim.addDeer(n); this.emit(); }
  addWolves(n: number) { this.sim.addWolves(n); this.emit(); }
  remove(species: 'deer' | 'wolf', n: number | 'all') { this.sim.remove(species, n); this.emit(); }

  // ------------------------------------------------------------------ experiments

  runExperiment(id: string) {
    const exp = EXPERIMENTS.find((e) => e.id === id) as Experiment;
    if (exp.inPlace) {
      exp.onStart?.(this.sim);
      this.markExperiment(id);
    } else {
      this.setup = { ...this.setup, ...DEFAULT_SETUP, seed: this.setup.seed, ...exp.setup };
      this.sim.reset(this.setup, { ...DEFAULT_PARAMS, ...exp.params });
      exp.onStart?.(this.sim);
      this.acc = 0;
      this.selectedId = -1;
      this.markExperiment(id);
    }
    this.playing = true;
    this.emit();
  }

  private markExperiment(id: string) {
    const c = this.sim.counters;
    this.experiment = {
      id,
      startDay: this.sim.day,
      deaths: { deer: { ...c.deaths.deer }, wolf: { ...c.deaths.wolf } },
      births: { ...c.births },
      kills: c.hunts.kills,
      historyIndex: Math.max(0, this.sim.history.length - 1),
    };
  }

  // ------------------------------------------------------------------ selection and camera

  select(id: number) {
    this.selectedId = id;
    this.emit();
  }
  deselect() {
    this.selectedId = -1;
    if (this.cameraMode === 'follow') this.cameraMode = 'free';
    this.emit();
  }
  private onSelectedDied() {
    // Keep the card informative: the selection clears, the camera stops following.
    this.selectedId = -1;
    if (this.cameraMode === 'follow') this.cameraMode = 'free';
    this.emit();
  }
  setCamera(mode: CameraMode) {
    this.cameraMode = mode;
    this.cameraCommand = { kind: mode === 'free' ? 'none' : mode, n: this.cameraCommand.n + 1 };
    this.emit();
  }
  resetCamera() {
    this.cameraMode = 'free';
    this.cameraCommand = { kind: 'reset', n: this.cameraCommand.n + 1 };
    this.emit();
  }
  follow() {
    if (this.selectedId === -1) return;
    this.setCamera('follow');
  }

  setHeat(h: HeatKind | null) { this.heat = h; this.emit(); }
  setDayNight(on: boolean) { this.dayNight = on; this.emit(); }
  setShowRadius(on: boolean) { this.showRadius = on; this.emit(); }

  // ------------------------------------------------------------------ chart and runs

  setChartPaused(on: boolean) { this.chartPaused = on; this.emit(); }
  resetHistory() {
    this.sim.history = new (this.sim.history.constructor as new () => typeof this.sim.history)();
    this.sim.history.record(this.sim);
    if (this.experiment) this.experiment.historyIndex = 0;
    this.emit();
  }
  saveRun() {
    const h = this.sim.history.data;
    const exp = EXPERIMENTS.find((e) => e.id === this.experiment?.id);
    this.savedRuns.push({
      id: this.nextRunId++,
      label: `${exp ? `${exp.letter}: ${exp.title}` : 'Custom run'} · seed ${this.sim.setup.seed}`,
      seed: this.sim.setup.seed,
      color: RUN_COLORS[(this.nextRunId - 2) % RUN_COLORS.length],
      data: { day: [...h.day], deer: [...h.deer], wolves: [...h.wolves], vegPct: [...h.vegPct] },
    });
    if (this.savedRuns.length > 4) this.savedRuns.shift();
    this.emit();
  }
  removeRun(id: number) { this.savedRuns = this.savedRuns.filter((r) => r.id !== id); this.emit(); }
}
