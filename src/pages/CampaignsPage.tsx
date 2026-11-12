import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Plus, Send, Pause, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { EmptyState, PageHeader, formatDateTime } from "@/components/app/page";
import { CampaignStatusBadge } from "@/components/app/status";
import { store } from "@/lib/store";

const STARTER_BODY = `Hi {{first_name|there}},

I came across {{company}} and noticed your work as {{designation}} in {{industry|your industry}}.

At DECILE Media we help teams like yours scale high-intent inbound opportunities through tailored editorial sequences.

Would you be open to a quick 15-minute call next week?`;

export function CampaignsPage() {
  const navigate = useNavigate();
  const [, setTick] = useState(0);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = store.subscribe(() => setTick((t) => t + 1));
    return unsub;
  }, []);

  const campaigns = store.getCampaigns();
  const accounts = store.getAccounts();

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);

    const activeAccounts = accounts.filter((a) => a.status === "active");
    const newCamp = store.createCampaign({
      name: name.trim(),
      subject: "Quick question for {{company}}",
      body: STARTER_BODY,
      account_ids: activeAccounts.map((a) => a.id),
    });

    setBusy(false);
    toast.success("Campaign created");
    setOpen(false);
    setName("");
    navigate(`/campaigns/${newCamp.id}`);
  }

  function handleTogglePause(campaignId: string, currentStatus: string) {
    if (currentStatus === "active") {
      store.updateCampaign(campaignId, { status: "paused" });
      toast.info("Campaign paused");
    } else if (currentStatus === "paused") {
      store.updateCampaign(campaignId, { status: "active" });
      toast.success("Campaign resumed");
    }
  }

  function handleDelete(campaignId: string, campaignName: string) {
    if (confirm(`Are you sure you want to delete campaign "${campaignName}"?`)) {
      store.deleteCampaign(campaignId);
      toast.success("Campaign deleted");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Sequences"
        title="Campaigns"
        description="Create, approve, pause and track email campaigns."
        actions={
          <Button variant="signal" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New campaign
          </Button>
        }
      />

      {campaigns.length === 0 ? (
        <EmptyState
          title="No campaigns yet"
          children="Create your first campaign to begin crafting outreach sequences."
          action={
            <Button variant="signal" onClick={() => setOpen(true)}>
              Create campaign
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="divide-y rounded-lg border bg-card shadow-card">
            {campaigns.map((c) => {
              const done = c.stats.sent + c.stats.failed + c.stats.skipped;
              const pct = c.stats.total ? Math.round((done / c.stats.total) * 100) : 0;
              return (
                <div
                  key={c.id}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <Link
                        to={`/campaigns/${c.id}`}
                        className="text-lg font-semibold hover:text-signal transition-colors truncate"
                      >
                        {c.name}
                      </Link>
                      <CampaignStatusBadge status={c.status} />
                    </div>

                    <div className="mt-1 text-xs text-muted-foreground flex items-center gap-2">
                      <span>Created {formatDateTime(c.created_at)}</span>
                      <span>&bull;</span>
                      <span>Subject: "{c.subject || "No subject"}"</span>
                      <span>&bull;</span>
                      <span className="tabular font-mono">Limit: {c.daily_limit}/day</span>
                    </div>

                    <div className="mt-3 flex items-center gap-3 max-w-md">
                      <Progress value={pct} className="h-2" />
                      <span className="tabular w-28 shrink-0 text-xs text-muted-foreground font-mono">
                        {c.stats.sent}/{c.stats.total} sent ({pct}%)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start md:self-center">
                    {c.status === "active" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTogglePause(c.id, c.status)}
                        className="gap-1.5 text-xs"
                      >
                        <Pause className="h-3.5 w-3.5" /> Pause
                      </Button>
                    )}
                    {c.status === "paused" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTogglePause(c.id, c.status)}
                        className="gap-1.5 text-xs text-success"
                      >
                        <Play className="h-3.5 w-3.5" /> Resume
                      </Button>
                    )}
                    <Button asChild variant="default" size="sm">
                      <Link to={`/campaigns/${c.id}`}>Open workspace</Link>
                    </Button>
                    <button
                      onClick={() => handleDelete(c.id, c.name)}
                      className="p-2 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                      title="Delete campaign"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* New Campaign Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New campaign</DialogTitle>
            <DialogDescription>
              Name your campaign. You'll write the copy and preview it before anything sends.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="camp-name-input">Campaign name</Label>
              <Input
                id="camp-name-input"
                required
                placeholder="e.g. Q4 Media & Agency Partners"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="signal" disabled={!name.trim() || busy}>
                {busy ? "Creating…" : "Create campaign"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
