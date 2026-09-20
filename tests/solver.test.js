import { describe, it, expect } from 'vitest';
import { rk4Step, simulate, basicReproductionNumber, effectiveR, herdImmunityThreshold } from '../src/solver.js';
import { sirDerivatives, MODEL_KEYS } from '../src/models.js';

const p = { model: 'sir', days: 120, N: 1_000_000, I0: 100, beta: 0.3, gamma: 0.1 };

describe('rk4Step', () => {
  it('integrates exponential decay to 4th-order accuracy', () => {
    // dy/dt = -y, exact solution e^-t
    const d = (y) => [-y[0]];
    let y = [1];
    for (let i = 0; i < 10; i++) y = rk4Step(y, d, {}, 0.1);
    // Accumulated truncation error after 10 steps at dt = 0.1 is ~3e-7, which
    // is the expected O(dt^4) behaviour -- assert that, not double precision.
    expect(y[0]).toBeCloseTo(Math.exp(-1), 6);

    // Halving dt must cut the error by roughly 2^4; that is what makes it RK4.
    const err = (dt) => {
      let v = [1];
      for (let i = 0; i < Math.round(1 / dt); i++) v = rk4Step(v, d, {}, dt);
      return Math.abs(v[0] - Math.exp(-1));
    };
    expect(err(0.05)).toBeLessThan(err(0.1) / 8);
  });

  it('leaves a system at equilibrium unchanged', () => {
    expect(rk4Step([1000, 0, 0], sirDerivatives, { N: 1000, beta: 0.3, gamma: 0.1 }, 1))
      .toEqual([1000, 0, 0]);
  });
});

describe('simulate', () => {
  it('returns one record per day inclusive of day 0', () => {
    const s = simulate({ ...p, days: 30 });
    expect(s).toHaveLength(31);
    expect(s[0].day).toBe(0);
    expect(s.at(-1).day).toBe(30);
  });

  it.each(MODEL_KEYS)('%s conserves the population across the whole run', (model) => {
    const s = simulate({ ...p, model, days: 100, sigma: 0.2, mu: 0.02, nu: 0.01, vaxEfficacy: 0.9 });
    for (const rec of s) {
      const total = Object.values(rec.values).reduce((a, b) => a + b, 0);
      expect(total).toBeGreaterThan(p.N * 0.999);
      expect(total).toBeLessThan(p.N * 1.001);
    }
  });

  it('never produces a negative compartment', () => {
    const s = simulate({ ...p, beta: 0.9, gamma: 0.05, days: 200 });
    for (const rec of s) for (const v of Object.values(rec.values)) expect(v).toBeGreaterThanOrEqual(0);
  });

  it('an epidemic with R0 > 1 grows then burns out', () => {
    const s = simulate(p);
    const peak = Math.max(...s.map((d) => d.values.I));
    expect(peak).toBeGreaterThan(p.I0);
    expect(s.at(-1).values.I).toBeLessThan(peak);
  });

  it('an epidemic with R0 < 1 never grows', () => {
    const s = simulate({ ...p, beta: 0.05, gamma: 0.1 });
    expect(Math.max(...s.map((d) => d.values.I))).toBeLessThanOrEqual(p.I0 + 1e-6);
  });

  it('lockdown lowers the peak', () => {
    const open = simulate(p);
    const locked = simulate({ ...p, lockdown: { enabled: true, startDay: 20, reduction: 60 } });
    const peakOf = (s) => Math.max(...s.map((d) => d.values.I));
    expect(peakOf(locked)).toBeLessThan(peakOf(open));
  });

  it('records a per-day effective R that reflects an active lockdown', () => {
    // The original charted Re from the raw beta, so an intervention never
    // appeared in the one panel meant to show it working.
    const locked = simulate({ ...p, lockdown: { enabled: true, startDay: 10, reduction: 50 } });
    const before = locked.find((d) => d.day === 9).re;
    const after = locked.find((d) => d.day === 10).re;
    expect(after).toBeLessThan(before * 0.75);
  });

  it.each(MODEL_KEYS)('%s reports a non-zero Re on day 0', (model) => {
    // sird and sirv previously fell through to `|| 0`, flat-lining the chart.
    const s = simulate({ ...p, model, sigma: 0.2, mu: 0.02, nu: 0.01, vaxEfficacy: 0.9 });
    expect(s[0].re).toBeGreaterThan(0);
  });

  it('rejects bad time parameters', () => {
    expect(() => simulate({ ...p, days: 0 })).toThrow(/days/);
    expect(() => simulate({ ...p, dt: 0 })).toThrow(/dt/);
  });

  it('is deterministic', () => {
    expect(simulate({ ...p, days: 40 })).toEqual(simulate({ ...p, days: 40 }));
  });
});

describe('reproduction numbers', () => {
  it('R0 is beta over gamma', () => {
    expect(basicReproductionNumber({ beta: 0.3, gamma: 0.1 })).toBeCloseTo(3, 12);
  });

  it('R0 does not depend on vaccine efficacy', () => {
    // The original multiplied SIRV's R0 by (1 - efficacy), conflating R0 with Re.
    expect(basicReproductionNumber({ beta: 0.3, gamma: 0.1, vaxEfficacy: 0.9 }))
      .toBe(basicReproductionNumber({ beta: 0.3, gamma: 0.1, vaxEfficacy: 0 }));
  });

  it('throws when gamma is zero', () => {
    expect(() => basicReproductionNumber({ beta: 0.3, gamma: 0 })).toThrow(/gamma/);
  });

  it('Re equals R0 when everyone is susceptible', () => {
    expect(effectiveR('sir', { beta: 0.3, gamma: 0.1 }, 1000, 1000)).toBeCloseTo(3, 12);
  });

  it('Re falls with the susceptible fraction', () => {
    expect(effectiveR('sir', { beta: 0.3, gamma: 0.1 }, 500, 1000)).toBeCloseTo(1.5, 12);
  });

  it('Re is zero for degenerate inputs', () => {
    expect(effectiveR('sir', { beta: 0.3, gamma: 0 }, 500, 1000)).toBe(0);
    expect(effectiveR('sir', { beta: 0.3, gamma: 0.1 }, 500, 0)).toBe(0);
  });
});

describe('herdImmunityThreshold', () => {
  it('is 1 - 1/R0 as a percentage', () => {
    expect(herdImmunityThreshold(4)).toBeCloseTo(75, 12);
  });
  it('is zero when R0 <= 1 rather than negative', () => {
    expect(herdImmunityThreshold(1)).toBe(0);
    expect(herdImmunityThreshold(0.5)).toBe(0);
  });
});
