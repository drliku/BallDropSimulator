import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useUi } from '../runtime/context';
import type { Controller } from '../runtime/controller';
import { DEER, WOLF, isAdult, traitsOf, type Animal } from '../sim/agents';
import { YEAR_DAYS } from '../sim/world';
import { seasonName } from '../sim/vegetation';
import { TICKS_PER_SECOND } from '../runtime/controller';

type Tab = 'stats' | 'inspect' | 'web' | 'model';

function Trend({ now, before }: { now: number; before: number }) {
  const d = now - before;
  const rel = before > 0 ? d / before : d > 0 ? 1 : 0;
  if (Math.abs(rel) < 0.02) return <span className="text-ink-faint" title="Stable over the last 5 days">→</span>;
  return d > 0
    ? <span className="text-forest-soft" title="Rising over the last 5 days">▲</span>
    : <span className="text-wolf" title="Falling over the last 5 days">▼</span>;
}

function Stat({ label, value, sub, color, trend }: { label: string; value: ReactNode; sub?: ReactNode; color?: string; trend?: ReactNode }) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-black/20 px-3 py-2">
      <div className="flex items-center justify-between gap-2 text-[11.5px] text-ink-muted"><span>{label}</span>{trend}</div>
      <div className="font-mono text-[19px] font-medium leading-tight" style={{ color }}>{value}</div>
      {sub && <div className="font-mono text-[11px] text-ink-faint">{sub}</div>}
    </div>
  );
}

function Stats() {
  const ctl = useUi();
  const sim = ctl.sim;
  const h = sim.history;
  const c = sim.counters;
  const deaths = (s: 'deer' | 'wolf') => sim.totalDeaths(s);
  const vegPct = (100 * sim.veg.total()) / Math.max(1, sim.veg.totalCapacity());
  const dc = c.deaths.deer;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Wolves" value={sim.count('wolf')} color="#e5534b" trend={<Trend now={sim.count('wolf')} before={h.ago('wolves', 5)} />} sub={`${sim.packs.size} packs`} />
        <Stat label="Deer" value={sim.count('deer')} color="#4c8eda" trend={<Trend now={sim.count('deer')} before={h.ago('deer', 5)} />} />
        <Stat label="Vegetation biomass" value={Math.round(sim.veg.total()).toLocaleString('en-US')} color="#58b368" sub={`${vegPct.toFixed(0)}% of capacity`} trend={<Trend now={vegPct} before={h.ago('vegPct', 5)} />} />
        <Stat label="Simulation time" value={`Day ${sim.day.toFixed(1)}`} sub={`Year ${Math.floor(sim.day / YEAR_DAYS) + 1} · ${seasonName(sim.day)}`} />
        <Stat label="Births" value={`${c.births.deer} / ${c.births.wolf}`} sub="deer / wolves" />
        <Stat label="Deaths" value={`${deaths('deer')} / ${deaths('wolf')}`} sub="deer / wolves" />
        <Stat label="Successful hunts" value={c.hunts.kills} sub={`${c.hunts.attempts} chases · ${c.hunts.attempts ? Math.round((100 * c.hunts.kills) / c.hunts.attempts) : 0}% success`} />
        <Stat label="Avg energy" value={`${sim.averageEnergy('deer').toFixed(0)} / ${sim.averageEnergy('wolf').toFixed(0)}`} sub="deer / wolves (of 100)" />
      </div>
      <div className="rounded-lg border border-white/[0.07] p-3 text-[12px]">
        <div className="mb-1 font-medium text-ink">Deer deaths by cause</div>
        <div className="grid grid-cols-2 gap-x-3 font-mono text-ink-muted">
          <span>predation {dc.predation}</span><span>starvation {dc.starvation}</span>
          <span>thirst {dc.dehydration}</span><span>old age {dc['old age']}</span>
          <span>other natural {dc.natural}</span><span>removed {c.removed.deer}</span>
        </div>
        <div className="mt-2 mb-1 font-medium text-ink">Wolf deaths by cause</div>
        <div className="grid grid-cols-2 gap-x-3 font-mono text-ink-muted">
          <span>starvation {c.deaths.wolf.starvation}</span><span>old age {c.deaths.wolf['old age']}</span>
          <span>other natural {c.deaths.wolf.natural}</span><span>removed {c.removed.wolf}</span>
        </div>
      </div>
      <div className="rounded-lg border border-white/[0.07] p-3">
        <div className="mb-1.5 text-[12px] font-medium text-ink">Field notes</div>
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[12px] text-ink-muted">
          {sim.events.slice(-9).reverse().map((e, i) => (
            <li key={`${e.tick}-${i}`}><span className="font-mono text-ink-faint">d{(e.tick / 120).toFixed(1)}</span> {e.text}</li>
          ))}
        </ul>
      </div>
      {ctl.throughput < 0.8 && <p className="text-[12px] text-amber-300">This device can't keep up with the chosen speed; the simulation is running slower than requested (the rules are unchanged).</p>}
    </div>
  );
}

const STATE_TEXT: Record<string, string> = {
  wander: 'Wandering', seekFood: 'Looking for food', graze: 'Grazing', seekWater: 'Heading to water', drink: 'Drinking', rest: 'Resting',
  alert: 'Alert, watching for danger', flee: 'Fleeing a predator', herd: 'Rejoining the herd', mate: 'Seeking a mate',
  patrol: 'Patrolling the territory', search: 'Following prey scent', stalk: 'Stalking prey', chase: 'Chasing prey', eat: 'Feeding at a carcass',
  pack: 'Travelling with the pack', recover: 'Recovering after a chase',
};

function bar(v: number, color: string) {
  return <div className="h-1.5 w-full overflow-hidden rounded bg-white/10"><div className="h-full rounded" style={{ width: `${Math.max(0, Math.min(100, v))}%`, background: color }} /></div>;
}

function reproStatus(a: Animal) {
  const T = traitsOf(a.species);
  if (!isAdult(a)) return `Juvenile: matures in ${(T.maturity - a.age).toFixed(0)} days`;
  if (a.pregnantDays >= 0) return `Pregnant: gives birth in ${a.pregnantDays.toFixed(1)} days`;
  if (a.sex === 'M') return 'Adult male';
  if (a.cooldown > 0) return `Recovering: can breed again in ${a.cooldown.toFixed(0)} days`;
  return a.energy >= T.reproEnergy ? 'Ready to breed' : 'Too thin to breed';
}

function health(a: Animal) {
  if (a.species === 'deer' && a.hydration <= 0) return 'Dehydrated (critical)';
  if (a.energy < 15) return 'Starving';
  if (a.species === 'deer' && a.hydration < 25) return 'Very thirsty';
  if (a.energy < 40) return 'Hungry';
  if (a.stamina < 20) return 'Exhausted';
  if (a.age > a.lifespan * 0.85) return 'Elderly';
  return 'Healthy';
}

function Inspector() {
  const ctl = useUi();
  const a = ctl.sim.byId.get(ctl.selectedId);
  if (!a) return <p className="text-[13px] leading-relaxed text-ink-muted">Click any deer or wolf in the forest to inspect it. Its card shows its needs, behaviour and life history, and you can follow it with the camera.</p>;
  const T = a.species === 'deer' ? DEER : WOLF;
  const pack = a.species === 'wolf' ? ctl.sim.packs.get(a.packId) : undefined;
  const row = (k: string, v: ReactNode) => <div className="flex justify-between gap-3 border-t border-white/[0.06] py-1.5 text-[12.5px]"><span className="text-ink-muted">{k}</span><span className="text-right font-mono text-ink">{v}</span></div>;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-display text-[20px] uppercase tracking-[0.04em]" style={{ color: a.species === 'deer' ? '#7fb3ef' : '#ff8b84' }}>{a.species === 'deer' ? 'Deer' : 'Wolf'} #{a.id}</div>
          <div className="text-[12px] text-ink-muted">{a.sex === 'F' ? 'Female' : 'Male'} · generation {a.generation}{pack ? ` · pack ${pack.id}${pack.leaderId === a.id ? ' (leader)' : ''}${pack.breederId === a.id ? ' (breeder)' : ''}` : ''}</div>
        </div>
        <span className="rounded-md border border-forest/40 bg-forest/10 px-2 py-1 text-[12px] text-forest-soft">{STATE_TEXT[a.state] ?? a.state}</span>
      </div>
      <div className="flex flex-col gap-1.5 text-[12px]">
        <div className="flex justify-between"><span className="text-ink-muted">Energy</span><span className="font-mono">{a.energy.toFixed(0)} / 100</span></div>{bar(a.energy, '#58b368')}
        <div className="flex justify-between"><span className="text-ink-muted">Hunger</span><span className="font-mono">{(100 - a.energy).toFixed(0)}%</span></div>{bar(100 - a.energy, '#e0a14b')}
        {a.species === 'deer' && (<><div className="flex justify-between"><span className="text-ink-muted">Hydration</span><span className="font-mono">{a.hydration.toFixed(0)}%</span></div>{bar(a.hydration, '#4c8eda')}</>)}
        <div className="flex justify-between"><span className="text-ink-muted">Stamina</span><span className="font-mono">{a.stamina.toFixed(0)}%</span></div>{bar(a.stamina, '#c9c27a')}
      </div>
      <div>
        {row('Age', `${a.age.toFixed(1)} days (${isAdult(a) ? 'adult' : 'juvenile'}), lifespan ~${a.lifespan.toFixed(0)}`)}
        {row('Speed', `${(a.speed * TICKS_PER_SECOND).toFixed(1)} m/s (top ${(T.sprint * TICKS_PER_SECOND).toFixed(1)})`)}
        {row('Reproduction', reproStatus(a))}
        {row('Condition', health(a))}
        {row(a.species === 'wolf' ? 'Kills' : 'Offspring', a.species === 'wolf' ? a.kills : a.offspring)}
        {a.species === 'wolf' && row('Offspring', a.offspring)}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={`btn ${ctl.cameraMode === 'follow' ? 'btn-primary' : ''}`} onClick={() => (ctl.cameraMode === 'follow' ? ctl.setCamera('free') : ctl.follow())}>{ctl.cameraMode === 'follow' ? 'Stop following' : 'Follow animal'}</button>
        <button type="button" className="btn" aria-pressed={ctl.showRadius} onClick={() => ctl.setShowRadius(!ctl.showRadius)}>{ctl.showRadius ? 'Hide' : 'Show'} {a.species === 'deer' ? 'detection' : 'sensing'} radius</button>
        <button type="button" className="btn" onClick={() => ctl.deselect()}>Deselect</button>
      </div>
    </div>
  );
}

/** Food web with flows measured from the model over the last 5 complete days. */
function FoodWeb() {
  const ctl = useUi();
  const sim = ctl.sim;
  const f = sim.recentFlows(5);
  const PLANT_ENERGY = 4; // energy units in one unit of plant biomass (gross)
  const npp = f.vegProduced * PLANT_ENERGY;
  const eatenEnergy = f.vegEaten * PLANT_ENERGY;
  const effPlantToDeer = npp > 0 ? (100 * f.deerGained) / npp : 0;
  const effDeerToWolf = f.deerGained > 0 ? (100 * f.wolfGained) / f.deerGained : 0;
  const w = (v: number) => Math.max(1.5, Math.min(22, Math.log10(1 + v) * 6));
  const sunlight = sim.season * (1 - sim.params.drought * 0.7);
  const node = (x: number, y: number, label: string, value: string, color: string) => (
    <g>
      <rect x={x - 62} y={y - 22} width={124} height={44} rx={10} fill="#1a1f1c" stroke={color} strokeWidth={1.5} />
      <text x={x} y={y - 4} textAnchor="middle" fill={color} fontSize={13} fontFamily="Brain, 'Saira Semi Condensed', sans-serif" letterSpacing={1}>{label.toUpperCase()}</text>
      <text x={x} y={y + 13} textAnchor="middle" fill="#a3b0a6" fontSize={10.5} fontFamily="'JetBrains Mono', monospace">{value}</text>
    </g>
  );
  const arrow = (x1: number, y1: number, x2: number, y2: number, width: number, color: string) => (
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={width} strokeLinecap="round" opacity={0.75} markerEnd="url(#arrow)" />
  );
  return (
    <div className="flex flex-col gap-3">
      <svg viewBox="0 0 320 400" className="w-full" role="img" aria-label="Food web with measured energy flows">
        <defs><marker id="arrow" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" refX="6" refY="6" orient="auto"><path d="M0,0 L12,6 L0,12 z" fill="#a3b0a6" /></marker></defs>
        {arrow(160, 62, 160, 108, 6, '#f2c14e')}
        {arrow(160, 152, 160, 198, w(f.deerGained), '#58b368')}
        {arrow(160, 242, 160, 288, w(f.wolfGained), '#4c8eda')}
        {arrow(222, 130, 290, 130, w(Math.max(0, npp - eatenEnergy)), '#6f7d73')}
        {arrow(222, 220, 290, 220, w(f.deerSpent), '#6f7d73')}
        {arrow(222, 310, 290, 310, w(f.wolfSpent), '#6f7d73')}
        {node(160, 40, 'Sunlight', `relative ${(sunlight * 100).toFixed(0)}%`, '#f2c14e')}
        {node(160, 130, 'Vegetation', `${npp.toFixed(0)} E/day grown`, '#58b368')}
        {node(160, 220, 'Deer', `${f.deerGained.toFixed(0)} E/day eaten`, '#4c8eda')}
        {node(160, 310, 'Wolves', `${f.wolfGained.toFixed(0)} E/day eaten`, '#e5534b')}
        <text x={300} y={118} fill="#a3b0a6" fontSize={9.5} textAnchor="end">not eaten</text>
        <text x={300} y={208} fill="#a3b0a6" fontSize={9.5} textAnchor="end">respired</text>
        <text x={300} y={298} fill="#a3b0a6" fontSize={9.5} textAnchor="end">respired</text>
        <text x={16} y={180} fill="#8fd19a" fontSize={11}>{effPlantToDeer.toFixed(1)}%</text>
        <text x={16} y={270} fill="#8fd19a" fontSize={11}>{effDeerToWolf.toFixed(1)}%</text>
        <text x={16} y={384} fill="#6f7d73" fontSize={10}>% = energy passed to the next level (5-day average)</text>
      </svg>
      <div className="grid grid-cols-1 gap-y-0.5 font-mono text-[11.5px] text-ink-muted">
        <span>deer respiration {f.deerSpent.toFixed(0)} E/d</span><span>wolf respiration {f.wolfSpent.toFixed(0)} E/d</span>
        <span>meat in carcasses {f.meatProduced.toFixed(0)} E/d</span><span>meat decayed {f.meatDecayed.toFixed(0)} E/d</span>
      </div>
      <p className="text-[12.5px] leading-relaxed text-ink-muted">
        Energy flows from sunlight to plants to deer to wolves, and most of it is lost at every step: plants that are never eaten,
        digestion losses (a deer keeps 40% of the energy in what it eats), and the energy animals burn to live and move. Here
        each level passes on only a few percent, which is why wolves are far fewer than deer. Plant energy is counted at 4
        units per unit of biomass.
      </p>
    </div>
  );
}

/** Lotka–Volterra reference: coefficients estimated from the last 30 days of the simulation. */
function Model() {
  const ctl = useUi();
  const sim = ctl.sim;
  const h = sim.history;
  const canvas = useRef<HTMLCanvasElement>(null);
  const WINDOW_DAYS = 30;
  const n = h.data.day.length;
  const start = h.data.day.findIndex((d) => d >= h.last('day') - WINDOW_DAYS);
  const span = n > 1 ? h.last('day') - h.data.day[Math.max(0, start)] : 0;
  const avg = (k: 'deer' | 'wolves') => { const a = h.data[k].slice(Math.max(0, start)); return a.reduce((s, v) => s + v, 0) / Math.max(1, a.length); };
  const N = avg('deer'), P = avg('wolves');
  const dBirthsD = h.last('deerBirths') - h.ago('deerBirths', WINDOW_DAYS);
  const dBirthsW = h.last('wolfBirths') - h.ago('wolfBirths', WINDOW_DAYS);
  const dKills = h.last('kills') - h.ago('kills', WINDOW_DAYS);
  const dDeathsW = h.last('wolfDeaths') - h.ago('wolfDeaths', WINDOW_DAYS);
  const ok = span > 5 && N > 0 && P > 0;
  const alpha = ok ? dBirthsD / (N * span) : NaN;
  const beta = ok ? dKills / (N * P * span) : NaN;
  const delta = ok ? dBirthsW / (N * P * span) : NaN;
  const gamma = ok ? dDeathsW / (P * span) : NaN;
  const fmt = (v: number) => (Number.isFinite(v) ? v.toExponential(2) : '—');

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = c.clientWidth, H = c.clientHeight;
    c.width = W * dpr; c.height = H * dpr;
    const g = c.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const xs = h.data.deer, ys = h.data.wolves;
    const mx = Math.max(10, ...xs) * 1.1, my = Math.max(5, ...ys) * 1.2;
    const X = (v: number) => 34 + (v / mx) * (W - 44), Y = (v: number) => H - 24 - (v / my) * (H - 34);
    g.strokeStyle = 'rgba(255,255,255,0.15)'; g.beginPath(); g.moveTo(34, 8); g.lineTo(34, H - 24); g.lineTo(W - 8, H - 24); g.stroke();
    g.fillStyle = '#a3b0a6'; g.font = '10px Saira'; g.fillText('deer →', W - 48, H - 8); g.save(); g.translate(12, 60); g.rotate(-Math.PI / 2); g.fillText('wolves →', 0, 0); g.restore();
    g.fillText(String(Math.round(mx)), W - 30, H - 26); g.fillText(String(Math.round(my)), 4, 14);
    // Trajectory, fading from old to new
    for (let i = 1; i < xs.length; i++) {
      g.strokeStyle = `rgba(143,209,154,${0.15 + 0.85 * (i / xs.length)})`;
      g.beginPath(); g.moveTo(X(xs[i - 1]), Y(ys[i - 1])); g.lineTo(X(xs[i]), Y(ys[i])); g.stroke();
    }
    if (xs.length) { g.fillStyle = '#fff'; g.beginPath(); g.arc(X(xs[xs.length - 1]), Y(ys[ys.length - 1]), 3.5, 0, Math.PI * 2); g.fill(); }
    // LV equilibrium and a forward projection from the current state with the fitted coefficients
    if (ok && delta > 0 && beta > 0) {
      const Ns = gamma / delta, Ps = alpha / beta;
      g.strokeStyle = '#f2c14e'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(X(Ns), Y(Ps), 5, 0, Math.PI * 2); g.stroke();
      let nn = xs[xs.length - 1], pp = ys[ys.length - 1];
      g.setLineDash([4, 4]); g.beginPath(); g.moveTo(X(nn), Y(pp));
      for (let t = 0; t < 400; t++) {
        const dt = 0.25;
        const dn = alpha * nn - beta * nn * pp, dp = delta * nn * pp - gamma * pp;
        nn = Math.max(0, nn + dn * dt); pp = Math.max(0, pp + dp * dt);
        g.lineTo(X(Math.min(nn, mx)), Y(Math.min(pp, my)));
      }
      g.stroke(); g.setLineDash([]); g.lineWidth = 1;
    }
  });

  return (
    <div className="flex flex-col gap-3 text-[12.5px] leading-relaxed text-ink-muted">
      <div className="rounded-lg border border-white/[0.07] bg-black/20 p-3 font-mono text-[12.5px] text-ink">
        <div>dN/dt = αN − βNP</div><div>dP/dt = δNP − γP</div>
      </div>
      <p>Coefficients estimated from the last {WINDOW_DAYS} days of this run (N = deer, P = wolves, per day):</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[12px] text-ink">
        <span>α = {fmt(alpha)}</span><span>β = {fmt(beta)}</span><span>δ = {fmt(delta)}</span><span>γ = {fmt(gamma)}</span>
      </div>
      <canvas ref={canvas} className="h-[200px] w-full rounded-lg border border-white/[0.07] bg-black/20" aria-label="Phase plot of wolves against deer" />
      <p><span className="text-[#8fd19a]">Green</span>: the run's path in the deer–wolf plane (cycles show as loops). <span className="text-[#f2c14e]">Gold</span>: the Lotka–Volterra equilibrium (γ/δ, α/β) and, dashed, what the equations predict from today.</p>
      <p>
        Lotka–Volterra treats animals as well-mixed numbers with constant rates. This simulation is agent-based: deer are
        limited by plants that regrow at a finite rate, water, crowding and age; wolves need to find, chase and catch individual
        deer, can only eat so fast, and only a pack's dominant female breeds. So the fitted coefficients drift over time and the
        equations are a reference, not the engine. Real cycles here come from the animals' interactions, not from the formula.
      </p>
    </div>
  );
}

export function RightPanel() {
  const ctl = useUi();
  const [tab, setTab] = useState<Tab>('stats');
  const lastSel = useRef(-1);
  useEffect(() => {
    if (ctl.selectedId !== -1 && ctl.selectedId !== lastSel.current) setTab('inspect');
    lastSel.current = ctl.selectedId;
  }, [ctl.selectedId]);
  return (
    <aside className="panel flex min-h-0 flex-col" aria-label="Statistics and details">
      <div className="flex gap-1 border-b border-white/[0.06] p-2" role="tablist">
        {(['stats', 'inspect', 'web', 'model'] as Tab[]).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className="tab" onClick={() => setTab(t)}>
            {t === 'stats' ? 'Statistics' : t === 'inspect' ? 'Animal' : t === 'web' ? 'Food web' : 'Model'}
          </button>
        ))}
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3">
        {tab === 'stats' && <Stats />}
        {tab === 'inspect' && <Inspector />}
        {tab === 'web' && <FoodWeb />}
        {tab === 'model' && <Model />}
      </div>
    </aside>
  );
}

export type { Controller };
