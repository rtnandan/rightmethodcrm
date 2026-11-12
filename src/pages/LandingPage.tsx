import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { store } from "@/lib/store";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display text-xl font-semibold tracking-tight ${className}`}>
      DECILE<span className="text-signal">.</span>
    </span>
  );
}

export function LandingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    if (store.getCurrentUser()) {
      navigate("/dashboard");
    }
  }, [navigate]);

  return (
    <main className="flex min-h-screen flex-col bg-ink text-ink-foreground">
      <header className="flex items-center justify-between px-6 py-5 md:px-12">
        <Wordmark />
        <Button asChild variant="signal" size="sm" onClick={() => navigate("/auth")}>
          <span>Sign in</span>
        </Button>
      </header>

      <section className="flex flex-1 flex-col justify-center px-6 pb-24 md:px-12">
        <div className="eyebrow mb-6 text-ink-foreground/60">DECILE Media · Outreach desk</div>
        <h1 className="max-w-4xl text-5xl font-semibold leading-[1.02] md:text-7xl">
          Every lead, one <em className="text-signal not-italic">personal</em> email at a time.
        </h1>
        <p className="mt-6 max-w-xl text-base text-ink-foreground/70 leading-relaxed">
          Upload your list, write once with personal details filled in, approve, and let the sender work through it
          in safe daily batches — without ever emailing someone twice or anyone who opted out.
        </p>
        <div className="mt-10 flex flex-wrap gap-4 items-center">
          <Button variant="signal" size="lg" onClick={() => navigate("/auth")} className="text-base font-medium px-8 py-6">
            Open the desk
          </Button>
          <div className="text-xs text-ink-foreground/50 font-mono">
            Direct access for: nandan.involynk@gmail.com
          </div>
        </div>
      </section>

      <footer className="border-t border-sidebar-border/40 px-6 py-4 text-xs text-ink-foreground/40 flex justify-between items-center">
        <span>DECILE Media Desk &copy; {new Date().getFullYear()}</span>
        <span>Safe delivery &bull; Gmail integration &bull; Anti-promotions inboxing</span>
      </footer>
    </main>
  );
}
