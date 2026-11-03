import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUserView } from "@repo/shared";

const mocks = vi.hoisted(() => ({
  setAccessToken: vi.fn(),
  setRefreshHandler: vi.fn(),
  refresh: vi.fn(),
  me: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  setAccessToken: mocks.setAccessToken,
  setRefreshHandler: mocks.setRefreshHandler,
}));

vi.mock("@/api/auth", () => ({
  refresh: mocks.refresh,
  me: mocks.me,
  login: mocks.login,
  register: mocks.register,
  logout: mocks.logout,
}));

import { AuthProvider, useAuth } from "./AuthProvider";

const profile: AuthUserView = {
  id: "u1",
  name: "Priya Analyst",
  email: "analyst@finsight.test",
  role: "ANALYST",
  orgId: "org1",
};

const Probe = () => {
  const { user, status, login, register, logout } = useAuth();

  return (
    <div>
      <p data-testid="status">{status}</p>
      <p data-testid="user">{user ? `${user.name} (${user.role})` : "none"}</p>
      <button type="button" onClick={() => void login("analyst@finsight.test", "secret")}>
        Sign in
      </button>
      <button
        type="button"
        onClick={() =>
          void register({
            name: "Asha Admin",
            organizationName: "Acme Audit LLP",
            email: "asha@acme.test",
            password: "correct-horse-battery",
          })
        }
      >
        Create account
      </button>
      <button type="button" onClick={() => void logout()}>
        Sign out
      </button>
    </div>
  );
};

const renderProvider = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

beforeEach(() => {
  mocks.refresh.mockReset();
  mocks.me.mockReset();
  mocks.login.mockReset();
  mocks.register.mockReset();
  mocks.logout.mockReset();
});

describe("AuthProvider", () => {
  it("boots from the refresh cookie and then reads the canonical profile", async () => {
    mocks.refresh.mockResolvedValue({ accessToken: "access-1", user: profile });
    mocks.me.mockResolvedValue(profile);

    renderProvider();

    expect(screen.getByTestId("status")).toHaveTextContent("loading");
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(screen.getByTestId("user")).toHaveTextContent("Priya Analyst (ANALYST)");
    expect(mocks.setAccessToken).toHaveBeenCalledWith("access-1");
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(mocks.me).toHaveBeenCalledTimes(1);
  });

  it("falls back to anonymous when the boot refresh fails", async () => {
    mocks.refresh.mockRejectedValue(new Error("no cookie"));

    renderProvider();

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));
    expect(screen.getByTestId("user")).toHaveTextContent("none");
    expect(mocks.setAccessToken).toHaveBeenLastCalledWith(null);
    expect(mocks.me).not.toHaveBeenCalled();
  });

  it("registers the single-flight refresh handler before boot", () => {
    mocks.refresh.mockReturnValue(new Promise(() => {}));

    renderProvider();

    expect(mocks.setRefreshHandler).toHaveBeenCalledWith(expect.any(Function));
  });

  it("signs in with the session user and signs out again", async () => {
    mocks.refresh.mockRejectedValue(new Error("no cookie"));
    mocks.login.mockResolvedValue({ accessToken: "access-2", user: profile });
    mocks.logout.mockResolvedValue(undefined);

    renderProvider();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("Priya Analyst (ANALYST)"));
    expect(mocks.login).toHaveBeenCalledWith({ email: "analyst@finsight.test", password: "secret" });

    await user.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("none"));
    expect(mocks.logout).toHaveBeenCalledTimes(1);
  });

  it("registers an organisation and signs the new administrator in", async () => {
    mocks.refresh.mockRejectedValue(new Error("no cookie"));
    mocks.register.mockResolvedValue({ accessToken: "access-3", user: profile });

    renderProvider();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));

    await userEvent.setup().click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("Priya Analyst (ANALYST)"));
    expect(mocks.register).toHaveBeenCalledWith({
      name: "Asha Admin",
      organizationName: "Acme Audit LLP",
      email: "asha@acme.test",
      password: "correct-horse-battery",
    });
    expect(mocks.setAccessToken).toHaveBeenCalledWith("access-3");
  });

  it("clears the local session even when the logout call fails", async () => {
    mocks.refresh.mockResolvedValue({ accessToken: "access-1", user: profile });
    mocks.me.mockResolvedValue(profile);
    mocks.logout.mockRejectedValue(new Error("network"));

    renderProvider();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));

    await userEvent.setup().click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("none"));
  });
});
