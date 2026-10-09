/** Animal data and species traits. All rates are per simulation tick (1/120 day) unless noted. */

export type Species = 'deer' | 'wolf';
export type Sex = 'F' | 'M';
export type DeerState = 'wander' | 'seekFood' | 'graze' | 'seekWater' | 'drink' | 'rest' | 'alert' | 'flee' | 'herd' | 'mate';
export type WolfState = 'rest' | 'patrol' | 'search' | 'stalk' | 'chase' | 'eat' | 'pack' | 'mate' | 'recover';
export type State = DeerState | WolfState;
export type DeathCause = 'predation' | 'starvation' | 'dehydration' | 'old age' | 'natural' | 'removed';

export interface Animal {
  id: number;
  species: Species;
  sex: Sex;
  parentId: number;
  generation: number;
  // Kinematics (metres, radians, metres per tick). p* = previous tick, for render interpolation.
  x: number; z: number; px: number; pz: number;
  heading: number; pheading: number;
  speed: number;
  gait: number;
  // Physiology
  energy: number;
  hydration: number;
  stamina: number;
  age: number;        // days
  lifespan: number;   // days
  pregnantDays: number; // days of gestation left, or −1
  cooldown: number;   // days until able to reproduce again
  dryTicks: number;   // ticks spent fully dehydrated
  // Behaviour
  state: State;
  stateTicks: number;
  decideIn: number;
  tx: number; tz: number;
  targetId: number;
  fleeX: number; fleeZ: number;
  lastThreatTick: number;
  escapeTicks: number;
  attemptCooldown: number;
  packId: number;
  // Records
  kills: number;
  offspring: number;
  alive: boolean;
  cause: DeathCause | null;
}

export interface Traits {
  maxEnergy: number;
  walk: number; trot: number; sprint: number;
  turn: number;
  accel: number;
  basal: number;          // energy per tick
  moveCost: number;       // extra energy per tick at full sprint (∝ (v / sprint)²)
  sprintDrain: number;    // stamina per tick at full sprint
  staminaRegen: number;
  maturity: number;       // days
  lifespan: number;       // mean days
  lifespanSd: number;
  gestation: number;      // days
  cooldown: number;       // days between births at rate 1
  reproEnergy: number;    // minimum energy to conceive
  birthCost: number;      // energy the mother loses per offspring
  newbornEnergy: number;
  bodyMeat: number;       // meat in an adult carcass (energy units)
  radius: number;         // body radius for spacing (m)
}

export const DEER: Traits = {
  maxEnergy: 100, walk: 0.2, trot: 0.45, sprint: 0.95, turn: 0.26, accel: 0.09,
  basal: 0.038, moveCost: 0.05, sprintDrain: 1.5, staminaRegen: 0.55,
  maturity: 15, lifespan: 95, lifespanSd: 10, gestation: 7, cooldown: 8,
  reproEnergy: 62, birthCost: 26, newbornEnergy: 48, bodyMeat: 110, radius: 0.55,
};

export const WOLF: Traits = {
  maxEnergy: 100, walk: 0.24, trot: 0.52, sprint: 0.9, turn: 0.22, accel: 0.08,
  basal: 0.044, moveCost: 0.06, sprintDrain: 0.95, staminaRegen: 0.42,
  maturity: 26, lifespan: 170, lifespanSd: 18, gestation: 12, cooldown: 22,
  reproEnergy: 66, birthCost: 16, newbornEnergy: 52, bodyMeat: 0, radius: 0.5,
};

export const traitsOf = (s: Species) => (s === 'deer' ? DEER : WOLF);

/** Deer: grams of plant biomass turned into energy. */
export const DEER_GRAZE_RATE = 0.5;        // biomass per tick while grazing
export const DEER_ENERGY_PER_BIOMASS = 1.6;
export const DEER_HYDRATION_LOSS = 0.05;  // per tick (≈17 days from full to empty), raised by drought
export const DEER_DRINK_RATE = 5;
/** Wolves: meat eaten per tick from a carcass, 1 meat = 1 energy. */
export const WOLF_EAT_RATE = 1.6;
export const CARCASS_DECAY = 0.05;          // meat lost per tick to scavengers and decay (≈6 per day)

export interface Carcass { id: number; x: number; z: number; meat: number; initialMeat: number; ageTicks: number; predation: boolean }

export interface Pack { id: number; leaderId: number; breederId: number; breeder2Id: number; targetId: number; homeX: number; homeZ: number; size: number }

export const isAdult = (a: Animal) => a.age >= traitsOf(a.species).maturity;
