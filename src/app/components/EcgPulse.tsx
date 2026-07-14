import { motion } from "motion/react";

// Thin animated cyan ECG heartbeat line running full width under the top bar.
export function EcgPulse() {
  // A repeating heartbeat polyline path.
  const beat =
    "M0 20 L60 20 L72 20 L80 6 L88 34 L96 20 L120 20 L180 20 L192 20 L200 6 L208 34 L216 20 L240 20";
  return (
    <div
      className="w-full overflow-hidden"
      style={{ height: "40px", backgroundColor: "var(--bg-base)", borderBottom: "1px solid var(--border-default)" }}
      aria-hidden="true"
    >
      <motion.svg
        width="480"
        height="40"
        viewBox="0 0 480 40"
        className="h-full"
        style={{ width: "200%" }}
        initial={{ x: 0 }}
        animate={{ x: "-50%" }}
        transition={{ repeat: Infinity, ease: "linear", duration: 3.5 }}
        preserveAspectRatio="none"
      >
        <path d={beat} fill="none" stroke="var(--accent-primary)" strokeWidth="1.5" opacity={0.85} />
        <path d={beat} fill="none" stroke="var(--accent-primary)" strokeWidth="1.5" opacity={0.85} transform="translate(240 0)" />
      </motion.svg>
    </div>
  );
}
