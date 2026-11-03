import { NavLink, useMatch } from "react-router-dom";
import {
  BarChart3,
  Database,
  FolderOpen,
  LayoutDashboard,
  ScrollText,
  ShieldAlert,
  SlidersHorizontal,
  Users,
} from "lucide-react";

import { cn } from "@repo/ui/lib/utils";
import { useAuth } from "@/auth/AuthProvider";
import { readLastEngagement } from "@/lib/download";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
    isActive
      ? "bg-sidebar-accent text-sidebar-accent-foreground"
      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
  );

export const Sidebar = ({ onNavigate }: { onNavigate?: () => void }) => {
  const { user } = useAuth();
  const engagementMatch = useMatch("/engagements/:eid/*");
  const engagementRootMatch = useMatch("/engagements/:eid");
  const eid = engagementMatch?.params.eid ?? engagementRootMatch?.params.eid;
  const lastEngagement = readLastEngagement();

  if (!user) return null;

  const role = user.role;
  const showDatasets = role !== "VIEWER";
  const showRules = role === "ADMIN" || role === "MANAGER";
  const showUsers = role === "ADMIN";
  const showAudit = role === "ADMIN" || role === "MANAGER";

  return (
    <nav className="flex h-full flex-col gap-6 overflow-y-auto border-r bg-sidebar px-3 py-4" aria-label="Main">
      <div className="px-2">
        <p className="text-sm font-semibold tracking-tight">FinSight AI</p>
        <p className="text-xs text-muted-foreground">Risk investigation</p>
      </div>

      <div className="space-y-1">
        <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Workspace
        </p>
        <NavLink to="/engagements" className={linkClass} onClick={onNavigate}>
          <FolderOpen className="size-4" aria-hidden />
          Engagements
        </NavLink>
        {eid ? (
          <>
            <NavLink to={`/engagements/${eid}`} end className={linkClass} onClick={onNavigate}>
              <LayoutDashboard className="size-4" aria-hidden />
              Dashboard
            </NavLink>
            {showDatasets ? (
              <NavLink to={`/engagements/${eid}/datasets`} className={linkClass} onClick={onNavigate}>
                <Database className="size-4" aria-hidden />
                Datasets
              </NavLink>
            ) : null}
            <NavLink to={`/engagements/${eid}/cases`} className={linkClass} onClick={onNavigate}>
              <ShieldAlert className="size-4" aria-hidden />
              Cases
            </NavLink>
          </>
        ) : lastEngagement ? (
          <NavLink to={`/engagements/${lastEngagement}`} className={linkClass} onClick={onNavigate}>
            <LayoutDashboard className="size-4" aria-hidden />
            Last engagement
          </NavLink>
        ) : null}
      </div>

      {showRules || showUsers || showAudit ? (
        <div className="space-y-1">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Administration
          </p>
          {showRules ? (
            <NavLink to="/rules" className={linkClass} onClick={onNavigate}>
              <SlidersHorizontal className="size-4" aria-hidden />
              Rules
            </NavLink>
          ) : null}
          {showUsers ? (
            <NavLink to="/users" className={linkClass} onClick={onNavigate}>
              <Users className="size-4" aria-hidden />
              Users
            </NavLink>
          ) : null}
          {showAudit ? (
            <NavLink to="/audit" className={linkClass} onClick={onNavigate}>
              <ScrollText className="size-4" aria-hidden />
              Audit log
            </NavLink>
          ) : null}
        </div>
      ) : null}

      {eid ? (
        <div className="space-y-1">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Analysis
          </p>
          <p className="px-3 text-xs text-muted-foreground">
            Open a run to reach its graph and analytics.
          </p>
        </div>
      ) : null}

      <div className="mt-auto flex items-center gap-2 px-3 text-xs text-muted-foreground">
        <BarChart3 className="size-4" aria-hidden />
        <span>Every result requires review.</span>
      </div>
    </nav>
  );
};
