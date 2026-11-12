import { useEffect, useState } from "react";
import { Search, Trash2, ShieldOff, Check } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, PageHeader, formatDateTime } from "@/components/app/page";
import { isValidEmail, normalizeEmail } from "@/lib/email-utils";
import { store, type Suppression } from "@/lib/store";

const REASON_TONE: Record<string, "danger" | "warning" | "neutral"> = {
  unsubscribe: "danger",
  bounce: "warning",
  complaint: "danger",
  manual: "neutral",
};

export function SuppressionPage() {
  const [, setTick] = useState(0);
  const [emailsInput, setEmailsInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = store.subscribe(() => setTick((t) => t + 1));
    return unsub;
  }, []);

  const allSuppressions = store.getSuppressions();
  const filtered = allSuppressions.filter(
    (s) => !searchQuery.trim() || s.email.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const list = [...new Set(emailsInput.split(/[\s,;]+/).map(normalizeEmail).filter(Boolean))];
    const valid = list.filter(isValidEmail);

    if (valid.length === 0) {
      toast.error("Please enter at least one valid email address");
      return;
    }

    setBusy(true);
    const added = store.addSuppressions(valid, "manual");
    setBusy(false);
    setEmailsInput("");
    toast.success(`Added ${added} email${added === 1 ? "" : "s"} to suppression list`);
  }

  function handleRemove(sup: Suppression) {
    store.removeSuppression(sup.id);
    toast.info(`Removed ${sup.email} from suppression list`);
  }

  return (
    <>
      <PageHeader
        eyebrow="Compliance"
        title="Suppression list"
        description="Emails that will never be contacted under any circumstance."
      />

      <div className="grid gap-8 lg:grid-cols-[1.3fr_1.7fr]">
        {/* Left: Add form */}
        <div className="space-y-6">
          <form onSubmit={handleAdd} className="rounded-lg border bg-card p-6 shadow-card space-y-4">
            <div className="flex items-center gap-2">
              <ShieldOff className="h-5 w-5 text-signal" />
              <h2 className="text-lg font-semibold">Add to Suppression</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Paste one or multiple emails separated by commas or lines. Any current lead matching
              these addresses will be instantly marked as unsubscribed and removed from sending queues.
            </p>

            <Textarea
              rows={4}
              placeholder="alex@example.com&#10;sarah@company.com"
              value={emailsInput}
              onChange={(e) => setEmailsInput(e.target.value)}
              className="font-mono text-xs"
            />

            <Button type="submit" variant="signal" disabled={!emailsInput.trim() || busy} className="w-full">
              {busy ? "Processing…" : "Add to suppression list"}
            </Button>
          </form>

          <div className="rounded-lg border bg-card p-5 shadow-card text-xs text-muted-foreground space-y-2">
            <div className="font-semibold text-foreground">Automatic Invoicing Safeguard</div>
            <p>
              When a recipient unsubscribes via the opt-out link or replies asking to be removed,
              they are immediately registered here and blocked permanently across every present and future sequence.
            </p>
          </div>
        </div>

        {/* Right: Suppression Table */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search suppression list..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-card"
            />
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title="No suppressed emails"
              children={
                searchQuery
                  ? "No matching suppressed emails found."
                  : "The suppression list is empty. Suppressed emails will show here."
              }
            />
          ) : (
            <div className="rounded-lg border bg-card shadow-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email Address</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Date Added</TableHead>
                    <TableHead className="w-16 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs">{s.email}</TableCell>
                      <TableCell>
                        <Badge variant={REASON_TONE[s.reason] || "neutral"}>
                          {s.reason.charAt(0).toUpperCase() + s.reason.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular text-xs text-muted-foreground">
                        {formatDateTime(s.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <button
                          onClick={() => handleRemove(s)}
                          className="p-1 text-muted-foreground hover:text-destructive cursor-pointer"
                          title="Remove suppression"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="border-t px-4 py-2.5 text-xs text-muted-foreground">
                Total {filtered.length} suppressed address{filtered.length === 1 ? "" : "es"}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
