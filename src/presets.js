/**
 * Named scenarios. Values are illustrative textbook parameters for teaching,
 * not fitted epidemiological estimates — the UI labels them as such.
 *
 * gamma is 1 / infectious-period-in-days; sigma is 1 / incubation-period.
 */
export const PRESETS = {
  covid19: {
    name: 'COVID-19', N: 1_000_000, I0: 10,
    beta: 0.5, gamma: 0.0714, sigma: 0.2, mu: 0.01, nu: 0.005, vaxEfficacy: 0.9,
    note: '~14-day infectious period, ~5-day incubation'
  },
  influenza: {
    name: 'Influenza', N: 1_000_000, I0: 5,
    beta: 0.5, gamma: 0.33, sigma: 0.5, mu: 0.001, nu: 0.01, vaxEfficacy: 0.6,
    note: '~3-day infectious period, ~2-day incubation'
  },
  measles: {
    name: 'Measles', N: 1_000_000, I0: 2,
    beta: 0.9, gamma: 0.125, sigma: 0.2, mu: 0.002, nu: 0.02, vaxEfficacy: 0.97,
    note: '~8-day infectious period, highly transmissible'
  },
  ebola: {
    name: 'Ebola', N: 100_000, I0: 1,
    beta: 0.3, gamma: 0.1, sigma: 0.14, mu: 0.5, nu: 0, vaxEfficacy: 0.5,
    note: '~10-day infectious period, ~7-day incubation, high case fatality'
  }
};

export const PRESET_KEYS = Object.keys(PRESETS);

/** @param {string} key @returns {object} */
export function getPreset(key) {
  const p = PRESETS[key];
  if (!p) throw new Error(`Unknown preset: ${key}`);
  return p;
}
