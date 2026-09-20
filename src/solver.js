import { getModel, initialConditions, effectiveBeta } from './models.js';

/**
 * One classical Runge–Kutta 4 step.
 * @param {number[]} y
 * @param {(y: number[], p: object) => number[]} derivatives
 * @param {object} params
 * @param {number} dt
 * @returns {number[]}
 */
export function rk4Step(y, derivatives, params, dt) {
  const k1 = derivatives(y, params);
  const k2 = derivatives(y.map((v, i) => v + (k1[i] * dt) / 2), params);
  const k3 = derivatives(y.map((v, i) => v + (k2[i] * dt) / 2), params);
  const k4 = derivatives(y.map((v, i) => v + k3[i] * dt), params);
  return y.map((v, i) => v + ((k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]) * dt) / 6);
}

/**
 * Integrate a model over `days`.
 *
 * Returns one record per whole day: `{ day, values: {S, I, …}, re }`.
 * `re` is the effective reproduction number at that moment. The original computed
 * it as `(beta / gamma) * (S / N)` using the *raw* beta, so an active lockdown
 * never showed up in the R-effective chart — the one panel whose entire purpose
 * is to show an intervention working. It uses the intervention-adjusted beta here.
 *
 * @param {{model: string, days: number, dt?: number, N: number, I0: number,
 *          E0?: number, beta: number, gamma: number, sigma?: number, mu?: number,
 *          nu?: number, vaxEfficacy?: number,
 *          lockdown?: {enabled?: boolean, startDay?: number, reduction?: number}}} params
 * @returns {{day: number, values: Record<string, number>, re: number}[]}
 */
export function simulate(params) {
  const { model, days, dt = 1, N } = params;
  if (!(days > 0)) throw new Error('days must be positive');
  if (!(dt > 0)) throw new Error('dt must be positive');

  const { compartments, derivatives } = getModel(model);
  let y = initialConditions(model, params);

  const out = [];
  const stepsPerDay = Math.max(1, Math.round(1 / dt));

  for (let day = 0; day <= days; day++) {
    const lockdown = {
      active: Boolean(params.lockdown?.enabled) && day >= (params.lockdown?.startDay ?? 0),
      reduction: params.lockdown?.reduction ?? 0
    };
    const stepParams = { ...params, lockdown };

    const values = {};
    compartments.forEach((c, i) => {
      values[c] = y[i];
    });

    out.push({ day, values, re: effectiveR(model, stepParams, values[compartments[0]], N) });

    for (let s = 0; s < stepsPerDay && day < days; s++) {
      y = rk4Step(y, derivatives, stepParams, dt);
      // Compartments are counts of people; negatives are integration noise.
      y = y.map((v) => (v < 0 ? 0 : v));
    }
  }
  return out;
}

/**
 * Basic reproduction number — the value in a wholly susceptible population,
 * before any intervention.
 *
 * The original computed SIRV's R0 as `(beta / gamma) * (1 - efficacy)`. Vaccine
 * efficacy does not change R0; it changes the *effective* reproduction number.
 * R0 is a property of the pathogen and the contact structure, so all four models
 * share `beta / gamma` here, and the vaccination effect appears in
 * {@link effectiveR} where it belongs.
 *
 * @param {{beta: number, gamma: number}} params
 * @returns {number}
 */
export function basicReproductionNumber({ beta, gamma }) {
  if (!(gamma > 0)) throw new Error('gamma must be positive');
  return beta / gamma;
}

/**
 * Effective reproduction number: R0 scaled by the susceptible fraction and by
 * any active intervention.
 * @returns {number}
 */
export function effectiveR(model, params, S, N) {
  const { gamma } = params;
  if (!(gamma > 0) || !(N > 0)) return 0;
  return (effectiveBeta(params.beta, params.lockdown) / gamma) * (S / N);
}

/**
 * Herd-immunity threshold as a percentage of the population.
 * Below R0 = 1 there is no threshold to reach, so it is zero rather than negative.
 * @param {number} r0
 * @returns {number}
 */
export function herdImmunityThreshold(r0) {
  if (!(r0 > 1)) return 0;
  return (1 - 1 / r0) * 100;
}
