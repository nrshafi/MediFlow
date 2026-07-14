import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { SimState } from "../lib/types";
import { initState, tick } from "../lib/engine";

interface SimContextValue {
  state: SimState;
  play: () => void;
  pause: () => void;
  stepPrevious: () => void;
  stepNext: () => void;
  canStepPrevious: boolean;
  toggleSpeed: () => void;
  reset: () => void;
}

const SimContext = createContext<SimContextValue | null>(null);

const REAL_MS_PER_TICK = 3000; // 3 real seconds = +1 sim minute at 1×

interface SimControllerState {
  present: SimState;
  past: SimState[];
}

type SimAction =
  | { type: "finish-loading" }
  | { type: "auto-step" }
  | { type: "step-next" }
  | { type: "step-previous" }
  | { type: "play" }
  | { type: "pause" }
  | { type: "toggle-speed" }
  | { type: "reset" };

function advance(
  controller: SimControllerState,
  steps: number,
  playing: boolean,
): SimControllerState {
  const past = [...controller.past];
  let present = { ...controller.present, playing, loading: false };

  for (let i = 0; i < steps; i += 1) {
    past.push(present);
    present = tick(present);
  }

  return { present: { ...present, playing }, past };
}

function simReducer(
  controller: SimControllerState,
  action: SimAction,
): SimControllerState {
  switch (action.type) {
    case "finish-loading":
      return controller.present.loading
        ? advance(controller, 1, controller.present.playing)
        : controller;
    case "auto-step":
      return controller.present.playing
        ? advance(controller, controller.present.speed, true)
        : controller;
    case "step-next":
      return advance(controller, 1, false);
    case "step-previous": {
      const previous = controller.past.at(-1);
      if (!previous) {
        return {
          ...controller,
          present: { ...controller.present, playing: false },
        };
      }
      return {
        present: {
          ...previous,
          playing: false,
          speed: controller.present.speed,
          loading: false,
        },
        past: controller.past.slice(0, -1),
      };
    }
    case "play":
      return {
        ...controller,
        present: { ...controller.present, playing: true },
      };
    case "pause":
      return {
        ...controller,
        present: { ...controller.present, playing: false },
      };
    case "toggle-speed":
      return {
        ...controller,
        present: {
          ...controller.present,
          speed: controller.present.speed === 1 ? 4 : 1,
        },
      };
    case "reset":
      return { present: initState(), past: [] };
  }
}

export function SimProvider({ children }: { children: ReactNode }) {
  const [controller, dispatch] = useReducer(simReducer, undefined, () => ({
    present: initState(),
    past: [],
  }));
  const state = controller.present;

  // Initial "poll" skeleton, then first data.
  useEffect(() => {
    const timeout = setTimeout(() => {
      dispatch({ type: "finish-loading" });
    }, 600);
    return () => clearTimeout(timeout);
  }, []);

  // Automatic tick loop. The reducer reads the latest speed and play state.
  useEffect(() => {
    const interval = setInterval(() => {
      dispatch({ type: "auto-step" });
    }, REAL_MS_PER_TICK);
    return () => clearInterval(interval);
  }, []);

  const play = useCallback(() => dispatch({ type: "play" }), []);
  const pause = useCallback(() => dispatch({ type: "pause" }), []);
  const stepPrevious = useCallback(
    () => dispatch({ type: "step-previous" }),
    [],
  );
  const stepNext = useCallback(() => dispatch({ type: "step-next" }), []);
  const toggleSpeed = useCallback(
    () => dispatch({ type: "toggle-speed" }),
    [],
  );
  const reset = useCallback(() => dispatch({ type: "reset" }), []);

  const value = useMemo(
    () => ({
      state,
      play,
      pause,
      stepPrevious,
      stepNext,
      canStepPrevious: controller.past.length > 0,
      toggleSpeed,
      reset,
    }),
    [
      state,
      controller.past.length,
      play,
      pause,
      stepPrevious,
      stepNext,
      toggleSpeed,
      reset,
    ],
  );

  return <SimContext.Provider value={value}>{children}</SimContext.Provider>;
}

export function useSim(): SimContextValue {
  const ctx = useContext(SimContext);
  if (!ctx) throw new Error("useSim must be used within SimProvider");
  return ctx;
}

// Role (STAFF / DOCTOR / PATIENT) persisted to localStorage
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

// Sim clock formatting
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
