import { describe, it, expect } from 'vitest';
import { peakInfection, totalInfected, totalDeaths, hospitalPeak, outbreakDuration, formatNumber } from '../src/metrics.js';
import { simulate } from '../src/solver.js';

const series = [
  { day: 0, values: { S: 990, I: 10, R: 0, D: 0 } },
  { day: 1, values: { S: 900, I: 90, R: 10, D: 0 } },
  { day: 2, values: { S: 400, I: 500, R: 90, D: 10 } },
  { day: 3, values: { S: 300, I: 200, R: 450, D: 50 } }
];

describe('peakInfection', () => {
  it('finds the maximum and its day', () => {
    const r = peakInfection(series, 1000);
    expect(r.peakCount).toBe(500);
    expect(r.peakDay).toBe(2);
    expect(r.peakPercent).toBeCloseTo(50, 9);
  });
  it('is zero for an empty series', () => {
    expect(peakInfection([], 1000).peakPercent).toBe(0);
  });
});

describe('totalInfected', () => {
  it('counts deaths as having been infected', () => {
    // The original summed only R + I, so in SIRD the attack rate was short by
    // exactly the death toll.
    expect(totalInfected(series, 1000)).toBeCloseTo(70, 9); // (450 + 200 + 50)/1000
  });
  it('matches R + I when there are no deaths', () => {
    expect(totalInfected([{ values: { R: 300, I: 100 } }], 1000)).toBeCloseTo(40, 9);
  });
  it('is zero for an empty series or zero population', () => {
    expect(totalInfected([], 1000)).toBe(0);
    expect(totalInfected(series, 0)).toBe(0);
  });
});

describe('totalDeaths', () => {
  it('reads the final D compartment', () => {
    expect(totalDeaths(series, 1000)).toBeCloseTo(5, 9);
  });
  it('is zero for models without a D compartment', () => {
    expect(totalDeaths([{ values: { S: 1, I: 1, R: 1 } }], 1000)).toBe(0);
  });
});

describe('hospitalPeak', () => {
  it('applies the rate to the peak', () => {
    expect(hospitalPeak(50, 0.05)).toBeCloseTo(2.5, 9);
  });
  it('defaults to 5% and is overridable', () => {
    expect(hospitalPeak(50)).toBeCloseTo(2.5, 9);
    expect(hospitalPeak(50, 0.2)).toBeCloseTo(10, 9);
  });
  it('rejects a rate outside 0..1', () => {
    expect(() => hospitalPeak(50, 1.5)).toThrow(/fraction/);
    expect(() => hospitalPeak(50, -0.1)).toThrow(/fraction/);
  });
});

describe('outbreakDuration', () => {
  it('returns the first day S drops below the threshold', () => {
    expect(outbreakDuration(series, 1000, 0.5)).toBe(2);
  });
  it('returns the final day when it never drops', () => {
    expect(outbreakDuration(series, 1000, 0.01)).toBe(3);
  });
});

describe('formatNumber', () => {
  it('scales to K, M and B', () => {
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(12_300)).toBe('12.3K');
    expect(formatNumber(1_234_567)).toBe('1.23M');
    expect(formatNumber(2_000_000_000)).toBe('2.00B');
  });
  it('handles negatives and non-finite input', () => {
    expect(formatNumber(-1500)).toBe('-1.5K');
    expect(formatNumber(NaN)).toBe('—');
  });
});

describe('end-to-end metric sanity on a real run', () => {
  it('attack rate never exceeds 100%', () => {
    const s = simulate({ model: 'sird', days: 200, N: 1e6, I0: 100, beta: 0.5, gamma: 0.1, mu: 0.02 });
    const pct = totalInfected(s, 1e6);
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThanOrEqual(100.0001);
  });
});
