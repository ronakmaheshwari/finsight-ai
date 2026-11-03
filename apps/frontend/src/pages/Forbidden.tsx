import { Link } from "react-router-dom";
import { ShieldOff } from "lucide-react";

import { Button } from "@repo/ui/button";

export const Forbidden = () => (
  <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
    <ShieldOff className="size-10 text-muted-foreground" aria-hidden />
    <div>
      <h1 className="text-xl font-semibold">You do not have access to this page</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your role does not include this area. Ask an administrator if you need access.
      </p>
    </div>
    <div className="flex gap-2">
      <Button asChild>
        <Link to="/engagements">Back to engagements</Link>
      </Button>
      <Button asChild variant="outline">
        <Link to="/">Home</Link>
      </Button>
    </div>
  </div>
);
