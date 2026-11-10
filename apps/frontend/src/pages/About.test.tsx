import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { About } from "./About";

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/about"]}>
      <About />
    </MemoryRouter>,
  );

describe("About", () => {
  it("introduces the developer with their Grant Thornton role", () => {
    renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Ronak Maheshwari" })).toBeInTheDocument();
    expect(screen.getAllByText("Consultant").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/FS-Risk/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Grant Thornton").length).toBeGreaterThan(0);
  });

  it("lists the roles newest first, from consultant back to summer intern", () => {
    renderPage();

    const roles = screen.getAllByRole("listitem").map((item) => item.textContent ?? "");
    expect(roles).toHaveLength(3);
    expect(roles[0]).toContain("Consultant");
    expect(roles[0]).toContain("Jul 2026 – Present");
    expect(roles[0]).toContain("Current");
    expect(roles[0]).not.toContain("Internship");
    expect(roles[1]).toContain("Associate");
    expect(roles[1]).toContain("Apr 2026 – Jul 2026");
    expect(roles[2]).toContain("Summer Intern");
    expect(roles[2]).toContain("Oct 2025 – Apr 2026");
  });

  it("shows the developer's photo", () => {
    renderPage();

    expect(screen.getByAltText("Ronak Maheshwari")).toHaveAttribute("src", "/RM.jpeg");
  });

  it("links to LinkedIn and the portfolio", () => {
    renderPage();

    expect(screen.getByRole("link", { name: "LinkedIn" })).toHaveAttribute(
      "href",
      "https://www.linkedin.com/in/rbm77/",
    );
    expect(screen.getByRole("link", { name: /portfolio/i })).toHaveAttribute(
      "href",
      "https://ronakmaheshwari.tech/",
    );
  });

  it("offers a way back to the sign-in page", () => {
    renderPage();

    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login");
  });
});
