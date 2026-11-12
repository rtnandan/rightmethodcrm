import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Plus, Search, Send, Trash2, Upload, Eye } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
import { AddToCampaignDialog } from "@/components/app/add-to-campaign";
import { AddLeadDialog } from "@/components/app/lead-form";
import { EmptyState, PageHeader, formatDateTime } from "@/components/app/page";
import { LeadStatusBadge } from "@/components/app/status";
import { LEAD_STATUSES } from "@/lib/email-utils";
import { store, type Lead } from "@/lib/store";

export function LeadsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStatus = searchParams.get("status") || "all";
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<"newest" | "oldest" | "name" | "company" | "last_contacted">("newest");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const [addToCampOpen, setAddToCampOpen] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsub = store.subscribe(() => setTick((t) => t + 1));
    return unsub;
  }, []);

  useEffect(() => {
    const s = searchParams.get("status");
    if (s && s !== statusFilter) {
      setStatusFilter(s);
    }
  }, [searchParams, statusFilter]);

  const allLeads = store.getLeads({
    q: searchQuery,
    status: statusFilter === "all" ? undefined : statusFilter,
    sort: sortOption,
  });

  const allSelected = allLeads.length > 0 && allLeads.every((l) => selectedIds.has(l.id));

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allLeads.map((l) => l.id)));
    }
  }

  function toggleSelectOne(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  function handleDeleteSelected() {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    store.deleteLeads([...selectedIds]);
    setSelectedIds(new Set());
    toast.success(`Deleted ${count} lead${count === 1 ? "" : "s"}`);
  }

  function handleFilterChange(val: string) {
    setStatusFilter(val);
    if (val === "all") {
      searchParams.delete("status");
      setSearchParams(searchParams);
    } else {
      setSearchParams({ status: val });
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Directory"
        title="Leads"
        description="Search, filter and manage every lead."
        actions={
          <>
            <Button variant="outline" onClick={() => setAddLeadOpen(true)}>
              <Plus className="h-4 w-4" /> Add lead
            </Button>
            <Button asChild variant="signal">
              <Link to="/leads/import">
                <Upload className="h-4 w-4" /> Import leads
              </Link>
            </Button>
          </>
        }
      />

      {/* Filter Toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
        <div className="flex flex-1 items-center gap-2 max-w-md relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search email, name, company, industry..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-card"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-48">
            <Select value={statusFilter} onValueChange={handleFilterChange}>
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {LEAD_STATUSES.map((st) => (
                  <SelectItem key={st.value} value={st.value}>
                    {st.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-40">
            <Select value={sortOption} onValueChange={(v: any) => setSortOption(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="name">Name A-Z</SelectItem>
                <SelectItem value="company">Company A-Z</SelectItem>
                <SelectItem value="last_contacted">Last contacted</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Multi-selection Bar */}
      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-sidebar p-3 text-sidebar-foreground shadow-sm animate-in fade-in">
          <span className="text-sm font-medium">
            {selectedIds.size} lead{selectedIds.size === 1 ? "" : "s"} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="signal"
              size="sm"
              onClick={() => setAddToCampOpen(true)}
              className="gap-1.5"
            >
              <Send className="h-3.5 w-3.5" /> Add to campaign
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteSelected}
              className="gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </div>
        </div>
      )}

      {/* Leads Table */}
      {allLeads.length === 0 ? (
        <EmptyState
          title="No leads found"
          children="Try adjusting your search filters or import a fresh list of prospects."
          action={
            <Button variant="signal" onClick={() => setAddLeadOpen(true)}>
              Add your first lead
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border bg-card shadow-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} />
                </TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Company & Role</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Contacted</TableHead>
                <TableHead className="w-16 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allLeads.map((lead) => {
                const isChecked = selectedIds.has(lead.id);
                const fullName = [lead.first_name, lead.last_name].filter(Boolean).join(" ");
                return (
                  <TableRow key={lead.id} className={isChecked ? "bg-muted/40" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleSelectOne(lead.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <Link
                        to={`/leads/${lead.id}`}
                        className="font-medium text-foreground hover:text-signal transition-colors block"
                      >
                        {fullName || lead.email}
                      </Link>
                      <div className="font-mono text-xs text-muted-foreground">{lead.email}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{lead.company || "—"}</div>
                      <div className="text-xs text-muted-foreground">{lead.designation || "—"}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {lead.industry || "—"}
                    </TableCell>
                    <TableCell>
                      <LeadStatusBadge status={lead.status} />
                    </TableCell>
                    <TableCell className="tabular text-xs text-muted-foreground">
                      {formatDateTime(lead.last_contacted_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        to={`/leads/${lead.id}`}
                        className="inline-flex p-1 text-muted-foreground hover:text-foreground"
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="border-t px-4 py-3 text-xs text-muted-foreground flex justify-between items-center">
            <span>
              Showing {allLeads.length} lead{allLeads.length === 1 ? "" : "s"}
            </span>
            <span className="font-mono">Auto-deduplicated</span>
          </div>
        </div>
      )}

      {/* Add Lead Dialog */}
      <AddLeadDialog open={addLeadOpen} onOpenChange={setAddLeadOpen} />

      {/* Add To Campaign Dialog */}
      <AddToCampaignDialog
        open={addToCampOpen}
        onOpenChange={setAddToCampOpen}
        leadIds={[...selectedIds]}
        onDone={() => setSelectedIds(new Set())}
      />
    </>
  );
}
