import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { loginSchema } from "@repo/shared";
import type { z } from "zod";

import { Button } from "@repo/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/card";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { errorMessage } from "@/api/client";
import { Spinner } from "@/components/States";

type LoginValues = z.infer<typeof loginSchema>;

const DEMO_ACCOUNTS = [
  { email: "admin@demo.com", role: "Administrator" },
  { email: "manager@demo.com", role: "Manager" },
  { email: "analyst@demo.com", role: "Analyst" },
  { email: "viewer@demo.com", role: "Viewer" },
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
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 px-4 py-10">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-6 text-primary" aria-hidden />
        <span className="text-lg font-semibold tracking-tight">FinSight AI</span>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Use your organisation account to continue.</CardDescription>
        </CardHeader>
        <CardContent>
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
              <p role="alert" className="rounded border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {formError}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Spinner label="Signing in…" /> : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            New to FinSight?{" "}
            <Link to="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
              Create an account
            </Link>
          </p>

          {showDemoLogins ? (
            <div className="mt-6 space-y-2 border-t pt-4">
              <p className="text-xs font-medium text-muted-foreground">Demo accounts (password Demo@1234)</p>
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
    </div>
  );
};
