import type { Ecosystem } from './ecosystem';
import type { Params, Setup } from './params';

export interface Experiment {
  id: string;
  letter: string;
  title: string;
  summary: string;
  hypotheses: string[];
  measures: string[];
  /** Overrides applied to the initial conditions on start. */
  setup?: Partial<Setup>;
  params?: Partial<Params>;
  /** If true the experiment acts on the current run instead of restarting it. */
  inPlace?: boolean;
  onStart?: (sim: Ecosystem) => void;
}

export const EXPERIMENTS: Experiment[] = [
  {
    id: 'balanced', letter: 'A', title: 'Balanced ecosystem',
    summary: 'A moderate deer herd, a few wolf packs and healthy meadows. Does a stable or cycling coexistence emerge, or does one species crash?',
    hypotheses: ['Deer and wolves persist together for many years.', 'Wolf numbers lag behind deer numbers, producing offset oscillations.', 'Vegetation stays well above its minimum.'],
    measures: ['Days both species coexist', 'Range of deer and wolf numbers', 'Lowest vegetation level'],
    setup: { initialDeer: 160, initialWolves: 14 },
    params: {},
  },
  {
    id: 'noWolves', letter: 'B', title: 'Remove all wolves',
    summary: 'Every wolf is removed from the current ecosystem at once. Without predation, deer are limited only by food, water and age.',
    hypotheses: ['Deer increase until food runs short.', 'Grazing pressure depletes the meadows.', 'Starvation replaces predation as the main cause of deer deaths.'],
    measures: ['Peak deer population', 'Lowest vegetation level', 'Deer starvation deaths'],
    inPlace: true,
    onStart: (sim) => sim.remove('wolf', 'all'),
  },
  {
    id: 'reintroduce', letter: 'C', title: 'Predator reintroduction',
    summary: 'A landscape with deer but no wolves. Let the herd grow, then reintroduce wolves with the population buttons and watch the response.',
    hypotheses: ['Deer numbers grow while wolves are absent.', 'Reintroduced wolves find abundant prey and breed.', 'Vegetation recovers once deer numbers fall.'],
    measures: ['Deer peak before reintroduction', 'Wolf growth after reintroduction', 'Vegetation recovery'],
    setup: { initialDeer: 220, initialWolves: 0 },
    params: {},
  },
  {
    id: 'drought', letter: 'D', title: 'Drought',
    summary: 'Rainfall drops and the streams shrink. Plants grow only near the remaining water and deer must travel further to drink.',
    hypotheses: ['Vegetation declines away from water.', 'Deer concentrate near water and lose condition.', 'Wolves decline after the deer do.'],
    measures: ['Lowest vegetation level', 'Deer dehydration and starvation deaths', 'Time lag between deer and wolf declines'],
    setup: { initialDeer: 160, initialWolves: 14 },
    params: { drought: 0.75, water: 0.35 },
  },
  {
    id: 'explosion', letter: 'E', title: 'Deer population explosion',
    summary: 'A very large deer herd and only a handful of wolves. Food competition and the landscape’s carrying capacity take over.',
    hypotheses: ['Deer quickly overgraze the meadows.', 'Average deer energy falls and starvation rises.', 'Deer numbers fall back toward what the plants can support.'],
    measures: ['Days until vegetation falls below 30%', 'Starvation deaths', 'Population a few months later'],
    setup: { initialDeer: 480, initialWolves: 6 },
    params: {},
  },
  {
    id: 'wolfGlut', letter: 'F', title: 'Predator overpopulation',
    summary: 'An unusually large wolf population hunts a normal deer herd. Can the predators sustain themselves?',
    hypotheses: ['Deer are depleted rapidly.', 'Wolves then starve and decline.', 'Either a smaller balance emerges or one species disappears.'],
    measures: ['Lowest deer population', 'Wolf starvation deaths', 'Whether either species goes extinct'],
    setup: { initialDeer: 160, initialWolves: 70 },
    params: {},
  },
];
