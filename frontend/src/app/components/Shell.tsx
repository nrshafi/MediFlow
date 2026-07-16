import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { Check, LoaderCircle, Pause, Play, RotateCcw, StepForward } from "lucide-react";
import { useSim, formatSimClock } from "../store/SimContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { GeminiKeyDialog } from "./GeminiKeyDialog";

function ResetDemoDialog() {
  const { resetDemo } = useSim();
  const [open, setOpen] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    if (submitting) return;
    setOpen(nextOpen);
    if (!nextOpen) {
      setResetToken("");
      setResetError(null);
    }
  };

  const handleReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    if (!resetToken.trim()) {
      setResetError("Enter the demo reset key to continue.");
      return;
    }
    setSubmitting(true);
    setResetError(null);
    try {
      await resetDemo(resetToken);
      setOpen(false);
      setResetToken("");
    } catch (requestError) {
      setResetError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to reset the demo",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <button
              type="button"
              className="flex size-8 items-center justify-center rounded-md transition-colors"
              style={{
                border: "1px solid var(--border-default)",
                color: "var(--state-warning)",
                backgroundColor: "var(--bg-surface)",
              }}
              aria-label="Reset the shared demo"
            >
              <RotateCcw className="size-4" />
            </button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>Reset demo</TooltipContent>
      </Tooltip>
      <DialogContent
        className="border-[var(--border-default)] bg-[var(--bg-raised)] sm:max-w-md"
        onEscapeKeyDown={(event) => {
          if (submitting) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (submitting) event.preventDefault();
        }}
      >
        <form className="flex flex-col gap-5" onSubmit={handleReset}>
          <DialogHeader>
            <span
              className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--state-warning)]"
              aria-hidden="true"
            >
              Shared state control
            </span>
            <DialogTitle className="text-[var(--text-primary)]">
              Reset the simulated day?
            </DialogTitle>
            <DialogDescription className="leading-6 text-[var(--text-muted)]">
              Every connected viewer will return to minute zero. All generated
              demo events and cached summaries will be replaced with the
              canonical 30-patient fixture.
            </DialogDescription>
          </DialogHeader>

          <label className="flex flex-col gap-2" htmlFor="demo-reset-token">
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)]">
              Demo reset key
            </span>
            <input
              id="demo-reset-token"
              name="demo-reset-token"
              type="password"
              autoComplete="off"
              value={resetToken}
              onChange={(event) => {
                setResetToken(event.target.value);
                if (event.target.value.trim()) setResetError(null);
              }}
              disabled={submitting}
              className="h-10 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Enter the Worker secret…"
              aria-describedby={resetError ? "demo-reset-error" : undefined}
              aria-invalid={resetError ? true : undefined}
              autoFocus
            />
          </label>

          {resetError ? (
            <p
              id="demo-reset-error"
              role="alert"
              className="text-sm text-[var(--state-error)]"
            >
              {resetError}
            </p>
          ) : null}

          <DialogFooter>
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
              className="h-10 rounded-md border border-[var(--border-default)] px-4 text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-surface)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--state-warning)] bg-[color-mix(in_srgb,var(--state-warning)_12%,transparent)] px-4 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--state-warning)] transition-colors hover:bg-[color-mix(in_srgb,var(--state-warning)_18%,transparent)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <RotateCcw className="size-4" aria-hidden="true" />
              )}
              {submitting ? "Resetting" : "Reset shared demo"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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
            type="button"
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
  const location = useLocation();
  const {
    state,
    play,
    pause,
    stepNext,
    toggleSpeed,
  } = useSim();
  const simulationComplete =
    state.patients.length > 0 &&
    state.metrics.live.completed >= state.patients.length;
  const showReset = location.pathname.startsWith("/staff");
  const btn = "flex size-8 items-center justify-center rounded-md transition-colors hover:border-[var(--accent-primary)]";
  const btnStyle = { border: "1px solid var(--border-default)", color: "var(--text-primary)", backgroundColor: "var(--bg-surface)" };
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1.5">
        <GeminiKeyDialog />
        {simulationComplete ? (
          <span
            className="font-mono inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 uppercase"
            style={{
              border: "1px solid color-mix(in srgb, var(--state-success) 45%, var(--border-default))",
              color: "var(--state-success)",
              backgroundColor: "color-mix(in srgb, var(--state-success) 8%, transparent)",
              fontSize: "11px",
              letterSpacing: "0.08em",
            }}
            aria-live="polite"
          >
            <Check className="size-4" aria-hidden="true" />
            Day complete
          </span>
        ) : null}
        {!simulationComplete ? <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className={btn} style={btnStyle} onClick={() => (state.playing ? pause() : play())} aria-label={state.playing ? "Pause simulation" : "Play simulation"}>
              {state.playing ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
            </button>
          </TooltipTrigger>
          <TooltipContent>{state.playing ? "Pause" : "Play"}</TooltipContent>
        </Tooltip> : null}
        {!simulationComplete ? <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={btn}
              style={btnStyle}
              onClick={() => void stepNext()}
              aria-label="Go to next simulation minute"
            >
              <StepForward className="h-4 w-4" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Next minute</TooltipContent>
        </Tooltip> : null}
        {!simulationComplete ? <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="font-mono rounded-md h-8 px-2.5 uppercase transition-colors"
              style={{ ...btnStyle, fontSize: "11px", letterSpacing: "0.08em", color: "var(--accent-primary)" }}
              onClick={toggleSpeed}
              aria-label="Toggle simulation speed"
            >
              {state.speed}×
            </button>
          </TooltipTrigger>
          <TooltipContent>Speed 1× / 4× / 10×</TooltipContent>
        </Tooltip> : null}
        {showReset ? <ResetDemoDialog /> : null}
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
