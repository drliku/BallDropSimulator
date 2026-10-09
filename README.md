# Galton Board Probability Simulator

An interactive, browser-based Galton board. Balls fall from a dispenser, bounce through
rows of pegs, and pile up in bins. Over many drops the pile becomes a binomial distribution,
and in the symmetric case it looks more and more like a normal distribution.

Styled for **The Brain Maze**: coral `#F37064` on navy `#243056`, the brain mark from the logo, and the
logo's own typeface, *Brain* by Vladimir Nikolic (`fonts/Brain.woff2`), for headings, labels and big numbers.
Body text uses Saira. Characters that Brain lacks, such as `%`, `/` and `—`, fall back to Saira Semi Condensed.

**Run it:** open `index.html` in any modern browser. There is no build step and nothing to install.

## Features

- **Canvas animation** at 60 FPS: glowing coral balls hop from peg to peg in parabolic
  arcs. Pegs, walls, and the grid are pre-rendered once, and balls are drawn from cached sprites,
  so thousands of balls stay smooth.
- **Controls:** Drop/Pause, ball count (100 / 500 / 1,000 / 5,000), peg rows (5–20),
  drop speed (1–400 balls/s), probability of bouncing right (0–100%), Reset, and Drop Single Ball.
  The single ball is traced: its path, the pegs it hits, and its L/R sequence are highlighted.
- **Live statistics:** balls dropped, landed, and in flight; observed vs. expected mean, standard
  deviation, and most-populated bin; a Pearson χ² goodness-of-fit test with p-value; total
  variation distance; and a table comparing every bin with theory.
- **Histogram:** observed counts (or probabilities) with the theoretical binomial curve, scaled
  to the number of balls that have landed. You can also overlay the normal approximation.
- **Hover** any bin, on the board or the histogram, to see its count, relative frequency,
  theoretical probability, and expected count.
- **Explanation section** covering why independent left/right choices give `C(n,k)·pᵏ(1−p)ⁿ⁻ᵏ`
  and why the shape approaches a normal curve as the number of rows grows (de Moivre–Laplace).
- Responsive layout for desktop, tablet, and mobile. Keyboard shortcuts: `Space` drop/pause,
  `S` single ball, `R` reset.

## Why the statistics are exact

A physics engine is not used to decide where a ball goes. When a ball is released, its whole route
is drawn up front: one independent Bernoulli(p) trial per row. Its bin is the number of rightward
bounces, so bin counts follow Binomial(rows, p) exactly. The animation only renders that route.
Each hop is a parabola that starts from the top of one peg and ends on the top of the next. The
peg and ball radii are scaled so that a ball never passes inside a peg, and because the walk is
confined to the peg triangle, no ball can escape the board.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page structure, controls, statistics panel, explanation |
| `styles.css` | Brain Maze theme (coral on navy) and responsive layout |
| `fonts/Brain.woff2` | Brain typeface (from the logo), converted to WOFF2 |
| `assets/brain-mark.png` | Brain mark cropped from the logo |
| `app.js` | Random walk, animation, rendering, statistics, interaction |

---

# Unit Circle Waves (`trig-waves/`)

An interactive sine and cosine simulator in The Brain Maze style: coral sine, periwinkle cosine on navy,
with the Brain typeface for headings and labels (math symbols stay in STIX Two so θ, ω and φ keep their case). A point rotates around the unit circle, and dotted
projection lines carry its height (sin θ) and horizontal position (cos θ) onto a live wave graph.
The graph uses the same vertical scale as the circle, so the projections line up exactly.

**Run it:** open `trig-waves/index.html` in a browser.

- Drag the point around the circle, or scrub along the graph. Both snap to multiples of 15°.
- Play/Pause, rotation speed, slow motion (×0.2), an angle slider, and presets for 0°, 30°, 45°, 60°, 90°, 180°, 270° and 360°.
- Amplitude, frequency and phase change the transformed waves `y = A sin(ωt + φ)` and `y = A cos(ωt + φ)`.
  The unit circle always shows the base functions, and the graph keeps them as dashed curves for comparison.
- Toggle sine and cosine separately. *Trace* draws the wave as the point turns. *Compare* slides a cosine
  copy a quarter period onto the sine wave and marks the 90° phase gap.
- The live data panel shows the angle in degrees and radians (with π form), sin, cos and tan
  (shown as "undefined" near 90° and 270°), exact values at special angles, A, ω, the period 2π/ω,
  φ, and the horizontal shift −φ/ω.
- The formula has numbers you can drag sideways to change them.
- Challenge mode gives you an angle, you predict its sine or cosine, then reveal the answer with an explanation.

---

# Time Dilation Lab (`relativity/`)

An interactive special-relativity laboratory built with React, TypeScript, Tailwind CSS and Canvas.
Styled for The Brain Maze: a coral ship and a periwinkle Earth on navy, with the Brain typeface for titles and the
large clocks (digits sit in fixed-width cells so running clocks don't jitter).
Observer A stays on Earth; observer B coasts past in a spaceship at constant velocity. Both clocks
read zero as the ship passes Earth, then show the time between that event and the ship's current event.

```bash
cd relativity
npm install
npm run dev      # local dev server
npm test         # physics + engine tests (vitest)
npm run build    # type-check and build to dist/
```

- **Physics** (`src/physics/relativity.ts`): γ = 1/√(1 − β²), Δτ = Δt/γ, using β = v/c. Formulas are
  written in cancellation-free forms (for example Δt − Δτ = Δt·β²/(1 + √(1 − β²))), so 100 km/h still
  shows its ~135 ns per year. The tests check that 10 Earth years at 0.8c give 6 ship years.
- **Single clock** (`src/sim/engine.ts`): one requestAnimationFrame loop advances Earth-frame time by
  real frame delta × playback speed (1× = one day per second). Everything else is derived from it. The run
  stops exactly at the chosen duration. Changing velocity restarts the run, so the ship stays inertial.
- **Reference frames**: the ship-frame view shows the ship clock at rest and Earth's clock running slow.
  It also shows which Earth event each frame calls simultaneous, and the γβ²τ gap between them.
- **Light clock**: a photon between mirrors, at rest and moving. The moving photon covers γL per leg.
  Mirror width contracts along the motion; the mirror gap does not.
- Live statistics, a Δτ-vs-Δt graph, three guided scenarios (100 km/h, 99% c, light clock), and tooltips.
