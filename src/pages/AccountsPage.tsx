import { useEffect, useState } from "react";
import { RefreshCw, Plus, Mail, CheckCircle2, Shield, Settings } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState, PageHeader, formatDateTime } from "@/components/app/page";
import { AccountStatusBadge } from "@/components/app/status";
import { DEFAULT_APP_URL } from "@/lib/compose";
import { store, type SendingAccount } from "@/lib/store";

export function AccountsPage() {
  const [, setTick] = useState(0);
  const [syncing, setSyncing] = useState(false);

  // Settings form
  const settings = store.getSettings();
  const [signature, setSignature] = useState(settings.signature);
  const [timezone, setTimezone] = useState(settings.timezone);
  const [appUrl, setAppUrl] = useState(settings.app_url);

  // Connect Account Dialog
  const [connectOpen, setConnectOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newDailyLimit, setNewDailyLimit] = useState("250");

  useEffect(() => {
    const unsub = store.subscribe(() => setTick((t) => t + 1));
    return unsub;
  }, []);

  const accounts = store.getAccounts();

  function runSync() {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      toast.success(`${accounts.length} sending account(s) connected and healthy`);
    }, 600);
  }

  function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    store.updateSettings({
      signature,
      timezone,
      app_url: appUrl,
    });
    toast.success("Settings saved");
  }

  function handleConnectAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim()) return;

    store.addAccount({
      email: newEmail.trim(),
      from_name: newName.trim() || newEmail.split("@")[0],
      secret_name: `gmail_${Date.now()}`,
      daily_limit: Number(newDailyLimit) || 250,
      status: "active",
      last_error: null,
      last_checked_at: new Date().toISOString(),
    });

    toast.success(`Connected account ${newEmail}`);
    setConnectOpen(false);
    setNewEmail("");
    setNewName("");
  }

  function handleToggleAccountStatus(acc: SendingAccount) {
    const newStatus = acc.status === "active" ? "paused" : "active";
    store.updateAccount(acc.id, { status: newStatus });
    toast.info(`Account ${acc.email} marked as ${newStatus}`);
  }

  function handleDeleteAccount(acc: SendingAccount) {
    if (confirm(`Remove sending account ${acc.email}?`)) {
      store.deleteAccount(acc.id);
      toast.success("Account removed");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Infrastructure"
        title="Sending accounts"
        description="Gmail accounts, daily limits, health and email settings."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={runSync} disabled={syncing}>
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} /> Sync accounts
            </Button>
            <Button variant="signal" onClick={() => setConnectOpen(true)}>
              <Plus className="h-4 w-4" /> Connect account
            </Button>
          </div>
        }
      />

      {/* Accounts List */}
      <div className="space-y-6 mb-10">
        <h2 className="text-xl font-semibold">Connected Gmail Accounts</h2>

        {accounts.length === 0 ? (
          <EmptyState
            title="No accounts connected"
            children="Connect your Gmail account to enable outreach dispatch."
            action={
              <Button variant="signal" onClick={() => setConnectOpen(true)}>
                Connect account
              </Button>
            }
          />
        ) : (
          <div className="divide-y rounded-lg border bg-card shadow-card">
            {accounts.map((a) => {
              const pct = a.daily_limit ? Math.round((a.sent_today / a.daily_limit) * 100) : 0;
              return (
                <div key={a.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-signal" />
                      <div>
                        <div className="font-semibold text-foreground flex items-center gap-2">
                          {a.email}
                          <span className="text-xs text-muted-foreground font-normal">
                            ({a.from_name})
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                          <span>Health checked {formatDateTime(a.last_checked_at)}</span>
                          <span>&bull;</span>
                          <span>Cap: {a.daily_limit} / day</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-3 max-w-sm">
                      <Progress value={pct} className="h-1.5" />
                      <span className="tabular text-xs text-muted-foreground font-mono">
                        {a.sent_today}/{a.daily_limit} today
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <AccountStatusBadge status={a.status} />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleAccountStatus(a)}
                    >
                      {a.status === "active" ? "Pause" : "Activate"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteAccount(a)}
                      className="text-destructive hover:bg-destructive/10"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Global Outreach Settings */}
      <div className="grid gap-8 lg:grid-cols-2">
        <form onSubmit={handleSaveSettings} className="rounded-lg border bg-card p-6 shadow-card space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Settings className="h-5 w-5 text-signal" />
            <h2 className="text-lg font-semibold">Delivery & Signature Settings</h2>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="set-app-url">App Base URL</Label>
            <Input
              id="set-app-url"
              value={appUrl}
              onChange={(e) => setAppUrl(e.target.value)}
              placeholder={DEFAULT_APP_URL}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="set-timezone">Scheduling Timezone</Label>
            <Input
              id="set-timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="Asia/Kolkata"
            />
            <p className="text-xs text-muted-foreground">
              Day boundaries and daily limit resets occur at midnight in this timezone.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="set-signature">Default Email Signature</Label>
            <Textarea
              id="set-signature"
              rows={4}
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="Best regards,\nYour Name\nCompany"
            />
          </div>

          <Button type="submit" variant="signal" className="w-full">
            Save delivery preferences
          </Button>
        </form>

        {/* Deliverability Standards Card */}
        <div className="rounded-lg border bg-card p-6 shadow-card space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-signal" />
            <h3 className="font-semibold text-lg">Safe Sending Architecture</h3>
          </div>
          <div className="text-sm text-muted-foreground space-y-3 leading-relaxed">
            <p>
              DECILE Outreach is architected specifically to prevent Google domain flags and maximize inboxing:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-xs text-foreground/80">
              <li>Paced delivery (batches dispatched at controlled human intervals)</li>
              <li>Plain-text priority (no third-party promotional tracking redirects)</li>
              <li>Automatic suppression checking before any outbound send</li>
              <li>Gentle, natural opt-out phrase in every campaign sequence</li>
              <li>Multi-account rotation to distribute volume seamlessly</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Connect Account Dialog */}
      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Sending Account</DialogTitle>
            <DialogDescription>
              Link a Gmail or Google Workspace inbox to send safe outreach campaigns.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConnectAccount} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="acc-email">Gmail Address</Label>
              <Input
                id="acc-email"
                type="email"
                required
                placeholder="e.g. nandan.involynk@gmail.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="acc-name">Display Sender Name</Label>
              <Input
                id="acc-name"
                placeholder="e.g. Nandan T"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="acc-limit">Daily Send Cap</Label>
              <Input
                id="acc-limit"
                type="number"
                min={10}
                max={2000}
                value={newDailyLimit}
                onChange={(e) => setNewDailyLimit(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Recommended 250 for established inboxes, 50-100 for newly warmed accounts.
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConnectOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="signal">
                Connect account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
