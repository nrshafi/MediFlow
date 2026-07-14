import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { SimProvider } from "./store/SimContext";
import { TopBar } from "./components/Shell";
import { DataFooter } from "./components/primitives";

const StaffDashboard = lazy(async () => {
  const module = await import("./views/StaffDashboard");
  return { default: module.StaffDashboard };
});

const PatientGuidance = lazy(async () => {
  const module = await import("./views/PatientGuidance");
  return { default: module.PatientGuidance };
});

const DoctorBrief = lazy(async () => {
  const module = await import("./views/DoctorBrief");
  return { default: module.DoctorBrief };
});

function ViewFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-sm text-[var(--text-muted)]">
      Loading view...
    </div>
  );
}

export default function App() {
  return (
    <SimProvider>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--bg-base)" }}>
          <TopBar />
          <main className="flex-1">
            <Suspense fallback={<ViewFallback />}>
              <Routes>
                <Route path="/" element={<Navigate to="/staff" replace />} />
                <Route path="/staff" element={<StaffDashboard />} />
                <Route path="/doctor" element={<DoctorBrief />} />
                <Route path="/patient" element={<PatientGuidance />} />
                <Route path="*" element={<Navigate to="/staff" replace />} />
              </Routes>
            </Suspense>
          </main>
          <div style={{ borderTop: "1px solid var(--border-default)" }}>
            <DataFooter />
          </div>
        </div>
      </BrowserRouter>
    </SimProvider>
  );
}
