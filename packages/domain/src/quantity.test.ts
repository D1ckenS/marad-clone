import { describe, expect, it } from 'vitest';
import { DomainError } from './errors.js';
import {
  addQuantities,
  energyInJoule,
  formatQuantity,
  lengthInMetre,
  massInKg,
  quantitiesEqual,
  quantity,
  timeInSecond,
  volumeInLitre,
} from './quantity.js';

describe('quantity', () => {
  it('constructs a Quantity with finite value', () => {
    expect(quantity(12.5, 'kg')).toEqual({ value: 12.5, unit: 'kg' });
  });

  it('rejects non-finite values', () => {
    expect(() => quantity(NaN, 'kg')).toThrow(DomainError);
    expect(() => quantity(Infinity, 'kg')).toThrow(DomainError);
    expect(() => quantity(-Infinity, 'kg')).toThrow(DomainError);
  });
});

describe('quantitiesEqual', () => {
  it('returns true for same value AND unit', () => {
    expect(quantitiesEqual(quantity(1, 'kg'), quantity(1, 'kg'))).toBe(true);
  });
  it('returns false for different unit', () => {
    expect(quantitiesEqual(quantity(1, 'kg'), quantity(1, 'g'))).toBe(false);
  });
  it('returns false for different value', () => {
    expect(quantitiesEqual(quantity(1, 'kg'), quantity(2, 'kg'))).toBe(false);
  });
});

describe('addQuantities', () => {
  it('sums same-unit quantities', () => {
    expect(addQuantities(quantity(1, 'kg'), quantity(2, 'kg'))).toEqual({
      value: 3,
      unit: 'kg',
    });
  });
  it('throws on unit mismatch', () => {
    const a = quantity(1, 'kg');
    const b = { value: 1, unit: 'g' as const };
    expect(() => addQuantities(a as never, b as never)).toThrow(DomainError);
  });
});

describe('massInKg', () => {
  it('converts each mass unit to kg', () => {
    expect(massInKg(quantity(1, 'kg'))).toBe(1);
    expect(massInKg(quantity(1000, 'g'))).toBe(1);
    expect(massInKg(quantity(1, 'tonne'))).toBe(1000);
    expect(massInKg(quantity(1, 'lb'))).toBeCloseTo(0.45359237);
  });
});

describe('volumeInLitre', () => {
  it('converts each volume unit to litres', () => {
    expect(volumeInLitre(quantity(1, 'L'))).toBe(1);
    expect(volumeInLitre(quantity(1000, 'mL'))).toBe(1);
    expect(volumeInLitre(quantity(1, 'm3'))).toBe(1000);
    expect(volumeInLitre(quantity(1, 'gal_us'))).toBeCloseTo(3.7854118);
    expect(volumeInLitre(quantity(1, 'gal_uk'))).toBeCloseTo(4.54609);
  });
});

describe('lengthInMetre', () => {
  it('converts each length unit to metres', () => {
    expect(lengthInMetre(quantity(1, 'm'))).toBe(1);
    expect(lengthInMetre(quantity(1000, 'mm'))).toBe(1);
    expect(lengthInMetre(quantity(100, 'cm'))).toBe(1);
    expect(lengthInMetre(quantity(1, 'km'))).toBe(1000);
    expect(lengthInMetre(quantity(1, 'ft'))).toBeCloseTo(0.3048);
    expect(lengthInMetre(quantity(1, 'in'))).toBeCloseTo(0.0254);
    expect(lengthInMetre(quantity(1, 'nm'))).toBe(1852);
  });
});

describe('timeInSecond', () => {
  it('converts each time unit to seconds', () => {
    expect(timeInSecond(quantity(1, 's'))).toBe(1);
    expect(timeInSecond(quantity(1, 'min'))).toBe(60);
    expect(timeInSecond(quantity(1, 'h'))).toBe(3600);
    expect(timeInSecond(quantity(1, 'd'))).toBe(86400);
  });
});

describe('energyInJoule', () => {
  it('converts each energy unit to joules', () => {
    expect(energyInJoule(quantity(1, 'J'))).toBe(1);
    expect(energyInJoule(quantity(1, 'kJ'))).toBe(1000);
    expect(energyInJoule(quantity(1, 'MJ'))).toBe(1_000_000);
    expect(energyInJoule(quantity(1, 'kWh'))).toBe(3_600_000);
  });
});

describe('formatQuantity', () => {
  it('renders as "<value> <unit>"', () => {
    expect(formatQuantity(quantity(12.5, 'kg'))).toBe('12.5 kg');
    expect(formatQuantity(quantity(0, 'pcs'))).toBe('0 pcs');
  });
});
