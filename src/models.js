/**
 * Compartmental epidemic models.
 *
 * Every model is a pure function `(y, params) -> dy/dt`. No DOM, no globals —
 * the original read `document.getElementById('param-N').value` from inside the
 * simulation engine, which made the maths untestable.
 *
 * Invariant every model must satisfy: the compartments are a closed population,
 * so the derivatives must sum to zero. `tests/models.test.js` asserts this for
 * all four. The original SIRV model violated it (see `effectiveBeta` note below).
 */

/**
 * Transmission rate after any active non-pharmaceutical intervention.
 * @param {number} beta
 * @param {{active?: boolean, reduction?: number}} [lockdown] reduction is a percentage
 * @returns {number}
 */
export function effectiveBeta(beta, lockdown) {
  if (!lockdown || !lockdown.active) return beta;
  const reduction = Math.max(0, Math.min(100, lockdown.reduction ?? 0));
  return beta * (1 - reduction / 100);
}

/** SIR: susceptible -> infectious -> removed. @returns {number[]} */
export function sirDerivatives(y, params) {
  const [S, I] = y;
  const { N, beta, gamma, lockdown } = params;
  const b = effectiveBeta(beta, lockdown);
  const infection = (b * S * I) / N;
  return [-infection, infection - gamma * I, gamma * I];
}

/** SEIR: adds a latent (exposed) compartment. @returns {number[]} */
export function seirDerivatives(y, params) {
  const [S, E, I] = y;
  const { N, beta, sigma, gamma, lockdown } = params;
  const b = effectiveBeta(beta, lockdown);
  const infection = (b * S * I) / N;
  return [-infection, infection - sigma * E, sigma * E - gamma * I, gamma * I];
}

/** SIRD: splits removal into recovery and death by case-fatality `mu`. @returns {number[]} */
export function sirdDerivatives(y, params) {
  const [S, I] = y;
  const { N, beta, gamma, mu, lockdown } = params;
  const b = effectiveBeta(beta, lockdown);
  const infection = (b * S * I) / N;
  const removal = gamma * I;
  return [-infection, infection - removal, removal * (1 - mu), removal * mu];
}

/**
 * SIRV: adds vaccination.
 *
 * The original formulation lost people. It used
 *
 *   dS = -beta*S*I/N - nu*S
 *   dI =  beta*S*(1 - efficacy)*I/N - gamma*I
 *   dV =  nu*efficacy*S
 *
 * which has two defects. First, S shed `nu*S` while V only gained
 * `nu*efficacy*S`, so the fraction `nu*(1 - efficacy)*S` vanished from the
 * system on every step. Second, the flow out of S (`beta*S*I/N`) did not equal
 * the flow into I (`beta*S*(1 - efficacy)*I/N`), leaking again — and applying
 * efficacy there means the vaccine protects people who have not been
 * vaccinated, which is not what efficacy means.
 *
 * Here, vaccination moves people S -> V only when the vaccine takes; the
 * `(1 - efficacy)` fraction stays susceptible, which is the standard
 * leaky-vaccine-at-the-margin formulation and conserves mass exactly.
 *
 * @returns {number[]}
 */
export function sirvDerivatives(y, params) {
  const [S, I] = y;
  const { N, beta, gamma, nu, vaxEfficacy, lockdown } = params;
  const b = effectiveBeta(beta, lockdown);
  const infection = (b * S * I) / N;
  const vaccinated = nu * (vaxEfficacy ?? 0) * S;
  return [-infection - vaccinated, infection - gamma * I, gamma * I, vaccinated];
}

/** Compartment labels, in state-vector order, per model. */
export const MODELS = {
  sir: { compartments: ['S', 'I', 'R'], derivatives: sirDerivatives },
  seir: { compartments: ['S', 'E', 'I', 'R'], derivatives: seirDerivatives },
  sird: { compartments: ['S', 'I', 'R', 'D'], derivatives: sirdDerivatives },
  sirv: { compartments: ['S', 'I', 'R', 'V'], derivatives: sirvDerivatives }
};

export const MODEL_KEYS = Object.keys(MODELS);

/**
 * @param {string} key
 * @returns {{compartments: string[], derivatives: Function}}
 */
export function getModel(key) {
  const m = MODELS[key];
  if (!m) throw new Error(`Unknown model: ${key}`);
  return m;
}

/**
 * Initial state vector for a model.
 * @param {string} key
 * @param {{N: number, I0: number, E0?: number}} opts
 * @returns {number[]}
 */
export function initialConditions(key, { N, I0, E0 }) {
  if (!(N > 0)) throw new Error('N must be positive');
  if (!(I0 >= 0) || I0 > N) throw new Error('I0 must be between 0 and N');
  switch (key) {
    case 'sir':
      return [N - I0, I0, 0];
    case 'seir': {
      const e0 = E0 ?? I0 * 0.5;
      return [N - I0 - e0, e0, I0, 0];
    }
    case 'sird':
    case 'sirv':
      return [N - I0, I0, 0, 0];
    default:
      throw new Error(`Unknown model: ${key}`);
  }
}
