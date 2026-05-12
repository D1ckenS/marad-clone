import { compareHlc, decodeHlc } from '@fleetops/domain';
import type { LwwField, LwwRecord } from './types.js';

/**
 * Total order over encoded HLC strings.
 * Decodes both sides and delegates to the domain compareHlc, which breaks
 * ties by nodeId — ensuring deterministic convergence without coordination.
 */
export function compareEncodedHlc(a: string, b: string): -1 | 0 | 1 {
  return compareHlc(decodeHlc(a), decodeHlc(b));
}

/**
 * Per-field LWW merge: for each field in `incoming`, keep whichever side
 * carries the higher HLC. Fields present only in `base` are kept unchanged.
 * Fields present only in `incoming` are added.
 */
export function mergeFields(
  base: LwwRecord,
  incoming: LwwRecord,
): { record: LwwRecord; changed: boolean } {
  const result: LwwRecord = { ...base };
  let changed = false;

  for (const [field, incomingField] of Object.entries(incoming)) {
    const baseField = base[field] as LwwField | undefined;
    if (baseField === undefined || compareEncodedHlc(incomingField.hlc, baseField.hlc) > 0) {
      result[field] = incomingField;
      changed = true;
    }
  }

  return { record: result, changed };
}
