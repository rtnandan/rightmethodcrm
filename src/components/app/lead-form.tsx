import { useState } from "react";
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
import { isValidEmail, normalizeEmail } from "@/lib/email-utils";
import { store } from "@/lib/store";

const FIELDS = [
  ["first_name", "First name"],
  ["last_name", "Last name"],
  ["company", "Company"],
  ["designation", "Designation"],
  ["industry", "Industry"],
] as const;

export function AddLeadDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdded?: () => void;
}) {
  const [form, setForm] = useState<Partial<Record<"email" | (typeof FIELDS)[number][0], string>>>({});
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const email = normalizeEmail(form.email ?? "");
    if (!isValidEmail(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setBusy(true);
    try {
      store.addLead({
        email,
        first_name: form.first_name?.trim() ?? "",
        last_name: form.last_name?.trim() ?? "",
        company: form.company?.trim() ?? "",
        designation: form.designation?.trim() ?? "",
        industry: form.industry?.trim() ?? "",
        source: "manual",
        status: "not_contacted",
        custom_fields: {},
        last_contacted_at: null,
      });

      toast.success("Lead added");
      setForm({});
      onOpenChange(false);
      onAdded?.();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a lead</DialogTitle>
          <DialogDescription>Only the email is required.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="lead-email">Email</Label>
            <Input
              id="lead-email"
              type="email"
              required
              placeholder="e.g. alex@example.com"
              value={form.email ?? ""}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {FIELDS.map(([k, label]) => (
              <div key={k} className="space-y-1.5">
                <Label htmlFor={`lead-${k}`}>{label}</Label>
                <Input
                  id={`lead-${k}`}
                  value={form[k] ?? ""}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="signal" disabled={busy}>
              {busy ? "Saving…" : "Add lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
