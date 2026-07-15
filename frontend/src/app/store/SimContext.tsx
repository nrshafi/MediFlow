import type {
  ApiSuccess,
  OperationsSnapshot,
  SimulationResetResult,
  SimState,
} from "@mediflow/shared";
import { GEMINI_API_KEY_HEADER } from "@mediflow/shared";
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
import { apiUrl } from "../lib/api";

interface SimContextValue {
  state: SimState;
  error: string | null;
  hasGeminiFallbackKey: boolean;
  play: () => void;
  pause: () => void;
  setGeminiFallbackKey: (apiKey: string) => void;
  clearGeminiFallbackKey: () => void;
  geminiRequestHeaders: () => Record<string, string>;
  resetDemo: (resetToken: string) => Promise<void>;
  stepNext: () => Promise<void>;
  toggleSpeed: () => void;
  refresh: () => Promise<void>;
}

const SimContext = createContext<SimContextValue | null>(null);
const REAL_MS_PER_TICK = 3000;
const POLL_INTERVAL_MS = 5000;

const EMPTY_STATE: SimState = {
  minute: 0,
  playing: false,
  speed: 1,
  patients: [],
  resources: [],
  recommendations: {},
  alerts: [],
  metrics: {
    live: {
      avgWaitMin: 0,
      avgVisitMin: 0,
      utilizationPct: 0,
      avgQueueDepth: 0,
      peakQueueDepth: 0,
      patientsInHouse: 0,
      completed: 0,
    },
    baseline: {
      avgWaitMin: 0,
      avgVisitMin: 0,
      utilizationPct: 0,
      avgQueueDepth: 0,
      peakQueueDepth: 0,
      patientsInHouse: 0,
      completed: 0,
    },
  },
  loading: true,
};

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as
    | ApiSuccess<T>
    | { error?: { message?: string } };
  if (!response.ok || !("data" in body)) {
    throw new Error(
      "error" in body && body.error?.message
        ? body.error.message
        : `Request failed with status ${response.status}`,
    );
  }
  return body.data;
}

export function SimProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<OperationsSnapshot | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 4>(1);
  const [error, setError] = useState<string | null>(null);
  const [geminiFallbackKey, setGeminiFallbackKeyState] = useState("");
  const tickInFlight = useRef<Promise<void> | null>(null);

  const setGeminiFallbackKey = useCallback((apiKey: string) => {
    setGeminiFallbackKeyState(apiKey.trim());
  }, []);
  const clearGeminiFallbackKey = useCallback(() => {
    setGeminiFallbackKeyState("");
  }, []);
  const geminiRequestHeaders = useCallback(
    (): Record<string, string> =>
      geminiFallbackKey
        ? { [GEMINI_API_KEY_HEADER]: geminiFallbackKey }
        : {},
    [geminiFallbackKey],
  );

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(apiUrl("/api/operations"), {
        headers: { Accept: "application/json" },
      });
      const data = await readJson<OperationsSnapshot>(response);
      setSnapshot(data);
      if (
        data.simulation.totalPatients > 0 &&
        data.simulation.completedPatients === data.simulation.totalPatients
      ) {
        setPlaying(false);
      }
      setError(null);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load live hospital state",
      );
    }
  }, []);

  const stepNext = useCallback((): Promise<void> => {
    if (tickInFlight.current) return tickInFlight.current;

    const request = (async () => {
      try {
        const response = await fetch(apiUrl("/api/simulation/tick"), {
          method: "POST",
          headers: {
            Accept: "application/json",
            ...geminiRequestHeaders(),
          },
        });
        await readJson(response);
        await refresh();
      } catch (requestError) {
        setPlaying(false);
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to advance the simulation",
        );
      }
    })();
    tickInFlight.current = request;
    void request.finally(() => {
      if (tickInFlight.current === request) tickInFlight.current = null;
    });
    return request;
  }, [geminiRequestHeaders, refresh]);

  const resetDemo = useCallback(
    async (resetToken: string) => {
      setPlaying(false);
      const pendingTick = tickInFlight.current;
      if (pendingTick) await pendingTick;

      const response = await fetch(apiUrl("/api/simulation/reset"), {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${resetToken.trim()}`,
        },
      });
      await readJson<SimulationResetResult>(response);
      await refresh();
    },
    [refresh],
  );

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    if (!playing) return undefined;
    const interval = window.setInterval(
      () => void stepNext(),
      REAL_MS_PER_TICK / speed,
    );
    return () => window.clearInterval(interval);
  }, [playing, speed, stepNext]);

  const play = useCallback(() => setPlaying(true), []);
  const pause = useCallback(() => setPlaying(false), []);
  const toggleSpeed = useCallback(
    () => setSpeed((current) => (current === 1 ? 4 : 1)),
    [],
  );

  const state = useMemo<SimState>(() => {
    if (!snapshot) return { ...EMPTY_STATE, playing, speed };
    return {
      minute: snapshot.simulation.minute,
      playing,
      speed,
      patients: snapshot.patients,
      resources: snapshot.resources,
      recommendations: snapshot.recommendations,
      alerts: snapshot.alerts,
      metrics: snapshot.metrics,
      loading: false,
    };
  }, [playing, snapshot, speed]);

  const value = useMemo(
    () => ({
      state,
      error,
      hasGeminiFallbackKey: Boolean(geminiFallbackKey),
      play,
      pause,
      setGeminiFallbackKey,
      clearGeminiFallbackKey,
      geminiRequestHeaders,
      resetDemo,
      stepNext,
      toggleSpeed,
      refresh,
    }),
    [
      clearGeminiFallbackKey,
      error,
      geminiFallbackKey,
      geminiRequestHeaders,
      pause,
      play,
      refresh,
      resetDemo,
      setGeminiFallbackKey,
      state,
      stepNext,
      toggleSpeed,
    ],
  );

  return <SimContext.Provider value={value}>{children}</SimContext.Provider>;
}

export function useSim(): SimContextValue {
  const context = useContext(SimContext);
  if (!context) throw new Error("useSim must be used within SimProvider");
  return context;
}

export function formatSimClock(minute: number): string {
  const total = 9 * 60 + minute;
  const hour24 = Math.floor(total / 60) % 24;
  const minutes = total % 60;
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${period}`;
}

export function formatSimTime(minute: number): string {
  return formatSimClock(minute);
}
