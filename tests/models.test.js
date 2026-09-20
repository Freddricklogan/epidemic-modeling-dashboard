import { describe, it, expect } from 'vitest';
import {
  effectiveBeta, sirDerivatives, seirDerivatives, sirdDerivatives, sirvDerivatives,
  getModel, initialConditions, MODEL_KEYS
} from '../src/models.js';

const base = { N: 1000, beta: 0.3, gamma: 0.1, sigma: 0.2, mu: 0.02, nu: 0.01, vaxEfficacy: 0.9 };

describe('effectiveBeta', () => {
  it('returns beta unchanged with no lockdown', () => {
    expect(effectiveBeta(0.3)).toBe(0.3);
    expect(effectiveBeta(0.3, { active: false, reduction: 50 })).toBe(0.3);
  });
  it('reduces beta by the percentage when active', () => {
    expect(effectiveBeta(0.3, { active: true, reduction: 50 })).toBeCloseTo(0.15, 12);
  });
  it('clamps the reduction into 0..100', () => {
    expect(effectiveBeta(0.3, { active: true, reduction: 200 })).toBe(0);
    expect(effectiveBeta(0.3, { active: true, reduction: -50 })).toBe(0.3);
  });
});

describe('mass conservation — derivatives must sum to zero', () => {
  // A closed population cannot gain or lose people. The original SIRV model
  // failed this: S shed nu*S while V gained only nu*efficacy*S.
  const cases = [
    ['sir', sirDerivatives, [900, 100, 0]],
    ['seir', seirDerivatives, [850, 50, 100, 0]],
    ['sird', sirdDerivatives, [900, 100, 0, 0]],
    ['sirv', sirvDerivatives, [900, 100, 0, 0]]
  ];
  it.each(cases)('%s conserves population', (_name, fn, y) => {
    const sum = fn(y, base).reduce((a, b) => a + b, 0);
    expect(Math.abs(sum)).toBeLessThan(1e-9);
  });

  it('sirv still conserves population when efficacy is partial', () => {
    for (const vaxEfficacy of [0, 0.25, 0.5, 0.75, 1]) {
      const sum = sirvDerivatives([900, 100, 0, 0], { ...base, vaxEfficacy })
        .reduce((a, b) => a + b, 0);
      expect(Math.abs(sum)).toBeLessThan(1e-9);
    }
  });
});

describe('model shapes', () => {
  it('sir returns three derivatives, seir four', () => {
    expect(sirDerivatives([900, 100, 0], base)).toHaveLength(3);
    expect(seirDerivatives([850, 50, 100, 0], base)).toHaveLength(4);
  });

  it('infection flows out of S and into I at the same rate (sir)', () => {
    const [dS, dI] = sirDerivatives([900, 100, 0], base);
    expect(-dS).toBeCloseTo(dI + base.gamma * 100, 12);
  });

  it('sird splits removal into R and D by mu', () => {
    const [, , dR, dD] = sirdDerivatives([900, 100, 0, 0], base);
    expect(dD / (dR + dD)).toBeCloseTo(base.mu, 12);
  });

  it('sirv vaccinates only the efficacious fraction', () => {
    const [, , , dV] = sirvDerivatives([900, 100, 0, 0], base);
    expect(dV).toBeCloseTo(base.nu * base.vaxEfficacy * 900, 12);
  });

  it('sirv with zero efficacy vaccinates nobody', () => {
    const [, , , dV] = sirvDerivatives([900, 100, 0, 0], { ...base, vaxEfficacy: 0 });
    expect(dV).toBe(0);
  });

  it('no infection when I is zero', () => {
    // toEqual distinguishes -0 from +0; the sign of a zero rate is meaningless.
    for (const d of sirDerivatives([1000, 0, 0], base)) expect(d).toBeCloseTo(0, 15);
  });
});

describe('getModel / initialConditions', () => {
  it.each(MODEL_KEYS)('%s resolves and seeds a full population', (key) => {
    const y = initialConditions(key, { N: 1000, I0: 10 });
    expect(y.reduce((a, b) => a + b, 0)).toBeCloseTo(1000, 9);
    expect(y).toHaveLength(getModel(key).compartments.length);
  });
  it('throws on an unknown model', () => {
    expect(() => getModel('nope')).toThrow(/Unknown model/);
    expect(() => initialConditions('nope', { N: 10, I0: 1 })).toThrow(/Unknown model/);
  });
  it('rejects impossible seeds', () => {
    expect(() => initialConditions('sir', { N: 0, I0: 1 })).toThrow(/N must be positive/);
    expect(() => initialConditions('sir', { N: 100, I0: 200 })).toThrow(/I0/);
  });
});
