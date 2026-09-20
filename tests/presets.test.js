import { describe, it, expect } from 'vitest';
import { PRESETS, PRESET_KEYS, getPreset } from '../src/presets.js';
import { basicReproductionNumber } from '../src/solver.js';
import { simulate } from '../src/solver.js';

describe('presets', () => {
  it('exposes the four scenarios the UI offers', () => {
    expect(PRESET_KEYS).toEqual(['covid19', 'influenza', 'measles', 'ebola']);
  });

  it.each(PRESET_KEYS)('%s has every parameter the models need', (key) => {
    const p = getPreset(key);
    for (const f of ['N', 'I0', 'beta', 'gamma', 'sigma', 'mu', 'nu', 'vaxEfficacy']) {
      expect(Number.isFinite(p[f])).toBe(true);
    }
    expect(p.I0).toBeGreaterThan(0);
    expect(p.I0).toBeLessThan(p.N);
    expect(p.mu).toBeGreaterThanOrEqual(0);
    expect(p.mu).toBeLessThanOrEqual(1);
    expect(p.vaxEfficacy).toBeGreaterThanOrEqual(0);
    expect(p.vaxEfficacy).toBeLessThanOrEqual(1);
  });

  it('measles is the most transmissible of the set', () => {
    const r0 = (k) => basicReproductionNumber(getPreset(k));
    expect(r0('measles')).toBeGreaterThan(r0('covid19'));
    expect(r0('measles')).toBeGreaterThan(r0('influenza'));
    expect(r0('measles')).toBeGreaterThan(r0('ebola'));
  });

  it('ebola carries the highest case-fatality ratio', () => {
    expect(PRESETS.ebola.mu).toBeGreaterThan(PRESETS.covid19.mu);
    expect(PRESETS.ebola.mu).toBeGreaterThan(PRESETS.influenza.mu);
  });

  it.each(PRESET_KEYS)('%s produces a stable SIRD run', (key) => {
    const p = getPreset(key);
    const s = simulate({ ...p, model: 'sird', days: 180 });
    expect(s).toHaveLength(181);
    for (const v of Object.values(s.at(-1).values)) expect(Number.isFinite(v)).toBe(true);
  });

  it('throws on an unknown preset', () => {
    expect(() => getPreset('sars')).toThrow(/Unknown preset/);
  });
});
