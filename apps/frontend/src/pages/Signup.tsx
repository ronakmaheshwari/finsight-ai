import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { registerSchema } from "@repo/shared";
import { CheckCircle2, ShieldCheck, Sparkles, Waypoints } from "lucide-react";

import { Button } from "@repo/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/card";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { errorMessage } from "@/api/client";
import { useAuth } from "@/auth/AuthProvider";
import { Spinner } from "@/components/States";

const signupSchema = registerSchema
  .extend({ confirmPassword: z.string().min(1, "Confirm your password") })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

type SignupValues = z.infer<typeof signupSchema>;

const BENEFITS = [
  {
    icon: Waypoints,
    title: "One workspace per organisation",
    body: "Your data stays inside your own tenant. Every query is scoped to your organisation.",
  },
  {
    icon: Sparkles,
    title: "AI-assisted, never accusatory",
    body: "Investigations explain risk indicators and always require a human reviewer.",
  },
  {
    icon: CheckCircle2,
    title: "Audit trail from day one",
    body: "Every upload, run, decision and rule change is recorded against a named user.",
  },
];

export const Signup = () => {
  const { status, register: createAccount } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", organizationName: "", email: "", password: "", confirmPassword: "" },
  });

  if (status === "authenticated") return <Navigate to="/" replace />;

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await createAccount({
        name: values.name,
        organizationName: values.organizationName,
        email: values.email,
        password: values.password,
      });
      navigate("/engagements", { replace: true });
    } catch (error) {
      setFormError(errorMessage(error));
    }
  });

  const errors = form.formState.errors;

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-6" aria-hidden />
          <span className="text-lg font-semibold tracking-tight">FinSight AI</span>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Set up your risk workspace</h2>
            <p className="mt-2 max-w-sm text-sm text-primary-foreground/80">
              Upload procurement data, run a deterministic risk engine and work every case with evidence your reviewers
              can defend.
            </p>
          </div>

          <ul className="space-y-4">
            {BENEFITS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-3">
                <Icon className="mt-0.5 size-5 shrink-0 text-primary-foreground/80" aria-hidden />
                <div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-xs text-primary-foreground/70">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="max-w-sm text-xs text-primary-foreground/60">
          FinSight surfaces risk indicators that require review. It never determines that wrongdoing occurred.
        </p>
      </aside>

      <main className="flex items-center justify-center bg-muted/40 px-4 py-10">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="mb-2 flex items-center gap-2 lg:hidden">
              <ShieldCheck className="size-5 text-primary" aria-hidden />
              <span className="text-sm font-semibold tracking-tight">FinSight AI</span>
            </div>
            <CardTitle>Create your account</CardTitle>
            <CardDescription>
              The first account of a new organisation becomes its administrator. Teammates are invited from the Users
              page afterwards.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit} noValidate>
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  autoComplete="name"
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? "name-error" : undefined}
                  {...form.register("name")}
                />
                {errors.name ? (
                  <p id="name-error" role="alert" className="text-xs text-destructive">
                    {errors.name.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="organizationName">Organisation</Label>
                <Input
                  id="organizationName"
                  autoComplete="organization"
                  placeholder="Acme Audit LLP"
                  aria-invalid={Boolean(errors.organizationName)}
                  aria-describedby={errors.organizationName ? "organization-error" : undefined}
                  {...form.register("organizationName")}
                />
                {errors.organizationName ? (
                  <p id="organization-error" role="alert" className="text-xs text-destructive">
                    {errors.organizationName.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Work email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? "email-error" : undefined}
                  {...form.register("email")}
                />
                {errors.email ? (
                  <p id="email-error" role="alert" className="text-xs text-destructive">
                    {errors.email.message}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby="password-hint"
                    {...form.register("password")}
                  />
                  <p id="password-hint" className="text-[11px] text-muted-foreground">
                    At least 10 characters.
                  </p>
                  {errors.password ? (
                    <p role="alert" className="text-xs text-destructive">
                      {errors.password.message}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    aria-invalid={Boolean(errors.confirmPassword)}
                    aria-describedby={errors.confirmPassword ? "confirm-error" : undefined}
                    {...form.register("confirmPassword")}
                  />
                  {errors.confirmPassword ? (
                    <p id="confirm-error" role="alert" className="text-xs text-destructive">
                      {errors.confirmPassword.message}
                    </p>
                  ) : null}
                </div>
              </div>

              {formError ? (
                <p
                  role="alert"
                  className="rounded border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                >
                  {formError}
                </p>
              ) : null}

              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? <Spinner label="Creating account…" /> : "Create account"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};
