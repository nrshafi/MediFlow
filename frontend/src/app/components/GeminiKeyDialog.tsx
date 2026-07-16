import { useState } from "react";
import { Check, KeyRound, LoaderCircle, Trash2 } from "lucide-react";
import { MAX_GEMINI_API_KEY_LENGTH } from "@mediflow/shared";
import { useSim } from "../store/SimContext";
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
  TooltipTrigger,
} from "./ui/tooltip";

export function GeminiKeyDialog() {
  const {
    clearGeminiFallbackKey,
    hasGeminiFallbackKey,
    verifyGeminiFallbackKey,
  } = useSim();
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    if (submitting) return;
    setOpen(nextOpen);
    if (!nextOpen) {
      setApiKey("");
      setValidationError(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const normalizedKey = apiKey.trim();
    if (!normalizedKey) {
      setValidationError("Paste a Gemini API key to continue.");
      return;
    }
    setSubmitting(true);
    setValidationError(null);
    try {
      await verifyGeminiFallbackKey(normalizedKey);
      setOpen(false);
      setApiKey("");
    } catch (requestError) {
      setValidationError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to verify the Gemini API key",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleClear = () => {
    clearGeminiFallbackKey();
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <button
              type="button"
              className="relative flex size-8 items-center justify-center rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] transition-colors hover:border-[var(--accent-primary)]"
              style={{
                color: hasGeminiFallbackKey
                  ? "var(--state-success)"
                  : "var(--text-muted)",
              }}
              aria-label={
                hasGeminiFallbackKey
                  ? "Manage session Gemini API key"
                  : "Add session Gemini API key"
              }
            >
              <KeyRound className="size-4" aria-hidden="true" />
              {hasGeminiFallbackKey ? (
                <span
                  className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-[var(--state-success)]"
                  aria-hidden="true"
                />
              ) : null}
            </button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>
          {hasGeminiFallbackKey
            ? "Session Gemini key verified"
            : "Add Gemini key"}
        </TooltipContent>
      </Tooltip>

      <DialogContent className="border-[var(--border-default)] bg-[var(--bg-raised)] sm:max-w-md">
        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <DialogHeader>
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--accent-primary)]">
              Language fallback
            </span>
            <DialogTitle className="text-[var(--text-primary)]">
              Gemini API key
            </DialogTitle>
            <DialogDescription className="leading-6 text-[var(--text-muted)]">
              MediFlow verifies the key with Gemini first. After verification,
              it is used only when the Worker has no configured Gemini key,
              stays in this tab&apos;s memory, and clears when the page reloads.
            </DialogDescription>
          </DialogHeader>

          {hasGeminiFallbackKey ? (
            <div className="flex items-center gap-3 rounded-md border border-[color-mix(in_srgb,var(--state-success)_45%,var(--border-default))] bg-[color-mix(in_srgb,var(--state-success)_7%,transparent)] px-3 py-2.5">
              <Check
                className="size-4 shrink-0 text-[var(--state-success)]"
                aria-hidden="true"
              />
              <span className="text-sm text-[var(--text-primary)]">
                A verified session fallback key is ready.
              </span>
            </div>
          ) : null}

          <label className="flex flex-col gap-2" htmlFor="gemini-api-key">
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)]">
              {hasGeminiFallbackKey ? "Replace session key" : "API key"}
            </span>
            <input
              id="gemini-api-key"
              name="gemini-api-key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              maxLength={MAX_GEMINI_API_KEY_LENGTH}
              value={apiKey}
              onChange={(event) => {
                setApiKey(event.target.value);
                if (event.target.value.trim()) setValidationError(null);
              }}
              className="h-10 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 font-mono text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)]"
              placeholder="Paste a Gemini API key…"
              aria-describedby={validationError ? "gemini-api-key-error" : undefined}
              aria-invalid={validationError ? true : undefined}
              disabled={submitting}
              autoFocus
            />
          </label>

          {validationError ? (
            <p
              id="gemini-api-key-error"
              role="alert"
              className="text-sm text-[var(--state-error)]"
            >
              {validationError}
            </p>
          ) : null}

          <div className="rounded-md border border-dashed border-[var(--state-warning)] px-3 py-2.5 text-xs leading-5 text-[var(--text-muted)]">
            The key never changes scheduling decisions and is not saved to
            Turso, local storage, or session storage.
          </div>

          <DialogFooter className="sm:justify-between">
            {hasGeminiFallbackKey ? (
              <button
                type="button"
                onClick={handleClear}
                disabled={submitting}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--border-default)] px-4 text-sm text-[var(--state-error)] transition-colors hover:bg-[var(--bg-surface)]"
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Clear key
              </button>
            ) : (
              <span />
            )}
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--accent-primary)] px-4 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--bg-base)] transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <KeyRound className="size-4" aria-hidden="true" />
              )}
              {submitting
                ? "Verifying"
                : hasGeminiFallbackKey
                  ? "Replace key"
                  : "Verify key"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
