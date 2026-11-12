import { useParams, useNavigate, Link } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import {
  ArrowLeft,
  Pause,
  Play,
  Send,
  Trash2,
  Zap,
  Download,
  AlertTriangle,
  CheckCircle,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { AddToCampaignDialog } from "@/components/app/add-to-campaign";
import { EmptyState, PageHeader, StatCard, downloadCsv, formatDateTime } from "@/components/app/page";
import {
  AccountStatusBadge,
  CampaignStatusBadge,
  DeliveryBadge,
  LeadStatusBadge,
} from "@/components/app/status";
import { composeEmail, inboxWarnings, OPT_OUT_LINE } from "@/lib/compose";
import { STANDARD_VARIABLES, toCsv, type LeadLike } from "@/lib/email-utils";
import { store, type Campaign, type SendingAccount } from "@/lib/store";

export function CampaignDetailPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsub = store.subscribe(() => setTick((t) => t + 1));
    return unsub;
  }, []);

  const campaign = campaignId ? store.getCampaignById(campaignId) : null;
  const accounts = store.getAccounts();
  const settings = store.getSettings();

  // Tab & Filter States
  const [activeTab, setActiveTab] = useState("composer");
  const [recipientFilter, setRecipientFilter] = useState("all");

  // Composer Form
  const [subject, setSubject] = useState(campaign?.subject ?? "");
  const [body, setBody] = useState(campaign?.body ?? "");
  const [dailyLimit, setDailyLimit] = useState(String(campaign?.daily_limit ?? 250));
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>(
    campaign?.account_ids ?? [],
  );

  // Dialogs
  const [approveOpen, setApproveOpen] = useState(false);
  const [testEmailOpen, setTestEmailOpen] = useState(false);
  const [addLeadsOpen, setAddLeadsOpen] = useState(false);

  // Test Email state
  const [testRecipient, setTestRecipient] = useState("nandan.involynk@gmail.com");
  const [testAccountId, setTestAccountId] = useState(accounts[0]?.id || "");
  const [sendingTest, setSendingTest] = useState(false);

  // Batch sending state
  const [sendingBatch, setSendingBatch] = useState(false);

  useEffect(() => {
    if (campaign) {
      setSubject(campaign.subject);
      setBody(campaign.body);
      setDailyLimit(String(campaign.daily_limit));
      setSelectedAccountIds(campaign.account_ids);
      if (accounts[0] && !testAccountId) {
        setTestAccountId(accounts[0].id);
      }
    }
  }, [campaign?.id]);

  if (!campaign) {
    return (
      <EmptyState
        title="Campaign not found"
        action={
          <Button variant="outline" onClick={() => navigate("/campaigns")}>
            Back to campaigns
          </Button>
        }
      />
    );
  }

  const activeCampaign = campaign;

  const recipients = store.getCampaignRecipients(activeCampaign.id, recipientFilter);
  const allRecipients = store.getCampaignRecipients(activeCampaign.id);
  const sampleLead = recipients[0]?.leads || {
    first_name: "Arjun",
    last_name: "Mehta",
    company: "Veritas Ventures",
    designation: "Partner",
    industry: "Venture Capital",
    email: "arjun.m@veritasventures.in",
  };

  const preview = composeEmail({
    subject: subject || "Quick question for {{company}}",
    body: body || "Hi {{first_name|there}},\n\n...",
    signature: settings.signature,
    lead: sampleLead,
    optOut: true,
  });

  const spamWarnings = inboxWarnings(subject, body);
  const isEditable = activeCampaign.status === "draft" || activeCampaign.status === "paused";

  function handleSaveSettings() {
    const lim = Math.max(1, Math.min(5000, Number(dailyLimit) || 250));
    store.updateCampaign(activeCampaign.id, {
      subject,
      body,
      daily_limit: lim,
      account_ids: selectedAccountIds,
    });
    toast.success("Campaign settings saved");
  }

  function handleApprove() {
    store.updateCampaign(activeCampaign.id, {
      status: "active",
      approved_at: new Date().toISOString(),
      started_at: activeCampaign.started_at || new Date().toISOString(),
    });
    setApproveOpen(false);
    toast.success("Campaign approved! Outreach is active.");
  }

  function handleTogglePause() {
    if (activeCampaign.status === "active") {
      store.updateCampaign(activeCampaign.id, { status: "paused" });
      toast.info("Campaign paused");
    } else {
      store.updateCampaign(activeCampaign.id, { status: "active" });
      toast.success("Campaign resumed");
    }
  }

  function handleSendBatch() {
    setSendingBatch(true);
    setTimeout(() => {
      try {
        const res = store.sendBatchNow(activeCampaign.id, 5);
        setSendingBatch(false);
        if (res.sent > 0) {
          toast.success(`Sent batch of ${res.sent} email${res.sent === 1 ? "" : "s"}!`);
        } else {
          toast.info(res.message || "No queued recipients to send");
        }
      } catch (e) {
        setSendingBatch(false);
        toast.error((e as Error).message);
      }
    }, 600);
  }

  function handleSendTest(e: React.FormEvent) {
    e.preventDefault();
    setSendingTest(true);

    setTimeout(() => {
      try {
        store.sendTestEmail({
          campaignId: activeCampaign.id,
          accountId: testAccountId,
          to: testRecipient,
          leadId: sampleLead && "id" in sampleLead ? (sampleLead as any).id : null,
        });
        setSendingTest(false);
        setTestEmailOpen(false);
        toast.success(`Test email sent to ${testRecipient}`);
      } catch (err) {
        setSendingTest(false);
        toast.error((err as Error).message);
      }
    }, 500);
  }

  function handleExportCsv() {
    const rows = allRecipients.map((r) => ({
      email: r.leads?.email || "",
      first_name: r.leads?.first_name || "",
      last_name: r.leads?.last_name || "",
      company: r.leads?.company || "",
      delivery_status: r.status,
      sent_at: r.sent_at || "",
      error: r.error || "",
    }));
    const csv = toCsv(rows);
    downloadCsv(`${activeCampaign.name.toLowerCase().replace(/\s+/g, "_")}_recipients.csv`, csv);
    toast.success("Exported recipients CSV");
  }

  function handleDelete() {
    if (confirm(`Permanently delete campaign "${activeCampaign.name}"?`)) {
      store.deleteCampaign(activeCampaign.id);
      toast.success("Campaign deleted");
      navigate("/campaigns");
    }
  }

  function insertVariable(varName: string) {
    setBody((prev) => `${prev} {{${varName}}}`);
  }

  return (
    <>
      <div className="mb-4">
        <Link
          to="/campaigns"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to campaigns
        </Link>
      </div>

      <PageHeader
        eyebrow="Campaign Workspace"
        title={activeCampaign.name}
        description={
          <div className="flex items-center gap-2">
            <CampaignStatusBadge status={activeCampaign.status} />
            <span className="text-muted-foreground">&bull;</span>
            <span className="font-mono text-xs text-muted-foreground">
              {activeCampaign.stats.sent} of {activeCampaign.stats.total} delivered
            </span>
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {activeCampaign.status === "draft" && (
              <Button variant="signal" onClick={() => setApproveOpen(true)}>
                <CheckCircle className="h-4 w-4" /> Review & approve
              </Button>
            )}

            {activeCampaign.status === "active" && (
              <>
                <Button
                  variant="signal"
                  onClick={handleSendBatch}
                  disabled={sendingBatch || activeCampaign.stats.queued === 0}
                  className="gap-1.5"
                >
                  <Zap className="h-4 w-4" />
                  {sendingBatch ? "Sending batch..." : "Send next batch now"}
                </Button>
                <Button variant="outline" onClick={handleTogglePause}>
                  <Pause className="h-4 w-4" /> Pause
                </Button>
              </>
            )}

            {activeCampaign.status === "paused" && (
              <Button variant="outline" onClick={handleTogglePause} className="text-success">
                <Play className="h-4 w-4" /> Resume
              </Button>
            )}

            <Button variant="outline" size="sm" onClick={() => setTestEmailOpen(true)}>
              <Send className="h-3.5 w-3.5" /> Send test email
            </Button>

            <Button variant="outline" size="sm" onClick={handleExportCsv}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>

            <Button variant="outline" size="sm" onClick={handleDelete} className="text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6 mb-8">
        <StatCard label="Total leads" value={activeCampaign.stats.total} />
        <StatCard label="Queued" value={activeCampaign.stats.queued} />
        <StatCard label="Sending" value={activeCampaign.stats.sending} />
        <StatCard label="Sent" value={activeCampaign.stats.sent} emphasis />
        <StatCard label="Failed" value={activeCampaign.stats.failed} />
        <StatCard label="Skipped" value={activeCampaign.stats.skipped} />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="composer">Composer & Settings</TabsTrigger>
          <TabsTrigger value="recipients">Recipients & Progress ({activeCampaign.stats.total})</TabsTrigger>
        </TabsList>

        {/* TAB 1: Composer & Settings */}
        <TabsContent value="composer" className="space-y-8">
          {!isEditable && (
            <div className="rounded-md border border-warning/40 bg-warning-soft px-4 py-2.5 text-sm text-foreground flex items-center justify-between">
              <span>This campaign is currently sending. Pause it to edit copy or sending accounts.</span>
              <Button variant="outline" size="sm" onClick={handleTogglePause}>
                Pause to edit
              </Button>
            </div>
          )}

          <div className="grid gap-8 lg:grid-cols-2">
            {/* Left Column: Subject, Body, and Insertion Tools */}
            <div className="rounded-lg border bg-card p-6 shadow-card space-y-5">
              <h3 className="font-semibold text-lg">Email Copy</h3>

              <div className="space-y-1.5">
                <Label htmlFor="camp-subject">Subject line</Label>
                <Input
                  id="camp-subject"
                  disabled={!isEditable}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Quick question for {{company}}"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="camp-body">Email Body (Plain text)</Label>
                  <span className="text-xs text-muted-foreground font-mono">
                    {body.trim().split(/\s+/).filter(Boolean).length} words
                  </span>
                </div>

                {/* Variable insertion buttons */}
                {isEditable && (
                  <div className="flex flex-wrap items-center gap-1.5 pb-2">
                    <span className="text-xs text-muted-foreground mr-1">Insert:</span>
                    {STANDARD_VARIABLES.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => insertVariable(v)}
                        className="rounded-md bg-muted px-2 py-1 font-mono text-[11px] text-foreground hover:bg-muted-foreground/20 cursor-pointer"
                      >
                        {`{{${v}}}`}
                      </button>
                    ))}
                  </div>
                )}

                <Textarea
                  id="camp-body"
                  disabled={!isEditable}
                  rows={10}
                  className="font-sans leading-relaxed"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </div>

              {/* Spam & Deliverability Warnings */}
              {spamWarnings.length > 0 && (
                <div className="rounded-md border border-warning/30 bg-warning-soft/60 p-4 space-y-1.5">
                  <div className="flex items-center gap-2 text-warning font-semibold text-xs">
                    <AlertTriangle className="h-4 w-4" /> Deliverability Advice (Inbox vs Promotions)
                  </div>
                  <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
                    {spamWarnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Sending Accounts Selection */}
              <div className="pt-4 border-t space-y-3">
                <Label>Rotate Sends Across Connected Accounts</Label>
                <div className="divide-y rounded-md border bg-muted/20">
                  {accounts.map((acc) => (
                    <label
                      key={acc.id}
                      className="flex items-center gap-3 p-3 text-sm cursor-pointer hover:bg-muted/40"
                    >
                      <Checkbox
                        disabled={!isEditable}
                        checked={selectedAccountIds.includes(acc.id)}
                        onCheckedChange={(v) => {
                          if (v) setSelectedAccountIds([...selectedAccountIds, acc.id]);
                          else setSelectedAccountIds(selectedAccountIds.filter((id) => id !== acc.id));
                        }}
                      />
                      <div className="flex-1">
                        <div className="font-medium">{acc.email}</div>
                        <div className="text-xs text-muted-foreground">
                          {acc.from_name} &bull; {acc.sent_today}/{acc.daily_limit} today
                        </div>
                      </div>
                      <AccountStatusBadge status={acc.status} />
                    </label>
                  ))}
                </div>
              </div>

              {/* Daily Limit */}
              <div className="space-y-1.5">
                <Label htmlFor="camp-limit">Campaign Daily Cap</Label>
                <Input
                  id="camp-limit"
                  type="number"
                  disabled={!isEditable}
                  className="w-40 font-mono"
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Safe sending limit for this sequence. Accounts will rotate up to their capacity.
                </p>
              </div>

              {isEditable && (
                <Button variant="signal" onClick={handleSaveSettings} className="w-full">
                  Save campaign configuration
                </Button>
              )}
            </div>

            {/* Right Column: Live Recipient Preview */}
            <div className="space-y-4">
              <div className="rounded-lg border bg-card p-6 shadow-card space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">Live Preview</h3>
                  <span className="eyebrow">Sample lead: {sampleLead.company}</span>
                </div>

                <div className="rounded-md bg-muted/40 p-4 border space-y-3 text-sm">
                  <div className="border-b pb-2">
                    <span className="text-xs text-muted-foreground">To: </span>
                    <span className="font-mono text-xs">{sampleLead.email}</span>
                  </div>
                  <div className="border-b pb-2">
                    <span className="text-xs text-muted-foreground">Subject: </span>
                    <span className="font-medium text-foreground">{preview.subject}</span>
                  </div>
                  <div className="whitespace-pre-wrap font-sans text-sm text-foreground/90 leading-relaxed pt-2">
                    {preview.body}
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  <div className="font-semibold text-foreground mb-1">Human-grade Deliverability:</div>
                  Emails sent via DECILE Outreach avoid promotional HTML wrappers and trackless links,
                  ensuring they land directly in the primary inbox.
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: Recipients */}
        <TabsContent value="recipients" className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {["all", "queued", "sent", "failed", "skipped"].map((st) => (
                <button
                  key={st}
                  onClick={() => setRecipientFilter(st)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                    recipientFilter === st
                      ? "bg-signal text-signal-foreground font-semibold"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {st.charAt(0).toUpperCase() + st.slice(1)}
                </button>
              ))}
            </div>

            <Button variant="signal" size="sm" onClick={() => setAddLeadsOpen(true)}>
              Add leads to this campaign
            </Button>
          </div>

          {recipients.length === 0 ? (
            <EmptyState
              title="No recipients in this view"
              children="Add leads to this campaign or adjust the status filter."
              action={
                <Button variant="signal" onClick={() => setAddLeadsOpen(true)}>
                  Add leads
                </Button>
              }
            />
          ) : (
            <div className="rounded-lg border bg-card shadow-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Company & Role</TableHead>
                    <TableHead>Delivery Status</TableHead>
                    <TableHead>Sent At</TableHead>
                    <TableHead className="w-16 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recipients.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        {r.leads ? (
                          <Link
                            to={`/leads/${r.leads.id}`}
                            className="font-medium text-foreground hover:text-signal transition-colors block"
                          >
                            {[r.leads.first_name, r.leads.last_name].filter(Boolean).join(" ") ||
                              r.leads.email}
                          </Link>
                        ) : (
                          "—"
                        )}
                        <div className="font-mono text-xs text-muted-foreground">
                          {r.leads?.email}
                        </div>
                        {r.error && <div className="text-xs text-destructive mt-1">{r.error}</div>}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{r.leads?.company || "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.leads?.designation || "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DeliveryBadge status={r.status} />
                      </TableCell>
                      <TableCell className="tabular text-xs text-muted-foreground">
                        {formatDateTime(r.sent_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.status === "queued" && (
                          <button
                            onClick={() => {
                              store.removeQueuedRecipient(r.id);
                              toast.success("Removed recipient from queue");
                            }}
                            className="text-muted-foreground hover:text-destructive cursor-pointer p-1"
                            title="Remove from queue"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Review & Approve Dialog */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Review & Approve Campaign</DialogTitle>
            <DialogDescription>
              Check the outreach checklist. Once approved, sending can begin in safe batches.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2">
            <div className="rounded-md bg-muted/40 p-4 border space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <span>Email subject and plain body composed</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <span>
                  Connected sending account:{" "}
                  <strong>{accounts.find((a) => a.id === selectedAccountIds[0])?.email || "Gmail Desk"}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <span>
                  <strong>{activeCampaign.stats.queued}</strong> recipients queued to receive outreach
                </span>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              Emails will be sent with personalized merge fields and the standard personal opt-out line.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)}>
              Cancel
            </Button>
            <Button variant="signal" onClick={handleApprove}>
              Approve & start sending
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Test Email Dialog */}
      <Dialog open={testEmailOpen} onOpenChange={setTestEmailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send test email</DialogTitle>
            <DialogDescription>
              Verify your template by sending a test copy with sample merged fields.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSendTest} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="test-recipient">Send test to</Label>
              <Input
                id="test-recipient"
                type="email"
                required
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>From account</Label>
              <Select value={testAccountId} onValueChange={setTestAccountId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.email} ({a.from_name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTestEmailOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="signal" disabled={sendingTest}>
                {sendingTest ? "Sending..." : "Send test"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Leads Dialog */}
      <AddToCampaignDialog
        open={addLeadsOpen}
        onOpenChange={setAddLeadsOpen}
        leadIds={store.getLeads().map((l) => l.id)}
      />
    </>
  );
}
