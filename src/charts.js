import { tokens } from './exec-shell.js';
/** Chart.js wiring. Every function here touches the DOM; none of them compute. */

export const COLOURS = { S: tokens().accent, E: tokens().warn, I: tokens().danger, R: tokens().ok, D: tokens().muted, V: tokens().series[4] };
const GRID = 'rgba(34,48,77,.6)';
const TICK = tokens().muted;

/**
 * Chart.js arrives from a CDN under SRI. If it is blocked we fall back to the
 * vendored copy, and if that also fails the caller degrades to metrics only.
 * @returns {Promise<any|null>}
 */
export async function loadChartLib() {
  if (globalThis.Chart) return globalThis.Chart;
  try {
    await import('../vendor/chart.min.js');
  } catch {
    return null;
  }
  return globalThis.Chart ?? null;
}

const baseOptions = (yTitle) => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  interaction: { mode: 'index', intersect: false },
  scales: {
    x: { ticks: { color: TICK, maxTicksLimit: 10 }, grid: { color: GRID }, title: { display: true, text: 'Day', color: TICK } },
    y: { ticks: { color: TICK }, grid: { color: GRID }, title: { display: true, text: yTitle, color: TICK } }
  },
  plugins: { legend: { display: false } }
});

/** Main epidemic curve, one dataset per compartment. */
export function createEpidemicChart(canvas, Chart, compartments) {
  if (!canvas || !Chart) return null;
  const chart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: [],
      datasets: compartments.map((c) => ({
        label: c, data: [], borderColor: COLOURS[c], backgroundColor: `${COLOURS[c]}22`,
        borderWidth: 2, pointRadius: 0, tension: 0.25, fill: true
      }))
    },
    options: baseOptions('People')
  });
  return {
    update(series, comps, upTo) {
      const slice = series.filter((d) => d.day <= upTo);
      chart.data.labels = slice.map((d) => d.day);
      chart.data.datasets = comps.map((c) => ({
        label: c, data: slice.map((d) => d.values[c] ?? 0),
        borderColor: COLOURS[c], backgroundColor: `${COLOURS[c]}22`,
        borderWidth: 2, pointRadius: 0, tension: 0.25, fill: true
      }));
      chart.update('none');
    },
    destroy: () => chart.destroy()
  };
}

/** Effective reproduction number, with the R = 1 epidemic threshold marked. */
export function createReChart(canvas, Chart) {
  if (!canvas || !Chart) return null;
  const opts = baseOptions('Rₑ');
  const chart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: { labels: [], datasets: [
      { label: 'Rₑ', data: [], borderColor: tokens().warn, backgroundColor: '#d2992222', borderWidth: 2, pointRadius: 0, tension: 0.25, fill: true },
      { label: 'R = 1', data: [], borderColor: tokens().muted, borderDash: [5, 5], borderWidth: 1, pointRadius: 0, fill: false }
    ] },
    options: opts
  });
  return {
    update(series, upTo) {
      const slice = series.filter((d) => d.day <= upTo);
      chart.data.labels = slice.map((d) => d.day);
      chart.data.datasets[0].data = slice.map((d) => d.re);
      chart.data.datasets[1].data = slice.map(() => 1);
      chart.update('none');
    },
    destroy: () => chart.destroy()
  };
}

/** Phase portrait: S on x, I on y — the trajectory, not a time series. */
export function createPhaseChart(canvas, Chart) {
  if (!canvas || !Chart) return null;
  const chart = new Chart(canvas.getContext('2d'), {
    type: 'scatter',
    data: { datasets: [{ label: 'S vs I', data: [], borderColor: tokens().accent, backgroundColor: tokens().accent, showLine: true, pointRadius: 0, borderWidth: 2 }] },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      scales: {
        x: { ticks: { color: TICK }, grid: { color: GRID }, title: { display: true, text: 'Susceptible', color: TICK } },
        y: { ticks: { color: TICK }, grid: { color: GRID }, title: { display: true, text: 'Infectious', color: TICK } }
      },
      plugins: { legend: { display: false } }
    }
  });
  return {
    update(series, upTo) {
      chart.data.datasets[0].data = series.filter((d) => d.day <= upTo)
        .map((d) => ({ x: d.values.S ?? 0, y: d.values.I ?? 0 }));
      chart.update('none');
    },
    destroy: () => chart.destroy()
  };
}

/** Infectious curve across all four models on one axis. */
export function createComparisonChart(canvas, Chart) {
  if (!canvas || !Chart) return null;
  const palette = { sir: tokens().accent, seir: tokens().warn, sird: tokens().danger, sirv: tokens().ok };
  const chart = new Chart(canvas.getContext('2d'), {
    type: 'line', data: { labels: [], datasets: [] }, options: {
      ...baseOptions('Infectious'), plugins: { legend: { display: true, labels: { color: tokens().text } } }
    }
  });
  return {
    update(runs) {
      const first = Object.values(runs)[0] ?? [];
      chart.data.labels = first.map((d) => d.day);
      chart.data.datasets = Object.entries(runs).map(([k, s]) => ({
        label: k.toUpperCase(), data: s.map((d) => d.values.I ?? 0),
        borderColor: palette[k], borderWidth: 2, pointRadius: 0, tension: 0.25, fill: false
      }));
      chart.update('none');
    },
    destroy: () => chart.destroy()
  };
}

/** Build the colour key beside the epidemic chart. */
export function renderLegend(host, compartments) {
  if (!host) return;
  host.textContent = '';
  const names = { S: 'Susceptible', E: 'Exposed', I: 'Infectious', R: 'Recovered', D: 'Deceased', V: 'Vaccinated' };
  for (const c of compartments) {
    const key = document.createElement('span');
    key.className = 'key';
    const sw = document.createElement('span');
    sw.className = 'swatch';
    sw.style.background = COLOURS[c];
    key.append(sw, document.createTextNode(names[c] ?? c));
    host.append(key);
  }
}
