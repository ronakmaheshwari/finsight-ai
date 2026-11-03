import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/client";

const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  status: "anonymous" as "anonymous" | "authenticated" | "loading",
}));

vi.mock("@/auth/AuthProvider", () => ({
  useAuth: () => ({ status: mocks.status, register: mocks.register, user: null, login: vi.fn(), logout: vi.fn() }),
}));

import { Signup } from "./Signup";

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/signup"]}>
      <Signup />
    </MemoryRouter>,
  );

const fill = async (overrides: Partial<Record<"name" | "organizationName" | "email" | "password" | "confirmPassword", string>> = {}) => {
  const user = userEvent.setup();
  const values = {
    name: "Asha Admin",
    organizationName: "Acme Audit LLP",
    email: "asha@acme.test",
    password: "correct-horse-battery",
    confirmPassword: "correct-horse-battery",
    ...overrides,
  };

  await user.type(screen.getByLabelText("Full name"), values.name);
  await user.type(screen.getByLabelText("Organisation"), values.organizationName);
  await user.type(screen.getByLabelText("Work email"), values.email);
  await user.type(screen.getByLabelText("Password"), values.password);
  await user.type(screen.getByLabelText("Confirm password"), values.confirmPassword);
  return user;
};

beforeEach(() => {
  mocks.register.mockReset();
  mocks.status = "anonymous";
});

describe("Signup", () => {
  it("validates the form before calling the API", async () => {
    renderPage();

    await userEvent.setup().click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText("Enter your full name")).toBeInTheDocument();
    expect(screen.getByText("Enter your organisation name")).toBeInTheDocument();
    expect(mocks.register).not.toHaveBeenCalled();
  });

  it("refuses mismatched passwords", async () => {
    renderPage();
    const user = await fill({ confirmPassword: "different-password" });

    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(mocks.register).not.toHaveBeenCalled();
  });

  it("creates the organisation and administrator account", async () => {
    mocks.register.mockResolvedValue(undefined);
    renderPage();
    const user = await fill();

    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() =>
      expect(mocks.register).toHaveBeenCalledWith({
        name: "Asha Admin",
        organizationName: "Acme Audit LLP",
        email: "asha@acme.test",
        password: "correct-horse-battery",
      }),
    );
  });

  it("shows the server message when the email is already registered", async () => {
    mocks.register.mockRejectedValue(
      new ApiError(409, "EMAIL_ALREADY_EXISTS", "An account with this email already exists. Sign in instead."),
    );
    renderPage();
    const user = await fill();

    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("An account with this email already exists");
  });

  it("links to the sign-in page", () => {
    renderPage();

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  });
});
