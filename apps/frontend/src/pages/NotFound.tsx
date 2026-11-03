import { Link, useLocation } from "react-router-dom";
import { FileQuestion } from "lucide-react";

import { Button } from "@repo/ui/button";

export const NotFound = () => {
  const location = useLocation();

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
      <FileQuestion className="size-10 text-muted-foreground" aria-hidden />
      <div>
        <h1 className="text-xl font-semibold">Page not found</h1>
        <p className="mt-1 break-all text-sm text-muted-foreground">
          Nothing lives at <span className="font-mono text-xs">{location.pathname}</span>.
        </p>
      </div>
      <Button asChild>
        <Link to="/engagements">Back to engagements</Link>
      </Button>
    </div>
  );
};
