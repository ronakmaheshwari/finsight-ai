import { ShieldCheck } from "lucide-react";

export const Splash = () => (
  <div className="flex min-h-svh items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-4">
      <span className="grid size-12 place-items-center rounded-xl bg-sidebar ring-1 ring-inset ring-white/10">
        <ShieldCheck className="size-6 animate-pulse text-white" aria-hidden />
      </span>
      <p className="text-sm text-muted-foreground" role="status">
        Loading FinSight…
      </p>
    </div>
  </div>
);
