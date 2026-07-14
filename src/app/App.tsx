import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { SimProvider } from "./store/SimContext";
import { TopBar } from "./components/Shell";
import { DataFooter } from "./components/primitives";
import { StaffDashboard } from "./views/StaffDashboard";
import { PatientGuidance } from "./views/PatientGuidance";
import { DoctorBrief } from "./views/DoctorBrief";

export default function App() {
  return (
    <SimProvider>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--bg-base)" }}>
          <TopBar />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Navigate to="/staff" replace />} />
              <Route path="/staff" element={<StaffDashboard />} />
              <Route path="/doctor" element={<DoctorBrief />} />
              <Route path="/patient" element={<PatientGuidance />} />
              <Route path="*" element={<Navigate to="/staff" replace />} />
            </Routes>
          </main>
          <div style={{ borderTop: "1px solid var(--border-default)" }}>
            <DataFooter />
          </div>
        </div>
      </BrowserRouter>
    </SimProvider>
  );
}
