import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { SimState } from "../lib/types";
import { initState, tick } from "../lib/engine";

interface SimContextValue {
  state: SimState;
  play: () => void;
  pause: () => void;
  toggleSpeed: () => void;
  reset: () => void;
}

const SimContext = createContext<SimContextValue | null>(null);

const REAL_MS_PER_TICK = 3000; // 3 real seconds = +1 sim minute at 1×

export function SimProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SimState>(() => initState());
  const stateRef = useRef(state);
  stateRef.current = state;

  // Initial "poll" skeleton, then first data.
  useEffect(() => {
    const t = setTimeout(() => {
      setState((s) => tick({ ...s, loading: false }));
    }, 600);
    return () => clearTimeout(t);
  }, []);

  // Tick loop
  useEffect(() => {
    const interval = setInterval(() => {
      const s = stateRef.current;
      if (!s.playing) return;
      const steps = s.speed; // 1× => +1 min, 4× => +4 min per real 3s
      setState((prev) => {
        let next = prev;
        for (let i = 0; i < steps; i++) next = tick(next);
        return next;
      });
    }, REAL_MS_PER_TICK);
    return () => clearInterval(interval);
  }, []);

  const play = useCallback(() => setState((s) => ({ ...s, playing: true })), []);
  const pause = useCallback(() => setState((s) => ({ ...s, playing: false })), []);
  const toggleSpeed = useCallback(
    () => setState((s) => ({ ...s, speed: s.speed === 1 ? 4 : 1 })),
    [],
  );
  const reset = useCallback(() => setState(initState()), []);

  const value = useMemo(
    () => ({ state, play, pause, toggleSpeed, reset }),
    [state, play, pause, toggleSpeed, reset],
  );

  return <SimContext.Provider value={value}>{children}</SimContext.Provider>;
}

export function useSim(): SimContextValue {
  const ctx = useContext(SimContext);
  if (!ctx) throw new Error("useSim must be used within SimProvider");
  return ctx;
}

// ── Role (STAFF / DOCTOR / PATIENT) persisted to localStorage ──
export type Role = "staff" | "doctor" | "patient";
const ROLE_KEY = "mediflow.role";

export function usePersistedRole(): [Role, (r: Role) => void] {
  const [role, setRole] = useState<Role>(() => {
    if (typeof window === "undefined") return "staff";
    const stored = window.localStorage.getItem(ROLE_KEY);
    return stored === "doctor" || stored === "patient" ? stored : "staff";
  });
  const update = useCallback((r: Role) => {
    setRole(r);
    try {
      window.localStorage.setItem(ROLE_KEY, r);
    } catch {
      /* ignore */
    }
  }, []);
  return [role, update];
}

// ── Sim clock formatting ──
export function formatSimClock(minute: number): string {
  const total = 9 * 60 + minute; // start 09:00
  const h24 = Math.floor(total / 60) % 24;
  const m = total % 60;
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function formatSimTime(minute: number): string {
  const total = 9 * 60 + minute;
  const h24 = Math.floor(total / 60) % 24;
  const m = total % 60;
  const s = Math.floor((Date.now() / 1000) % 60);
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")} ${ampm}`;
}
