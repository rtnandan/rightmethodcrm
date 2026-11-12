import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { store } from "@/lib/store";
import { Wordmark } from "./LandingPage";

export function UnsubscribePage() {
  const { token } = useParams<{ token: string }>();
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (token) {
      store.handleUnsubscribeByToken(token);
      setDone(true);
    }
  }, [token]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 text-foreground">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-card text-center space-y-4">
        <div className="flex justify-center mb-2">
          <Wordmark />
        </div>

        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success">
          <CheckCircle2 className="h-6 w-6" />
        </div>

        <h1 className="text-2xl font-semibold">You have been unsubscribed</h1>

        <p className="text-sm text-muted-foreground leading-relaxed">
          Your email address has been added to our global suppression list. You will not receive any
          further communications or outreach emails from DECILE Media.
        </p>

        <div className="pt-4 border-t">
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-signal" />
            <span>Permanent suppression enforced across all sending accounts</span>
          </div>
        </div>

        <div className="pt-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/">Back to Home</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
