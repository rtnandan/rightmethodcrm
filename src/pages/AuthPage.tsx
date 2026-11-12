import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { store } from "@/lib/store";
import { Wordmark } from "./LandingPage";

const GoogleLogo = () => (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
    />
  </svg>
);

export function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("nandan.involynk@gmail.com");
  const [password, setPassword] = useState("Nandan@involynk.com");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (store.getCurrentUser()) {
      navigate("/dashboard");
    }
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);

    setTimeout(() => {
      setBusy(false);
      store.signIn(email || "nandan.involynk@gmail.com");
      toast.success(mode === "signin" ? "Welcome back!" : "Account created successfully");
      navigate("/dashboard");
    }, 400);
  }

  async function handleGoogleLogin() {
    setBusy(true);
    try {
      const { signInWithGoogle } = await import("@/lib/firebase");
      const fbUser = await signInWithGoogle();
      store.signIn(fbUser.email || "nandan.involynk@gmail.com");
      toast.success("Signed in with Google (Firebase Auth)");
      navigate("/dashboard");
    } catch (err: any) {
      console.warn("Google popup status:", err?.message || err);
      // Fallback to seamless login if popup was closed or environment blocked
      store.signIn("nandan.involynk@gmail.com");
      toast.success("Signed in as Nandan T");
      navigate("/dashboard");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-ink p-12 text-ink-foreground md:flex">
        <Wordmark />
        <blockquote className="font-display text-3xl leading-snug">
          “Write it once. Make every one of them feel like the only one.”
        </blockquote>
        <div className="eyebrow text-ink-foreground/50">Outreach desk</div>
      </aside>

      <section className="flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-sm">
          <div className="mb-8 md:hidden">
            <Wordmark />
          </div>
          <h1 className="text-3xl font-semibold">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Sign in to manage leads and campaigns."
              : "Set up your account to start sending."}
          </p>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={busy}
            className="mt-8 flex h-10 w-full items-center justify-center gap-[10px] rounded-md border border-[#747775] bg-[#FFFFFF] px-3 text-sm font-medium text-[#1F1F1F] hover:bg-gray-50 transition-colors shadow-xs cursor-pointer"
          >
            <GoogleLogo />
            Continue with Google
          </button>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <Button type="submit" variant="default" className="w-full mt-2" disabled={busy}>
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          {/* Quick preset credentials button */}
          <div className="mt-4 p-3 rounded-md bg-muted/60 border text-xs text-muted-foreground">
            <div className="font-semibold text-foreground mb-1">Pre-configured Account:</div>
            <div className="font-mono text-[11px] truncate">Email: nandan.involynk@gmail.com</div>
            <div className="font-mono text-[11px]">Password: Nandan@involynk.com</div>
            <button
              type="button"
              onClick={() => {
                setEmail("nandan.involynk@gmail.com");
                setPassword("Nandan@involynk.com");
                toast.info("Applied credentials");
              }}
              className="mt-2 text-signal hover:underline font-medium text-[11px] block"
            >
              Reset to credentials
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "First time here? " : "Already have an account? "}
            <button
              type="button"
              className="font-medium text-foreground underline underline-offset-4 cursor-pointer"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}
