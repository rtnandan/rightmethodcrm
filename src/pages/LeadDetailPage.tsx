import { useParams, useNavigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowLeft, ShieldOff, Trash2, Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, PageHeader, formatDateTime } from "@/components/app/page";
import { CampaignStatusBadge, DeliveryBadge, LeadStatusBadge } from "@/components/app/status";
import { LEAD_STATUSES } from "@/lib/email-utils";
import { store, type Lead } from "@/lib/store";

const EDITABLE = [
  ["first_name", "First name"],
  ["last_name", "Last name"],
  ["company", "Company"],
  ["designation", "Designation"],
  ["industry", "Industry"],
] as const;

export function LeadDetailPage() {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsub = store.subscribe(() => setTick((t) => t + 1));
    return unsub;
  }, []);

  const details = leadId ? store.getLeadDetails(leadId) : null;

  const [form, setForm] = useState({
    first_name: details?.lead.first_name ?? "",
    last_name: details?.lead.last_name ?? "",
    company: details?.lead.company ?? "",
    designation: details?.lead.designation ?? "",
    industry: details?.lead.industry ?? "",
    status: details?.lead.status ?? "not_contacted",
  });

  useEffect(() => {
    if (details?.lead) {
      setForm({
        first_name: details.lead.first_name,
        last_name: details.lead.last_name,
        company: details.lead.company,
        designation: details.lead.designation,
        industry: details.lead.industry,
        status: details.lead.status,
      });
    }
  }, [details?.lead]);

  if (!details || !details.lead) {
    return (
      <EmptyState
        title="Lead not found"
        action={
          <Button variant="outline" onClick={() => navigate("/leads")}>
            Back to leads
          </Button>
        }
      />
    );
  }

  const { lead, messages, enrolments } = details;
  const fullName = [lead.first_name, lead.last_name].filter(Boolean).join(" ");

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    store.updateLead(lead.id, form);
    toast.success("Lead updated successfully");
  }

  function handleSuppress() {
    store.addSuppressions([lead.email], "manual");
    toast.info("Added to suppression list — lead unsubscribed");
  }

  function handleDelete() {
    if (confirm("Are you sure you want to permanently delete this lead?")) {
      store.deleteLeads([lead.id]);
      toast.success("Lead deleted");
      navigate("/leads");
    }
  }

  return (
    <>
      <div className="mb-4">
        <Link
          to="/leads"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to leads
        </Link>
      </div>

      <PageHeader
        eyebrow="Lead Profile"
        title={fullName || lead.email}
        description={
          <span className="font-mono text-sm text-muted-foreground">
            {lead.email} &bull; Created {formatDateTime(lead.created_at)}
          </span>
        }
        actions={
          <div className="flex items-center gap-3">
            <div className="w-48">
              <Select
                value={form.status}
                onValueChange={(val: any) => {
                  setForm({ ...form, status: val });
                  store.updateLead(lead.id, { status: val });
                  toast.success("Status updated");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_STATUSES.map((st) => (
                    <SelectItem key={st.value} value={st.value}>
                      {st.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <LeadStatusBadge status={form.status} />
          </div>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[1.2fr_1.8fr]">
        {/* Left: Contact Info & Controls */}
        <div className="space-y-6">
          <form onSubmit={handleSave} className="rounded-lg border bg-card p-6 shadow-card space-y-4">
            <h2 className="text-lg font-semibold">Contact Details</h2>

            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={lead.email} disabled className="bg-muted font-mono text-xs" />
            </div>

            {EDITABLE.map(([k, label]) => (
              <div key={k} className="space-y-1.5">
                <Label htmlFor={`detail-${k}`}>{label}</Label>
                <Input
                  id={`detail-${k}`}
                  value={(form as any)[k] ?? ""}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                />
              </div>
            ))}

            {lead.custom_fields && Object.keys(lead.custom_fields).length > 0 && (
              <div className="pt-2 border-t">
                <div className="eyebrow mb-2">Custom Fields</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(lead.custom_fields).map(([k, v]) => (
                    <div key={k} className="rounded bg-muted/60 p-2">
                      <div className="font-mono text-[11px] text-muted-foreground">{k}</div>
                      <div className="font-medium text-foreground">{String(v)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button type="submit" variant="signal" className="w-full mt-4">
              Save changes
            </Button>
          </form>

          {/* Compliance & Danger Zone */}
          <div className="rounded-lg border bg-card p-6 shadow-card space-y-3">
            <h3 className="text-sm font-semibold">Compliance & Actions</h3>
            <p className="text-xs text-muted-foreground">
              Add to suppression list to immediately block this contact across all campaigns.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <Button
                variant="outline"
                onClick={handleSuppress}
                disabled={lead.status === "unsubscribed"}
                className="w-full justify-start text-xs gap-2"
              >
                <ShieldOff className="h-4 w-4 text-warning" />
                {lead.status === "unsubscribed" ? "Already Suppressed" : "Add to suppression list"}
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                className="w-full justify-start text-xs gap-2"
              >
                <Trash2 className="h-4 w-4" /> Delete lead
              </Button>
            </div>
          </div>
        </div>

        {/* Right: Campaign Enrolments & Email History */}
        <div className="space-y-6">
          {/* Campaign Enrolments */}
          <div className="rounded-lg border bg-card p-6 shadow-card">
            <h2 className="text-lg font-semibold mb-3">Campaign Enrolments</h2>
            {enrolments.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center border rounded-md border-dashed">
                This lead has not been enrolled in any campaign yet.
              </div>
            ) : (
              <div className="divide-y rounded-md border">
                {enrolments.map((e) => (
                  <div key={e.id} className="flex items-center justify-between p-3 text-sm">
                    <div>
                      {e.campaigns ? (
                        <Link
                          to={`/campaigns/${e.campaigns.id}`}
                          className="font-medium hover:text-signal transition-colors"
                        >
                          {e.campaigns.name}
                        </Link>
                      ) : (
                        <span className="font-medium">Campaign</span>
                      )}
                      <div className="text-xs text-muted-foreground">
                        Enrolled {formatDateTime(e.created_at)}
                      </div>
                    </div>
                    <DeliveryBadge status={e.status} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Email Messages Timeline */}
          <div className="rounded-lg border bg-card p-6 shadow-card">
            <h2 className="text-lg font-semibold mb-3">Email History</h2>
            {messages.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center border rounded-md border-dashed">
                No emails sent to or received from this lead yet.
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-lg border bg-muted/20 p-4 space-y-2 relative"
                  >
                    <div className="flex items-center justify-between">
                      <span className="eyebrow flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5" />
                        {m.direction === "inbound" ? "Received Reply" : "Outbound Message"}
                        {m.is_test && <span className="bg-muted px-1.5 rounded">TEST</span>}
                      </span>
                      <span className="tabular text-xs text-muted-foreground">
                        {formatDateTime(m.sent_at ?? m.created_at)}
                      </span>
                    </div>

                    <div className="text-sm font-semibold text-foreground">{m.subject}</div>

                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <span>From: {m.from_email}</span>
                      <span>&rarr;</span>
                      <span>To: {m.to_email}</span>
                    </div>

                    <div className="mt-2 rounded bg-card p-3 border font-sans text-xs whitespace-pre-wrap leading-relaxed text-foreground/90">
                      {m.body}
                    </div>

                    <div className="flex items-center justify-between pt-1 text-xs">
                      <DeliveryBadge status={m.status} />
                      {m.error && <span className="text-destructive font-mono">{m.error}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
