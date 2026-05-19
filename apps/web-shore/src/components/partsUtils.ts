import type { TypicalPart } from './TypicalPartsList.js';

export function partsToJson(parts: TypicalPart[]): string | undefined {
  return parts.length > 0 ? JSON.stringify(parts) : undefined;
}

export function partsFromJson(json: string | null | undefined): TypicalPart[] {
  if (!json) return [];
  try {
    return JSON.parse(json) as TypicalPart[];
  } catch {
    return [];
  }
}
