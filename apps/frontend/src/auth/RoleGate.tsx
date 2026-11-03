import type { ReactNode } from "react";
import type { Role } from "@repo/shared";

import { useAuth } from "./AuthProvider";

/**
 * Hides actions the role cannot use. The server is still the authority and
 * answers 403 (§11.4).
 */
export const RoleGate = ({
  allow,
  children,
  fallback = null,
}: {
  allow: readonly Role[];
  children: ReactNode;
  fallback?: ReactNode;
}) => {
  const { user } = useAuth();
  if (!user || !allow.includes(user.role)) return <>{fallback}</>;
  return <>{children}</>;
};
