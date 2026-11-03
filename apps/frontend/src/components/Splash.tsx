import { ShieldCheck } from "lucide-react";

export const Splash = () => (
  <div className="flex min-h-svh items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-3 text-muted-foreground">
      <ShieldCheck className="size-10 animate-pulse" aria-hidden />
      <p className="text-sm">Loading FinSight…</p>
    </div>
  </div>
);
