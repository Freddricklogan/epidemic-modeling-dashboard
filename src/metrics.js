/**
 * Outbreak summary statistics. All pure: they take a simulation series and
 * return numbers.
 */

/**
 * Peak prevalence and the day it occurs.
 * @param {{day:number, values:Record<string,number>}[]} series
 * @param {number} N
 * @returns {{peakPercent: number, peakDay: number, peakCount: number}}
 */
export function peakInfection(series, N) {
  let peakCount = 0;
  let peakDay = 0;
  for (const d of series) {
    const I = d.values.I ?? 0;
    if (I > peakCount) {
      peakCount = I;
      peakDay = d.day;
    }
  }
  return { peakCount, peakDay, peakPercent: N > 0 ? (peakCount / N) * 100 : 0 };
}

/**
 * Cumulative attack rate as a percentage of the population.
 *
 * The original computed `(final.R + final.I) / N`. In SIRD that silently
 * excludes everyone who died — they were infected too — so the headline
 * "total infected" under-reported the outbreak by exactly the death toll.
 * D is included here when the model has it.
 *
 * @param {{values:Record<string,number>}[]} series
 * @param {number} N
 * @returns {number} percentage
 */
export function totalInfected(series, N) {
  if (!series.length || !(N > 0)) return 0;
  const f = series[series.length - 1].values;
  const ever = (f.R ?? 0) + (f.I ?? 0) + (f.D ?? 0) + (f.E ?? 0);
  return (ever / N) * 100;
}

/**
 * Cumulative deaths as a percentage. Zero for models with no D compartment.
 * @returns {number}
 */
export function totalDeaths(series, N) {
  if (!series.length || !(N > 0)) return 0;
  return ((series[series.length - 1].values.D ?? 0) / N) * 100;
}

/**
 * Peak demand on hospital beds.
 *
 * The original hard-coded `maxInfected * 0.05` and labelled the result
 * "Hospital Peak" with no parameter and no stated source — an unverifiable
 * number presented as a result. The rate is now an explicit input with a
 * documented default, and the UI labels it as an assumption.
 *
 * @param {number} peakPercent peak prevalence, percent of population
 * @param {number} [hospitalizationRate] fraction of prevalent cases needing a bed
 * @returns {number} percentage of population
 */
export function hospitalPeak(peakPercent, hospitalizationRate = 0.05) {
  if (hospitalizationRate < 0 || hospitalizationRate > 1) {
    throw new Error('hospitalizationRate must be a fraction between 0 and 1');
  }
  return peakPercent * hospitalizationRate;
}

/**
 * First day on which the susceptible fraction falls below `threshold`.
 * Returns the last day if it never does.
 * @returns {number}
 */
export function outbreakDuration(series, N, threshold = 0.5) {
  if (!series.length || !(N > 0)) return 0;
  for (const d of series) {
    if ((d.values.S ?? 0) / N < threshold) return d.day;
  }
  return series[series.length - 1].day;
}

/**
 * Compact human-readable counts: 1_234_567 -> "1.23M".
 * @param {number} n
 * @returns {string}
 */
export function formatNumber(n) {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}
