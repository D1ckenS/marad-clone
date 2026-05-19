import { useContext } from 'react';
import { VesselContext } from './VesselContext.js';
import type { VesselContextValue } from './VesselContext.js';

export function useVessel(): VesselContextValue {
  const ctx = useContext(VesselContext);
  if (!ctx) throw new Error('useVessel must be used within VesselProvider');
  return ctx;
}

export function useVesselFilter(): string | undefined {
  const { selectedVesselId } = useVessel();
  return selectedVesselId ?? undefined;
}
