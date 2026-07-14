import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useSim, formatSimClock } from "../store/SimContext";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

const ROLES: Array<{ key: string; label: string; path: string }> = [
  { key: "staff", label: "STAFF", path: "/staff" },
  { key: "doctor", label: "DOCTOR", path: "/doctor" },
  { key: "patient", label: "PATIENT", path: "/patient" },
];

function RoleSwitcher() {
  const navigate = useNavigate();
  const location = useLocation();
  const active = ROLES.find((r) => location.pathname.startsWith(r.path))?.key ?? "staff";
  return (
    <div
      className="inline-flex rounded-full p-1"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
      role="tablist"
      aria-label="Role switcher"
    >
      {ROLES.map((r) => {
        const isActive = r.key === active;
        return (
          <button
            key={r.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => {
              navigate(r.path);
              try {
                window.localStorage.setItem("mediflow.role", r.key);
              } catch {
                /* ignore */
              }
            }}
            className="font-mono rounded-full px-4 py-1.5 uppercase transition-colors"
            style={{
              fontSize: "11px",
              letterSpacing: "0.12em",
              backgroundColor: isActive ? "color-mix(in srgb, var(--accent-primary) 15%, transparent)" : "transparent",
              color: isActive ? "var(--accent-primary)" : "var(--text-muted)",
            }}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

function SimControls() {
  const { state, play, pause, toggleSpeed, reset } = useSim();
  const btn = "flex items-center justify-center rounded-md h-8 w-8 transition-colors";
  const btnStyle = { border: "1px solid var(--border-default)", color: "var(--text-primary)", backgroundColor: "var(--bg-surface)" };
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <button className={btn} style={btnStyle} onClick={() => (state.playing ? pause() : play())} aria-label={state.playing ? "Pause simulation" : "Play simulation"}>
              {state.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
          </TooltipTrigger>
          <TooltipContent>{state.playing ? "Pause" : "Play"}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="font-mono rounded-md h-8 px-2.5 uppercase transition-colors"
              style={{ ...btnStyle, fontSize: "11px", letterSpacing: "0.08em", color: "var(--accent-primary)" }}
              onClick={toggleSpeed}
              aria-label="Toggle simulation speed"
            >
              {state.speed}×
            </button>
          </TooltipTrigger>
          <TooltipContent>Speed 1× / 4×</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className={btn} style={btnStyle} onClick={reset} aria-label="Restart simulation day">
              <RotateCcw className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Restart simulation day</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

function LiveClock() {
  const { state } = useSim();
  return (
    <span className="font-mono uppercase" style={{ fontSize: "12px", letterSpacing: "0.08em", color: "var(--text-primary)" }}>
      {formatSimClock(state.minute)} · SIM DAY 1
    </span>
  );
}

export function TopBar() {
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 30 }}>
      <div
        className="flex items-center justify-between px-4 sm:px-6 gap-4 flex-wrap"
        style={{ minHeight: "60px", backgroundColor: "var(--bg-base)", borderBottom: "1px solid var(--border-default)" }}
      >
        <div className="flex items-center gap-3">
          <span style={{ fontSize: "20px", fontWeight: 600 }}>
            <span style={{ color: "var(--text-primary)" }}>Medi</span>
            <span style={{ color: "var(--accent-primary)" }}>Flow</span>
          </span>
        </div>
        <div className="order-3 w-full sm:order-2 sm:w-auto flex justify-center">
          <RoleSwitcher />
        </div>
        <div className="order-2 sm:order-3 flex items-center gap-3">
          <LiveClock />
          <SimControls />
        </div>
      </div>
    </header>
  );
}

export function PulseDot() {
  return (
    <span className="relative inline-flex" style={{ width: 7, height: 7 }}>
      <span className="absolute inset-0 rounded-full animate-ping" style={{ backgroundColor: "var(--accent-primary)", opacity: 0.6 }} />
      <span className="relative rounded-full" style={{ width: 7, height: 7, backgroundColor: "var(--accent-primary)" }} />
    </span>
  );
}

// Small hook to force a re-render each second for the live seconds clock stamp.
export function useTicker(intervalMs = 1000) {
  const [, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((x) => x + 1), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
}
