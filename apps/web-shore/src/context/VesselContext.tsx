import { createContext, useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../api/client.js';
import { useAuth } from './useAuth.js';

export interface Vessel {
  id: string;
  name: string;
  imoNumber: string | null;
}

export interface VesselContextValue {
  companyName: string; // shortName ?? name — use this everywhere in the UI
  vessels: Vessel[];
  selectedVesselId: string | null; // null = "all vessels"
  isVesselLocked: boolean; // true when JWT binds the user to one vessel
  setSelectedVesselId: (id: string | null) => void;
  reload: () => void;
}

export const VesselContext = createContext<VesselContextValue | null>(null);

const STORAGE_KEY = 'fleetops_selected_vessel';

export function VesselProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [companyName, setCompanyName] = useState('');
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [selectedVesselId, setSelectedVesselIdState] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const isVesselLocked = Boolean(user?.vesselId);

  const load = useCallback(() => {
    if (!user) return;
    // SUPER_ADMIN has no tenant — skip vessel/company fetching
    if (!user.tenantId) {
      setLoaded(true);
      return;
    }
    api
      .get<{ name: string; shortName: string | null }>('/tenants/self')
      .then((t) => setCompanyName(t.shortName ?? t.name))
      .catch(() => {});
    api
      .get<Vessel[]>('/vessels')
      .then((vs) => {
        setVessels(vs);
        if (user.vesselId) {
          setSelectedVesselIdState(user.vesselId);
        } else {
          const stored = localStorage.getItem(STORAGE_KEY);
          const stillExists = stored && vs.some((v) => v.id === stored);
          setSelectedVesselIdState(stillExists ? stored : null);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const setSelectedVesselId = useCallback(
    (id: string | null) => {
      if (isVesselLocked) return;
      setSelectedVesselIdState(id);
      if (id) {
        localStorage.setItem(STORAGE_KEY, id);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    },
    [isVesselLocked],
  );

  if (!loaded && user) {
    return null;
  }

  return (
    <VesselContext.Provider
      value={{
        companyName,
        vessels,
        selectedVesselId,
        isVesselLocked,
        setSelectedVesselId,
        reload: load,
      }}
    >
      {children}
    </VesselContext.Provider>
  );
}
