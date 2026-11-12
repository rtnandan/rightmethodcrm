import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowRight, Upload, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EmptyState, PageHeader, StatCard, formatDateTime } from "@/components/app/page";
import { CampaignStatusBadge, DeliveryBadge } from "@/components/app/status";
import { LEAD_STATUSES } from "@/lib/email-utils";
import { store } from "@/lib/store";
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
import { toast } from "sonner";

export function DashboardPage() {
  const navigate = useNavigate();
  const [, setTick] = useState(0);
  const [newCampaignOpen, setNewCampaignOpen] = useState(false);
  const [campaignName, setCampaignName] = useState("");

  useEffect(() => {
    const unsub = store.subscribe(() => setTick((t) => t + 1));
    return unsub;
  }, []);

  const stats = store.getDashboardStats();
  const campaigns = store.getCampaigns();
  const accounts = store.getAccounts();
  const activity = store.getRecentActivity(8);

  const delivered = Math.max(0, stats.emails_sent - stats.bounced);
  const capacity = accounts
    .filter((a) => a.status === "active")
    .reduce((t, a) => t + Math.max(0, a.daily_limit - a.sent_today), 0);

  function handleCreateCampaign(e: React.FormEvent) {
    e.preventDefault();
    if (!campaignName.trim()) return;

    const activeAccounts = accounts.filter((a) => a.status === "active");
    const newCamp = store.createCampaign({
      name: campaignName.trim(),
      subject: "Quick question for {{company}}",
      body: `Hi {{first_name|there}},\n\nI noticed your work as {{designation}} at {{company}} in {{industry|the space}}.\n\nAt DECILE Media we help teams scale high-intent customer acquisition through tailored editorial sequences.\n\nWould you be open to a quick 15-minute call next week?`,
      account_ids: activeAccounts.map((a) => a.id),
    });

    toast.success("Campaign created");
    setNewCampaignOpen(false);
    setCampaignName("");
    navigate(`/campaigns/${newCamp.id}`);
  }

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="Where every lead stands, and what the sender will do next."
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("/leads/import")}>
              <Upload className="h-4 w-4" /> Import leads
            </Button>
            <Button variant="signal" onClick={() => setNewCampaignOpen(true)}>
              <Plus className="h-4 w-4" /> New campaign
            </Button>
          </>
        }
      />

      {/* 10 Stat Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total leads" value={stats.total_leads} />
        <StatCard label="Emails sent" value={stats.emails_sent} />
        <StatCard label="Delivered" value={delivered} hint="Sent minus bounced" />
        <StatCard label="Bounced" value={stats.bounced} />
        <StatCard label="Opened" value="—" hint="Not tracked — unreliable for plain emails" />
        <StatCard label="Replies" value={stats.replies} />
        <StatCard label="Interested" value={stats.interested} emphasis />
        <StatCard label="Meetings" value={stats.meetings} emphasis />
        <StatCard label="Pending follow-ups" value={stats.pending_follow_ups} />
        <StatCard
          label="Queued to send"
          value={stats.queued}
          hint={`${capacity} can still go out today`}
        />
      </div>

      {/* 2-column: Campaigns & Lead Status */}
      <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        {/* Left: Active Campaigns */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Campaigns</h2>
            <Link
              to="/campaigns"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground font-medium"
            >
              All campaigns <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {campaigns.length === 0 ? (
            <EmptyState title="No campaigns yet">
              Import some leads, then create your first campaign.
            </EmptyState>
          ) : (
            <div className="divide-y rounded-lg border bg-card shadow-card">
              {campaigns.slice(0, 5).map((c) => {
                const done = c.stats.sent + c.stats.failed + c.stats.skipped;
                const pct = c.stats.total ? Math.round((done / c.stats.total) * 100) : 0;
                return (
                  <Link
                    key={c.id}
                    to={`/campaigns/${c.id}`}
                    className="block px-4 py-3.5 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate font-medium text-foreground">{c.name}</span>
                      <CampaignStatusBadge status={c.status} />
                    </div>
                    <div className="mt-2.5 flex items-center gap-3">
                      <Progress value={pct} className="h-1.5" />
                      <span className="tabular w-28 shrink-0 text-right text-xs text-muted-foreground">
                        {c.stats.sent}/{c.stats.total} sent
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Right: Lead Status Breakdown */}
        <section>
          <h2 className="mb-3 text-xl font-semibold">Lead status</h2>
          <div className="rounded-lg border bg-card p-4 shadow-card">
            {LEAD_STATUSES.map((st) => {
              const count = Number(stats.by_status?.[st.value] ?? 0);
              const pct = stats.total_leads ? (count / stats.total_leads) * 100 : 0;
              return (
                <Link
                  key={st.value}
                  to={`/leads?status=${st.value}`}
                  className="flex items-center gap-3 py-1.5 text-sm hover:text-signal transition-colors group"
                >
                  <span className="w-40 shrink-0 text-foreground group-hover:text-signal">
                    {st.label}
                  </span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full bg-signal transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                  <span className="tabular w-10 text-right text-muted-foreground">{count}</span>
                </Link>
              );
            })}
          </div>
        </section>
      </div>

      {/* Recent Emails */}
      <section className="mt-10">
        <h2 className="mb-3 text-xl font-semibold">Recent emails</h2>
        {activity.length === 0 ? (
          <EmptyState title="Nothing sent yet">Sent emails will show up here.</EmptyState>
        ) : (
          <div className="divide-y rounded-lg border bg-card shadow-card">
            {activity.map((m) => (
              <div
                key={m.id}
                className="flex flex-col gap-1 px-4 py-3 text-sm md:flex-row md:items-center md:gap-4 hover:bg-muted/20"
              >
                <span className="tabular w-36 shrink-0 text-xs text-muted-foreground">
                  {formatDateTime(m.sent_at ?? m.created_at)}
                </span>
                <span className="w-56 shrink-0 truncate font-mono text-xs">{m.to_email}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{m.subject}</span>
                <span className="flex items-center gap-2">
                  {m.is_test && (
                    <span className="eyebrow px-1.5 py-0.5 rounded bg-muted">test</span>
                  )}
                  <DeliveryBadge status={m.status} />
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* New Campaign Dialog */}
      <Dialog open={newCampaignOpen} onOpenChange={setNewCampaignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create new campaign</DialogTitle>
            <DialogDescription>
              Start a new outreach sequence. You will review and approve it before sending.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateCampaign} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="camp-name">Campaign Name</Label>
              <Input
                id="camp-name"
                required
                placeholder="e.g. Q4 Growth Leaders Outreach"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setNewCampaignOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="signal" disabled={!campaignName.trim()}>
                Create campaign
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
