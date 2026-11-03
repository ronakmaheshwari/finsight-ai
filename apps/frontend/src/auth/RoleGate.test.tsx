import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AuthUserView } from "@repo/shared";

const state = vi.hoisted(() => ({ user: null as AuthUserView | null }));

vi.mock("@/auth/AuthProvider", () => ({
  useAuth: () => ({ user: state.user, status: state.user ? "authenticated" : "anonymous" }),
}));

import { RoleGate } from "./RoleGate";

const user = (role: AuthUserView["role"]): AuthUserView => ({
  id: "u1",
  name: "Test User",
  email: "test@example.com",
  role,
  orgId: "org1",
});

describe("RoleGate", () => {
  it("renders children for an allowed role", () => {
    state.user = user("ANALYST");
    render(
      <RoleGate allow={["ADMIN", "MANAGER", "ANALYST"]}>
        <button type="button">Generate</button>
      </RoleGate>,
    );

    expect(screen.getByRole("button", { name: "Generate" })).toBeInTheDocument();
  });

  it("hides children for a role outside the allow list", () => {
    state.user = user("VIEWER");
    render(
      <RoleGate allow={["ADMIN", "MANAGER"]}>
        <button type="button">Reset all rules</button>
      </RoleGate>,
    );

    expect(screen.queryByRole("button", { name: "Reset all rules" })).not.toBeInTheDocument();
  });

  it("renders the fallback instead of children when denied", () => {
    state.user = user("VIEWER");
    render(
      <RoleGate allow={["ADMIN"]} fallback={<p>Admins only</p>}>
        <button type="button">Invite</button>
      </RoleGate>,
    );

    expect(screen.getByText("Admins only")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Invite" })).not.toBeInTheDocument();
  });

  it("hides children when nobody is signed in", () => {
    state.user = null;
    render(
      <RoleGate allow={["ADMIN", "MANAGER", "ANALYST", "VIEWER"]}>
        <button type="button">Export</button>
      </RoleGate>,
    );

    expect(screen.queryByRole("button", { name: "Export" })).not.toBeInTheDocument();
  });
});
