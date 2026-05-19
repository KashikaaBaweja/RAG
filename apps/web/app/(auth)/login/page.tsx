import { Suspense } from "react";
import { AuthShell } from "@/components/AuthShell";
import { LoginForm } from "./LoginForm";

function LoginFallback() {
  return (
    <AuthShell title="Welcome back" subtitle="Loading…">
      <div className="glass-card h-48 animate-pulse p-6" />
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}
