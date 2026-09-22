/**
 * DOM binding and the animation loop. The only module that touches `document`;
 * every number it renders comes from the pure layer.
 */
import { mountExecShell } from './exec-shell.js';
import { simulate, basicReproductionNumber, herdImmunityThreshold } from './solver.js';
import { getModel, MODEL_KEYS } from './models.js';
import { PRESETS } from './presets.js';
import {
  peakInfection, totalInfected, totalDeaths, hospitalPeak, outbreakDuration, formatNumber
} from './metrics.js';
import {
  loadChartLib, createEpidemicChart, createReChart, createPhaseChart,
  createComparisonChart, renderLegend
} from './charts.js';

const $ = (id) => document.getElementById(id);

const EQUATIONS = {
  sir:  ['dS/dt = −β·S·I/N', 'dI/dt = β·S·I/N − γ·I', 'dR/dt = γ·I'],
  seir: ['dS/dt = −β·S·I/N', 'dE/dt = β·S·I/N − σ·E', 'dI/dt = σ·E − γ·I', 'dR/dt = γ·I'],
  sird: ['dS/dt = −β·S·I/N', 'dI/dt = β·S·I/N − γ·I', 'dR/dt = γ·I·(1−μ)', 'dD/dt = γ·I·μ'],
  sirv: ['dS/dt = −β·S·I/N − ν·e·S', 'dI/dt = β·S·I/N − γ·I', 'dR/dt = γ·I', 'dV/dt = ν·e·S']
};

const state = {
  model: 'sir',
  N: 1_000_000, I0: 10, beta: 0.3, gamma: 0.1, sigma: 0.2, mu: 0.02, nu: 0.01, vaxEfficacy: 0.9,
  days: 180, speed: 30,
  lockdown: { enabled: false, startDay: 30, reduction: 50 },
  series: [], day: 180, running: false, rafId: 0, startedAt: 0
};

let charts = { epidemic: null, re: null, phase: null, comparison: null };

/* ------------------------------------------------------------------ compute */

function params() {
  return {
    model: state.model, days: state.days, N: state.N, I0: state.I0,
    beta: state.beta, gamma: state.gamma, sigma: state.sigma,
    mu: state.mu, nu: state.nu, vaxEfficacy: state.vaxEfficacy,
    lockdown: state.lockdown
  };
}

function recompute() {
  state.series = simulate(params());
  state.day = Math.min(state.day, state.days);
}

/* ------------------------------------------------------------------- render */

function setStatus(text, cls) {
  $('simulation-status').textContent = text;
  $('status-indicator').className = `status-indicator ${cls}`;
}

function renderR0() {
  const r0 = basicReproductionNumber(state);
  $('r-naught-display').textContent = r0.toFixed(2);
  let interp = 'Explosive outbreak';
  if (r0 < 0.5) interp = 'Outbreak dying out';
  else if (r0 < 1) interp = 'Controlled spread';
  else if (r0 < 2) interp = 'Moderate spread';
  else if (r0 < 5) interp = 'Rapid spread';
  $('r-naught-interp').textContent = interp;
  const hit = herdImmunityThreshold(r0);
  $('herd-immunity-bar').style.width = `${hit}%`;
  $('herd-immunity-pct').textContent = `${hit.toFixed(0)}%`;
}

function renderEquations() {
  const host = $('equations-display');
  host.textContent = '';
  for (const line of EQUATIONS[state.model]) {
    const div = document.createElement('div');
    div.textContent = line;
    host.append(div);
  }
}

function renderMetrics() {
  const upTo = state.series.filter((d) => d.day <= state.day);
  const peak = peakInfection(upTo, state.N);
  $('metric-peak-infection').textContent = `${peak.peakPercent.toFixed(2)}%`;
  $('metric-peak-date').textContent = `Day ${peak.peakDay}`;
  $('metric-total-infected').textContent = `${totalInfected(upTo, state.N).toFixed(1)}%`;
  const deaths = totalDeaths(upTo, state.N);
  $('metric-total-deaths').textContent = getModel(state.model).compartments.includes('D')
    ? `${deaths.toFixed(2)}%` : 'n/a';
  $('metric-hospital-peak').textContent = `${hospitalPeak(peak.peakPercent).toFixed(2)}%`;
  $('metric-duration').textContent = `Day ${outbreakDuration(upTo, state.N)}`;
}

function render() {
  const comps = getModel(state.model).compartments;
  charts.epidemic?.update(state.series, comps, state.day);
  charts.re?.update(state.series, state.day);
  charts.phase?.update(state.series, state.day);
  renderLegend($('epidemic-legend'), comps);
  renderMetrics();
  $('current-day').textContent = String(state.day);
  $('total-days').textContent = String(state.days);
  $('timeline').max = String(state.days);
  $('timeline').value = String(state.day);
  shell.refreshKpis();
}

function renderComparison() {
  if (!charts.comparison) return;
  const runs = {};
  for (const m of MODEL_KEYS) runs[m] = simulate({ ...params(), model: m });
  charts.comparison.update(runs);
}

/* ---------------------------------------------------------------- animation */

function tick(now) {
  if (!state.running) return;
  const elapsed = (now - state.startedAt) / 1000;
  state.day = Math.min(state.days, Math.floor(elapsed * state.speed));
  render();
  if (state.day >= state.days) {
    state.running = false;
    setStatus('Complete', 'is-done');
    return;
  }
  state.rafId = requestAnimationFrame(tick);
}

function run() {
  if (state.running) return;
  if (state.day >= state.days) state.day = 0;
  state.running = true;
  state.startedAt = performance.now() - (state.day / state.speed) * 1000;
  setStatus('Running', 'is-running');
  state.rafId = requestAnimationFrame(tick);
}

function pause() {
  state.running = false;
  cancelAnimationFrame(state.rafId);
  setStatus('Paused', 'is-idle');
}

function reset() {
  pause();
  recompute();
  state.day = state.days;
  setStatus('Ready', 'is-idle');
  renderR0();
  renderEquations();
  render();
  renderComparison();
}

/* ------------------------------------------------------------------- shell */

const shell = mountExecShell({
  theme: 'signal',
  accent: 'secondary',
  title: 'Epidemic Modeling Dashboard',
  tagline:
    'SIR, SEIR, SIRD and SIRV compartmental models on a Runge–Kutta 4 solver — a synthetic teaching simulation, not a forecast.',
  repo: 'https://github.com/Freddricklogan/epidemic-modeling-dashboard',
  pagesUrl: 'https://freddricklogan.github.io/epidemic-modeling-dashboard/',
  badges: [
    { label: 'Four models', tone: 'accent' },
    { label: 'RK4 solver', tone: 'ok' },
    { label: 'Client-side only', tone: 'muted' }
  ],
  kpis: [
    { label: 'Model', compute: () => state.model.toUpperCase(), tone: 'accent' },
    { label: 'R₀', compute: () => basicReproductionNumber(state).toFixed(2), tone: 'warn' },
    { label: 'Population', compute: () => formatNumber(state.N), tone: 'muted' },
    { label: 'Peak prevalence', compute: () => `${peakInfection(state.series, state.N).peakPercent.toFixed(2)}%`, tone: 'danger' },
    { label: 'Attack rate', compute: () => `${totalInfected(state.series, state.N).toFixed(1)}%`, tone: 'ok' }
  ],
  tour: [
    {
      selector: '.tab-navigation', title: 'Choose a model',
      body: 'Four compartmental models. This step switches to SEIR, which adds a latent "exposed" stage between infection and infectiousness.',
      action: () => selectModel('seir')
    },
    {
      selector: '.preset-buttons', title: 'Load a scenario',
      body: 'Textbook parameters for four pathogens. This loads measles — the most transmissible of the set, with R₀ above 7.',
      action: () => applyPreset('measles')
    },
    {
      selector: '#r-naught-display', title: 'Read R₀',
      body: 'R₀ is β/γ: how many people one case infects in a fully susceptible population. The bar below is the herd-immunity threshold it implies.',
      action: () => {}
    },
    {
      selector: '#lockdown-enabled', title: 'Intervene',
      body: 'This switches on a lockdown from day 30 at 60% contact reduction, then re-runs. Watch the peak flatten and Rₑ drop below 1.',
      action: () => {
        $('lockdown-enabled').checked = true;
        state.lockdown = { enabled: true, startDay: 30, reduction: 60 };
        $('lockdown-params').hidden = false;
        $('param-lockdown-reduction').value = '60';
        $('val-lockdown-reduction').textContent = '60%';
        reset();
      }
    },
    {
      selector: '#comparison-container', title: 'Compare all four',
      body: 'The same parameters through every model at once. SEIR peaks later because exposure delays infectiousness; SIRD ends lower because deaths leave the pool.',
      action: () => renderComparison()
    }
  ]
});

/* ------------------------------------------------------------------ wiring */

function selectModel(m) {
  if (!MODEL_KEYS.includes(m)) return;
  state.model = m;
  for (const b of document.querySelectorAll('.tab-btn')) {
    const on = b.dataset.model === m;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-pressed', String(on));
  }
  for (const el of document.querySelectorAll('.model-only')) {
    el.hidden = el.dataset.for !== m;
  }
  const comps = getModel(m).compartments;
  charts.epidemic?.destroy();
  charts.epidemic = ChartLib ? createEpidemicChart($('epidemic-chart'), ChartLib, comps) : null;
  reset();
}

function applyPreset(key) {
  const p = PRESETS[key];
  if (!p) return;
  Object.assign(state, {
    N: p.N, I0: p.I0, beta: p.beta, gamma: p.gamma,
    sigma: p.sigma, mu: p.mu, nu: p.nu, vaxEfficacy: p.vaxEfficacy
  });
  syncInputs();
  reset();
}

const FIELDS = [
  ['param-N', 'val-N', 'N', (v) => formatNumber(v)],
  ['param-I0', 'val-I0', 'I0', (v) => String(v)],
  ['param-beta', 'val-beta', 'beta', (v) => v.toFixed(3)],
  ['param-gamma', 'val-gamma', 'gamma', (v) => v.toFixed(3)],
  ['param-sigma', 'val-sigma', 'sigma', (v) => v.toFixed(3)],
  ['param-mu', 'val-mu', 'mu', (v) => v.toFixed(3)],
  ['param-nu', 'val-nu', 'nu', (v) => v.toFixed(3)],
  ['param-vax-efficacy', 'val-vax-efficacy', 'vaxEfficacy', (v) => v.toFixed(2)],
  ['param-days', 'val-days', 'days', (v) => String(v)],
  ['param-speed', 'val-speed', 'speed', (v) => String(v)]
];

function syncInputs() {
  for (const [input, out, key, fmt] of FIELDS) {
    $(input).value = String(state[key]);
    $(out).textContent = fmt(state[key]);
  }
}

for (const [input, out, key, fmt] of FIELDS) {
  $(input).addEventListener('input', () => {
    state[key] = Number($(input).value);
    $(out).textContent = fmt(state[key]);
    reset();
  });
}

for (const b of document.querySelectorAll('.tab-btn')) {
  b.addEventListener('click', () => selectModel(b.dataset.model));
}
for (const b of document.querySelectorAll('.preset-btn')) {
  b.addEventListener('click', () => applyPreset(b.dataset.preset));
}

$('lockdown-enabled').addEventListener('change', (e) => {
  state.lockdown.enabled = e.target.checked;
  $('lockdown-params').hidden = !e.target.checked;
  reset();
});
$('param-lockdown-day').addEventListener('input', (e) => {
  state.lockdown.startDay = Number(e.target.value);
  $('val-lockdown-day').textContent = e.target.value;
  reset();
});
$('param-lockdown-reduction').addEventListener('input', (e) => {
  state.lockdown.reduction = Number(e.target.value);
  $('val-lockdown-reduction').textContent = `${e.target.value}%`;
  reset();
});

$('run-btn').addEventListener('click', run);
$('pause-btn').addEventListener('click', pause);
$('reset-btn').addEventListener('click', () => { state.day = state.days; reset(); });
$('timeline').addEventListener('input', (e) => {
  pause();
  state.day = Number(e.target.value);
  render();
});

$('export-btn').addEventListener('click', () => {
  const comps = getModel(state.model).compartments;
  const header = ['day', ...comps, 'Re'].join(',');
  const rows = state.series.map((d) => [d.day, ...comps.map((c) => (d.values[c] ?? 0).toFixed(4)), d.re.toFixed(4)].join(','));
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `epidemic-${state.model}-N${state.N}-b${state.beta}-g${state.gamma}.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

/* -------------------------------------------------------------------- boot */

let ChartLib = null;
syncInputs();
recompute();
renderR0();
renderEquations();
renderMetrics();

loadChartLib().then((lib) => {
  ChartLib = lib;
  if (!lib) {
    const note = $('chart-fallback');
    if (note) note.hidden = false;
    return;
  }
  charts.epidemic = createEpidemicChart($('epidemic-chart'), lib, getModel(state.model).compartments);
  charts.re = createReChart($('r-effective-chart'), lib);
  charts.phase = createPhaseChart($('phase-portrait-chart'), lib);
  charts.comparison = createComparisonChart($('comparison-chart'), lib);
  render();
  renderComparison();
});
