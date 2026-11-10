import { NavLink, useMatch } from "react-router-dom";
import {
  BarChart3,
  Database,
  FolderOpen,
  Info,
  LayoutDashboard,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";

import { cn } from "@repo/ui/lib/utils";
import { useAuth } from "@/auth/AuthProvider";
import { readLastEngagement } from "@/lib/download";

/**
 * Navigation rail. The active item is the only one that lifts off the navy, and
 * `end` is set on the engagement root so "Engagements" and "Dashboard" never
 * both look selected.
 */
const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
    isActive
      ? "bg-sidebar-accent text-sidebar-accent-foreground"
      : "text-[var(--rail-muted)] hover:bg-white/5 hover:text-sidebar-foreground",
  );

const Section = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1">
    <p className="px-3 pb-1 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--rail-label)]">
      {label}
    </p>
    {children}
  </div>
);

export const Sidebar = ({ onNavigate }: { onNavigate?: () => void }) => {
  const { user } = useAuth();
  const engagementMatch = useMatch("/engagements/:eid/*");
  const engagementRootMatch = useMatch("/engagements/:eid");
  const lastEngagement = readLastEngagement();
  // Dataset, case and run pages sit outside /engagements, so fall back to the
  // last engagement the user opened: the workspace links stay put everywhere.
  const eid = engagementMatch?.params.eid ?? engagementRootMatch?.params.eid ?? lastEngagement ?? undefined;

  if (!user) return null;

  const role = user.role;
  const showDatasets = role !== "VIEWER";
  const showRules = role === "ADMIN" || role === "MANAGER";
  const showUsers = role === "ADMIN";
  const showAudit = role === "ADMIN" || role === "MANAGER";

  return (
    <nav
      className="flex h-full flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar px-3 py-4"
      aria-label="Main"
    >
      <div className="mb-6 flex items-center gap-2.5 px-1">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/10 ring-1 ring-inset ring-white/15">
          <ShieldCheck className="size-5 text-white" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold tracking-tight text-white">FinSight AI</span>
          <span className="block truncate text-[0.6875rem] text-[var(--rail-muted)]">Risk investigation</span>
        </span>
      </div>

      <div className="space-y-5">
        <Section label="Workspace">
          <NavLink to="/engagements" end className={linkClass} onClick={onNavigate}>
            <FolderOpen className="size-4 shrink-0" aria-hidden />
            Engagements
          </NavLink>
          {eid ? (
            <>
              <NavLink to={`/engagements/${eid}`} end className={linkClass} onClick={onNavigate}>
                <LayoutDashboard className="size-4 shrink-0" aria-hidden />
                Dashboard
              </NavLink>
              {showDatasets ? (
                <NavLink to={`/engagements/${eid}/datasets`} className={linkClass} onClick={onNavigate}>
                  <Database className="size-4 shrink-0" aria-hidden />
                  Datasets
                </NavLink>
              ) : null}
              <NavLink to={`/engagements/${eid}/cases`} className={linkClass} onClick={onNavigate}>
                <ShieldAlert className="size-4 shrink-0" aria-hidden />
                Cases
              </NavLink>
            </>
          ) : null}
        </Section>

        {showRules || showUsers || showAudit ? (
          <Section label="Administration">
            {showRules ? (
              <NavLink to="/rules" className={linkClass} onClick={onNavigate}>
                <SlidersHorizontal className="size-4 shrink-0" aria-hidden />
                Rules
              </NavLink>
            ) : null}
            {showUsers ? (
              <NavLink to="/users" className={linkClass} onClick={onNavigate}>
                <Users className="size-4 shrink-0" aria-hidden />
                Users
              </NavLink>
            ) : null}
            {showAudit ? (
              <NavLink to="/audit" className={linkClass} onClick={onNavigate}>
                <ScrollText className="size-4 shrink-0" aria-hidden />
                Audit log
              </NavLink>
            ) : null}
          </Section>
        ) : null}

      </div>

      <div className="mt-auto space-y-2">
        <div className="flex items-start gap-2 rounded-md bg-white/5 px-3 py-2.5 text-[0.6875rem] leading-snug text-[var(--rail-muted)]">
          <BarChart3 className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>Every result requires human review.</span>
        </div>
        <NavLink
          to="/about"
          onClick={onNavigate}
          className="flex items-center gap-2 rounded-md px-3 py-2 text-[0.6875rem] font-medium text-[var(--rail-muted)] transition-colors hover:bg-white/5 hover:text-sidebar-foreground"
        >
          <Info className="size-3.5 shrink-0" aria-hidden />
          About the developer
        </NavLink>
      </div>
    </nav>
  );
};
