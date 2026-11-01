"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { normalizeLocation, type CustomerLocation } from "@/lib/geography";
const Context = createContext<{
  location: CustomerLocation | null;
  ready: boolean;
  setLocation: (v: CustomerLocation | null) => void;
}>({ location: null, ready: false, setLocation: () => {} });
const subscribe = () => () => {};
export function LocationProvider({ children }: { children: React.ReactNode }) {
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const [location, setLocation] = useState<CustomerLocation | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return normalizeLocation(
        JSON.parse(localStorage.getItem("shena.location.v1") || "null"),
      );
    } catch {
      return null;
    }
  });
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem("shena.location.v1", JSON.stringify(location));
      } catch {
        /* Session en mémoire si le stockage est indisponible. */
      }
  }, [location, ready]);
  return (
    <Context.Provider
      value={{
        location: ready ? location : null,
        ready,
        setLocation: (v) => setLocation(normalizeLocation(v)),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useLocation = () => useContext(Context);
