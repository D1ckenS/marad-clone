import { DomainError } from './errors.js';

export type MassUnit = 'g' | 'kg' | 'tonne' | 'lb';
export type VolumeUnit = 'mL' | 'L' | 'm3' | 'gal_us' | 'gal_uk';
export type LengthUnit = 'mm' | 'cm' | 'm' | 'km' | 'in' | 'ft' | 'nm';
export type TimeUnit = 's' | 'min' | 'h' | 'd';
export type CountUnit = 'pcs' | 'set' | 'box' | 'pair';
export type EnergyUnit = 'J' | 'kJ' | 'MJ' | 'kWh';

export type AnyUnit = MassUnit | VolumeUnit | LengthUnit | TimeUnit | CountUnit | EnergyUnit;

export interface Quantity<U extends AnyUnit = AnyUnit> {
  readonly value: number;
  readonly unit: U;
}

/** Construct a Quantity, validating value is a finite number. */
export function quantity<U extends AnyUnit>(value: number, unit: U): Quantity<U> {
  if (!Number.isFinite(value)) {
    throw new DomainError('INVALID_INPUT', `Quantity value must be finite, got ${value}`);
  }
  return { value, unit };
}

/** Equality: same unit AND same numerical value (no implicit conversion). */
export function quantitiesEqual(a: Quantity, b: Quantity): boolean {
  return a.unit === b.unit && a.value === b.value;
}

/** Sum two same-unit quantities. Throws DomainError on unit mismatch. */
export function addQuantities<U extends AnyUnit>(a: Quantity<U>, b: Quantity<U>): Quantity<U> {
  if (a.unit !== b.unit) {
    throw new DomainError(
      'INVALID_INPUT',
      `Cannot add quantities with different units: ${a.unit} vs ${b.unit}`,
    );
  }
  return { value: a.value + b.value, unit: a.unit };
}

const massToKg: Record<MassUnit, number> = {
  g: 0.001,
  kg: 1,
  tonne: 1000,
  lb: 0.45359237,
};

const volumeToLitre: Record<VolumeUnit, number> = {
  mL: 0.001,
  L: 1,
  m3: 1000,
  gal_us: 3.785411784,
  gal_uk: 4.54609,
};

const lengthToMetre: Record<LengthUnit, number> = {
  mm: 0.001,
  cm: 0.01,
  m: 1,
  km: 1000,
  in: 0.0254,
  ft: 0.3048,
  nm: 1852,
};

const timeToSecond: Record<TimeUnit, number> = {
  s: 1,
  min: 60,
  h: 3600,
  d: 86400,
};

const energyToJoule: Record<EnergyUnit, number> = {
  J: 1,
  kJ: 1000,
  MJ: 1_000_000,
  kWh: 3_600_000,
};

export function massInKg(q: Quantity<MassUnit>): number {
  return q.value * massToKg[q.unit];
}
export function volumeInLitre(q: Quantity<VolumeUnit>): number {
  return q.value * volumeToLitre[q.unit];
}
export function lengthInMetre(q: Quantity<LengthUnit>): number {
  return q.value * lengthToMetre[q.unit];
}
export function timeInSecond(q: Quantity<TimeUnit>): number {
  return q.value * timeToSecond[q.unit];
}
export function energyInJoule(q: Quantity<EnergyUnit>): number {
  return q.value * energyToJoule[q.unit];
}

/** Human-readable rendering, e.g. `12.5 kg`. */
export function formatQuantity(q: Quantity): string {
  return `${q.value} ${q.unit}`;
}
