# AUDIT — Epidemic Modeling Dashboard (pre-refactor)

Audit of the previous single-file `index.html` (1,685 lines: ~350 lines of CSS,
~330 lines of markup, ~822 lines of inline JavaScript). Line numbers are from
the inline `<script>` block, which began at file line 534.

The engine was real: a Runge–Kutta 4 integrator, four compartmental models,
lockdown interventions, a phase portrait and a reproduction-number panel. The
findings are therefore mostly **defects in the mathematics and in code that could
never run**, not missing substance.

---

## A. Correctness

### A1 — The simulation could never run. `runSimulation` was declared twice.

Two function declarations shared one name in one scope:

```js
209:  function runSimulation(params) { … }   // the RK4 engine
776:  function runSimulation() {             // the UI handler
        const days = parseInt(document.getElementById('param-days').value);
        state.data = runSimulation({ model: state.model, days });   // ← calls itself
        updateCharts();
      }
```

Function declarations hoist, and the **later one wins**. So the call on line 778
resolved to the no-argument handler, not the engine — unbounded recursion,
terminating in `RangeError: Maximum call stack size exceeded` on the first click
of **Run**. Every preset button and every parameter change funnelled through the
same function, so nothing in the dashboard ever produced a curve.

**Fix:** the engine is `simulate(params)` in `src/solver.js` and the handler is
`run()` in `src/main.js`. Distinct modules, distinct names, no shadowing
possible. 26 tests in `tests/solver.test.js` exercise the engine directly.

### A2 — The SIRV model leaked people on every step.

`index.html` (inline) lines 188–206:

```js
const dS = -beta_effective * S * I / N - nu * S;
const dI =  beta_effective * S * (1 - vax_efficacy) * I / N - gamma * I;
const dR =  gamma * I;
const dV =  nu * vax_efficacy * S;
```

Two separate leaks. S shed `nu*S` while V gained only `nu*efficacy*S`, so
`nu*(1 - efficacy)*S` people vanished each step. And the flow **out** of S
(`beta*S*I/N`) did not equal the flow **into** I
(`beta*S*(1-efficacy)*I/N`), losing more. Summing the derivatives:

```
dS + dI + dR + dV  =  -nu*S*(1-efficacy) - beta*S*efficacy*I/N   ≠ 0
```

Applying efficacy to the *susceptible* force of infection is also conceptually
wrong — it protects people who have not been vaccinated.

**Fix:** vaccination moves S → V only for the fraction in whom the vaccine takes;
the rest stay susceptible. Mass is conserved exactly. `tests/models.test.js`
asserts `|Σ dy/dt| < 1e-9` for all four models and across five efficacy values,
and `tests/solver.test.js` asserts the population stays within 0.1% over a
100-day run for every model.

### A3 — R₀ for SIRV was actually R-effective.

Line 638: `R0 = (beta / gamma) * (1 - efficacy)`.

R₀ is the basic reproduction number — a property of the pathogen in a wholly
susceptible, unintervened population. Vaccine efficacy cannot change it; it
changes the *effective* reproduction number. The panel was labelled "Basic
Reproduction Number" while displaying something else, and the herd-immunity
threshold derived from it was wrong in the same direction.

**Fix:** `basicReproductionNumber()` is `beta / gamma` for all four models;
vaccination and interventions appear only in `effectiveR()`. A test asserts R₀ is
unchanged by efficacy.

### A4 — An active lockdown never appeared in the R-effective chart.

Lines 275–277:

```js
const beta = modelParams.beta;          // the RAW beta
dataPoint.values['Re'] = (beta / gamma) * (S / N);
```

The intervention-adjusted beta (`effectiveBeta`) was used for integration but not
for the reported Rₑ — so the one panel whose purpose is to show an intervention
working was blind to it.

**Fix:** `effectiveR()` uses the adjusted beta. A test asserts Rₑ drops by more
than 25% on the day a 50% lockdown begins.

### A5 — Rₑ was only computed for two of the four models.

The `if (model === 'sir') … else if (model === 'seir')` chain at lines 273–283 had
no branch for SIRD or SIRV, so `d.values['Re']` was `undefined` and the chart's
`|| 0` fallback (line 446) drew a flat line at zero for half the models.

**Fix:** Rₑ is computed once in the solver for every model. A parameterised test
asserts a non-zero day-0 Rₑ across all four.

### A6 — The attack rate omitted the dead.

Line 508: `totalInfected = ((final.values['R'] + final.values['I']) / N) * 100`.

In SIRD, everyone in D was infected too. The headline "total infected" was short
by exactly the death toll — worst in precisely the scenario where it matters most
(the Ebola preset carries μ = 0.5).

**Fix:** `totalInfected()` includes D (and E where present), with a test pinning
the SIRD case.

### A7 — "Hospital Peak" was a hard-coded guess presented as a result.

Line 514: `const hospitalPeak = (maxInfected * 0.05).toFixed(1);` — 5% of
prevalence, no parameter, no source, no label.

**Fix:** `hospitalPeak(peakPercent, hospitalizationRate = 0.05)` takes the rate as
an argument, validates it, and the UI labels the tile *"Peak beds (assumes 5%)"*
so the assumption is visible rather than implied.

---

## B. Security

### B1 — CDN script pinned but unverified.

`index.html:7` loaded `chart.js@3.9.1` from jsDelivr with no `integrity`, no
`crossorigin` and no `referrerpolicy`. The version was pinned, which is better
than most, but nothing checked that the delivered bytes were the expected bytes.

**Fix:** `integrity="sha384-9MhbyIRcBVQiiC7FSd7T38oJNj2Zh+EfxS7/vjhBi4OOT78NlHSnzM31EZRWR1LZ"`,
computed in this session against the exact artifact, plus `crossorigin="anonymous"`
and `referrerpolicy="no-referrer"`. A byte-identical copy is vendored at
`vendor/chart.min.js` and used automatically if the CDN is unreachable.

### B2 — No Content-Security-Policy was possible.

Three inline `<script>` blocks (lines 7, 378, 534) and a `<style>` block meant any
policy without `'unsafe-inline'` would have disabled the page.

**Fix:** all behaviour in ES modules under `src/`, all CSS in `src/app.css`, and a
`default-src 'none'` policy with an explicit allow-list. `frame-ancestors` is
deliberately **not** in the meta tag — Chromium ignores it there and logs a
console error.

### B3 — `innerHTML` used to build markup.

Three sites assembled HTML strings. Inputs are numeric and locally generated, so
not currently exploitable, but it is the pattern that becomes an XSS the moment a
label is user-supplied. The render layer now uses `textContent` and
`document.createElement`.

---

## C. Testability and structure

### C1 — The engine read the DOM.

`runSimulation` called `document.getElementById('param-N').value` from inside the
integration loop (lines 214–215). The mathematics could not be exercised without a
browser and a populated page.

**Fix:** `simulate()` takes a parameter object and returns data. **73 unit tests,
100% statement coverage** of `src/{models,solver,metrics,presets}.js`.

### C2 — Four duplicate copies of the same two parameters.

The markup carried `param-beta`, `param-beta-seir`, `param-beta-sird` and
`param-beta-sirv` (and the same for gamma) — one slider per model tab for a value
that means the same thing in all four. The preset handler had to write all eight
inputs by hand (lines 664–676), and any value the user set on one tab silently
diverged from the others when they switched.

**Fix:** one β slider and one γ slider, with model-specific extras (σ, μ, ν,
efficacy) shown only for the models that use them. Every parameter the original
exposed is still adjustable.

### C3 — No `package.json`, no lint config, no tests, no CI.

**Fix:** `package.json` with `test` / `coverage` / `lint` / `validate`, ESLint flat
config, `html-validate`, Vitest, and the standard `deploy.yml` + `codeql.yml`.

---

## D. Accessibility and presentation

- **D1** — Light bespoke palette instead of the standard dark tokens. **Fixed.**
- **D2** — Six inline `style="…"` attributes, which also violate a strict
  `style-src`. **Fixed:** moved to classes.
- **D3** — Metric tiles updated with no `aria-live`, so a screen-reader user heard
  nothing as the simulation ran. **Fixed.**
- **D4** — `<canvas>` elements had no accessible name. **Fixed:** `role="img"`
  plus `aria-label` on all four.
- **D5** — Model tabs were styled buttons with no pressed state exposed.
  **Fixed:** `aria-pressed` maintained on every tab.

---

## E. Copy accuracy

- **E1** — Nothing on the page said the simulation was synthetic. The tagline now
  states it is "a synthetic teaching simulation, not a forecast", and the preset
  panel says the parameters are "illustrative textbook parameters for teaching —
  not fitted estimates".
- **E2** — No measured performance claims were present, and none were added.
  Every number in the README came from a command run in this session.
