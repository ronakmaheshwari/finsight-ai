import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { Role } from "@repo/shared";

import { ProtectedRoute } from "@/auth/ProtectedRoute";
import { useAuth } from "@/auth/AuthProvider";
import { AppShell } from "@/components/layout/AppShell";
import { Splash } from "@/components/Splash";
import { readLastEngagement } from "@/lib/download";
import { Analytics } from "@/pages/Analytics";
import { AuditLog } from "@/pages/AuditLog";
import { CaseDetail } from "@/pages/CaseDetail";
import { CaseQueue } from "@/pages/CaseQueue";
import { DatasetDetail } from "@/pages/DatasetDetail";
import { DatasetList } from "@/pages/DatasetList";
import { EngagementDashboard } from "@/pages/EngagementDashboard";
import { Engagements } from "@/pages/Engagements";
import { Forbidden } from "@/pages/Forbidden";
import { GraphExplorer } from "@/pages/GraphExplorer";
import { Login } from "@/pages/Login";
import { NotFound } from "@/pages/NotFound";
import { Rules } from "@/pages/Rules";
import { Signup } from "@/pages/Signup";
import { RunDetail } from "@/pages/RunDetail";
import { UploadWizard } from "@/pages/UploadWizard";
import { Users } from "@/pages/Users";

/** Client-side guard; the API still enforces every permission. */
const RequireRole = ({ allow, children }: { allow: readonly Role[]; children: ReactNode }) => {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === "loading") return <Splash />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (!allow.includes(user.role)) return <Navigate to="/403" replace />;
  return <>{children}</>;
};

const Home = () => {
  const last = readLastEngagement();
  return <Navigate to={last ? `/engagements/${last}` : "/engagements"} replace />;
};

const ANALYST_ROLES: Role[] = ["ADMIN", "MANAGER", "ANALYST"];

export const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/signup" element={<Signup />} />

    <Route element={<ProtectedRoute />}>
      <Route element={<AppShell />}>
        <Route index element={<Home />} />
        <Route path="engagements" element={<Engagements />} />
        <Route path="engagements/:eid" element={<EngagementDashboard />} />
        <Route path="engagements/:eid/cases" element={<CaseQueue />} />
        <Route path="cases/:id" element={<CaseDetail />} />
        <Route
          path="engagements/:eid/datasets"
          element={
            <RequireRole allow={ANALYST_ROLES}>
              <DatasetList />
            </RequireRole>
          }
        />
        <Route
          path="engagements/:eid/datasets/new"
          element={
            <RequireRole allow={ANALYST_ROLES}>
              <UploadWizard />
            </RequireRole>
          }
        />
        <Route
          path="datasets/:id"
          element={
            <RequireRole allow={ANALYST_ROLES}>
              <DatasetDetail />
            </RequireRole>
          }
        />
        <Route
          path="runs/:id"
          element={
            <RequireRole allow={ANALYST_ROLES}>
              <RunDetail />
            </RequireRole>
          }
        />
        <Route
          path="runs/:id/analytics"
          element={
            <RequireRole allow={ANALYST_ROLES}>
              <Analytics />
            </RequireRole>
          }
        />
        <Route
          path="runs/:id/graph"
          element={
            <RequireRole allow={ANALYST_ROLES}>
              <GraphExplorer />
            </RequireRole>
          }
        />

        <Route
          path="rules"
          element={
            <RequireRole allow={["ADMIN", "MANAGER"]}>
              <Rules />
            </RequireRole>
          }
        />
        <Route
          path="users"
          element={
            <RequireRole allow={["ADMIN"]}>
              <Users />
            </RequireRole>
          }
        />
        <Route
          path="audit"
          element={
            <RequireRole allow={["ADMIN", "MANAGER"]}>
              <AuditLog />
            </RequireRole>
          }
        />

        <Route path="403" element={<Forbidden />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Route>
  </Routes>
);
