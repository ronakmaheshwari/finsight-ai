import { LogOut, Menu, ShieldCheck } from "lucide-react";

import { Button } from "@repo/ui/button";
import { useAuth } from "@/auth/AuthProvider";
import { ROLE_LABEL } from "@/lib/severity";

export const Topbar = ({ onMenu }: { onMenu: () => void }) => {
  const { user, logout } = useAuth();

  return (
    <header className="flex h-14 items-center justify-between gap-3 border-b bg-background px-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Open navigation"
          onClick={onMenu}
        >
          <Menu className="size-5" aria-hidden />
        </Button>
        <span className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="size-4 text-primary" aria-hidden />
          FinSight AI
        </span>
      </div>

      <div className="flex items-center gap-3">
        {user ? (
          <div className="text-right">
            <p className="text-sm font-medium leading-tight">{user.name}</p>
            <p className="text-xs text-muted-foreground">{ROLE_LABEL[user.role]}</p>
          </div>
        ) : null}
        <Button variant="outline" size="sm" onClick={() => void logout()}>
          <LogOut className="size-4" aria-hidden />
          Sign out
        </Button>
      </div>
    </header>
  );
};
