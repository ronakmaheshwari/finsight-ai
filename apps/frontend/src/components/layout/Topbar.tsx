import { useEffect, useState } from "react";
import { LogOut, Menu, Moon, Sun } from "lucide-react";
import { useLocation } from "react-router-dom";

import { Button } from "@repo/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/tooltip";
import { useAuth } from "@/auth/AuthProvider";
import { ROLE_LABEL } from "@/lib/severity";
import { useTheme } from "@/lib/useTheme";

const SECTION_LABEL: Record<string, string> = {
  engagements: "Engagements",
  cases: "Cases",
  datasets: "Datasets",
  runs: "Analysis runs",
  rules: "Rules",
  users: "Users",
  audit: "Audit log",
  analytics: "Analytics",
  graph: "Graph explorer",
};

/** Two-level trail only; the page itself owns the h1. */
const crumbFor = (pathname: string): [string, string] => {
  const parts = pathname.split("/").filter(Boolean);
  const root = parts[0] ?? "";

  if (root === "engagements" && parts[2] === "datasets" && parts[3] === "new") {
    return ["Engagements", "Upload dataset"];
  }
  if (root === "engagements") {
    const child = SECTION_LABEL[parts[2] ?? ""] ?? "Dashboard";
    return ["Engagements", child];
  }
  if (root === "cases" && parts.length > 1) return ["Cases", "Case detail"];
  if (root === "datasets" && parts.length > 1) return ["Datasets", "Dataset detail"];
  if (root === "runs") {
    const child = parts[2] === "analytics" ? "Analytics" : parts[2] === "graph" ? "Graph explorer" : "Run detail";
    return ["Analysis runs", child];
  }
  if (root === "403") return ["Workspace", "Access denied"];
  if (SECTION_LABEL[root]) return ["Workspace", SECTION_LABEL[root]];
  return ["Workspace", "Not found"];
};

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

export const Topbar = ({ onMenu }: { onMenu: () => void }) => {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const { pathname } = useLocation();
  const [parent, current] = crumbFor(pathname);
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false,
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const isDark = theme === "dark" || (theme === "system" && systemDark);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 lg:px-8">
      <div className="flex min-w-0 items-center gap-2">
        <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Open navigation" onClick={onMenu}>
          <Menu className="size-5" aria-hidden />
        </Button>

        <nav aria-label="Breadcrumb" className="min-w-0">
          <ol className="flex items-center gap-1.5 text-sm">
            <li className="hidden text-muted-foreground sm:block">{parent}</li>
            <li className="hidden text-border sm:block" aria-hidden>
              /
            </li>
            <li className="truncate font-medium text-foreground">{current}</li>
          </ol>
        </nav>
      </div>

      <div className="flex items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Toggle colour theme" onClick={toggle}>
              {isDark ? <Moon className="size-4" aria-hidden /> : <Sun className="size-4" aria-hidden />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle theme</TooltipContent>
        </Tooltip>

        <span className="mx-1 h-6 w-px bg-border" aria-hidden />

        {user ? (
          <div className="flex items-center gap-2.5">
            <span
              className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/15"
              aria-hidden
            >
              {initials(user.name)}
            </span>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block text-sm font-medium text-foreground">{user.name}</span>
              <span className="block text-[0.6875rem] text-muted-foreground">{ROLE_LABEL[user.role]}</span>
            </span>
          </div>
        ) : null}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Sign out" onClick={() => void logout()}>
              <LogOut className="size-4" aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Sign out</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
};
