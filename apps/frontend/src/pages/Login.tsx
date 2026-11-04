import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { loginSchema } from "@repo/shared";
import type { z } from "zod";
import { Fingerprint, ScanSearch, ShieldCheck } from "lucide-react";

import { Button } from "@repo/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/card";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { useAuth } from "@/auth/AuthProvider";
import { errorMessage } from "@/api/client";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Spinner } from "@/components/States";

type LoginValues = z.infer<typeof loginSchema>;

const DEMO_ACCOUNTS = [
  { email: "admin@demo.com", role: "Administrator" },
  { email: "manager@demo.com", role: "Manager" },
  { email: "analyst@demo.com", role: "Analyst" },
  { email: "viewer@demo.com", role: "Viewer" },
];

const POINTS = [
  {
    icon: ScanSearch,
    title: "Signals, not verdicts",
    body: "The engine ranks what looks unusual and shows the evidence behind every score.",
  },
  {
    icon: Fingerprint,
    title: "Every action attributed",
    body: "Uploads, runs, rule changes and case decisions are recorded against a named user.",
  },
  {
    icon: ShieldCheck,
    title: "Scoped to your organisation",
    body: "Data never crosses tenant boundaries, and reviewers only see their engagements.",
  },
];

// `DEV` is a built-in Vite flag, not an application env var.
// eslint-disable-next-line turbo/no-undeclared-env-vars
const showDemoLogins = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO_LOGINS === "true";

export const Login = () => {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const rawNext = params.get("next") ?? "/";
  // Only same-origin absolute paths: never bounce to an external URL.
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  if (status === "authenticated") return <Navigate to={next} replace />;

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await login(values.email, values.password);
      navigate(next, { replace: true });
    } catch (error) {
      setFormError(
        error instanceof Error && "status" in error && (error as { status?: number }).status === 401
          ? "Invalid email or password"
          : errorMessage(error),
      );
    }
  });

  return (
    <AuthLayout
      headline="Work every flagged invoice with evidence you can defend."
      lede="Upload procurement data, run the deterministic risk engine, and resolve cases with the full signal trail attached."
      points={POINTS}
      footnote="FinSight surfaces risk indicators that require review. It never determines that wrongdoing occurred."
    >
      <Card className="gap-0 rounded-xl border-border py-0 shadow-raised">
        <CardHeader className="gap-1.5 border-b border-border px-6 py-5">
          <p className="eyebrow">Welcome back</p>
          <CardTitle className="text-xl tracking-tight">Sign in</CardTitle>
          <CardDescription>Use your organisation account to continue.</CardDescription>
        </CardHeader>
        <CardContent className="px-6 py-5">
          <form className="space-y-4" onSubmit={onSubmit} noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                aria-invalid={Boolean(form.formState.errors.email)}
                aria-describedby={form.formState.errors.email ? "email-error" : undefined}
                {...form.register("email")}
              />
              {form.formState.errors.email ? (
                <p id="email-error" role="alert" className="text-xs text-destructive">
                  {form.formState.errors.email.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={Boolean(form.formState.errors.password)}
                aria-describedby={form.formState.errors.password ? "password-error" : undefined}
                {...form.register("password")}
              />
              {form.formState.errors.password ? (
                <p id="password-error" role="alert" className="text-xs text-destructive">
                  {form.formState.errors.password.message}
                </p>
              ) : null}
            </div>

            {formError ? (
              <p
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                {formError}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Spinner label="Signing in…" /> : "Sign in"}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            New to FinSight?{" "}
            <Link to="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
              Create an account
            </Link>
          </p>

          {showDemoLogins ? (
            <div className="mt-5 space-y-2 border-t border-border pt-4">
              <p className="text-[0.6875rem] font-medium text-muted-foreground">
                Demo accounts · password <span className="data-num text-foreground">Demo@1234</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                {DEMO_ACCOUNTS.map((account) => (
                  <Button
                    key={account.email}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      form.setValue("email", account.email);
                      form.setValue("password", "Demo@1234");
                    }}
                  >
                    {account.role}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </AuthLayout>
  );
};
