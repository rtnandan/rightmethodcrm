import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, FileSpreadsheet, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader, StatCard } from "@/components/app/page";
import {
  guessTarget,
  IMPORT_TARGETS,
  mapRow,
  type ImportTarget,
  type MappedLead,
} from "@/lib/import-mapping";
import { classifyImportRows, normalizeEmail } from "@/lib/email-utils";
import { store } from "@/lib/store";

const SAMPLE_CSV_ROWS = [
  { "Work Email": "sanya.mirza@finscale.io", "First Name": "Sanya", "Last Name": "Mirza", "Organization": "FinScale", "Role": "VP Product", "Sector": "Fintech" },
  { "Work Email": "kunal.shah@credex.co", "First Name": "Kunal", "Last Name": "Shah", "Organization": "Credex Media", "Role": "Founder", "Sector": "Consumer Tech" },
  { "Work Email": "priya.nair@hyperreach.ai", "First Name": "Priya", "Last Name": "Nair", "Organization": "HyperReach", "Role": "Head of Growth", "Sector": "MarTech" },
  { "Work Email": "rahul.dravid@wallmedia.in", "First Name": "Rahul", "Last Name": "Dravid", "Organization": "Wall Media", "Role": "Managing Director", "Sector": "Publishing" },
  { "Work Email": "deepika.pad@glowbrands.com", "First Name": "Deepika", "Last Name": "Padukone", "Organization": "Glow Brands", "Role": "Chief Brand Officer", "Sector": "E-Commerce" },
  { "Work Email": "vijay.shekhar@payfast.net", "First Name": "Vijay", "Last Name": "Shekhar", "Organization": "PayFast Digital", "Role": "CEO", "Sector": "Payments" },
  { "Work Email": "aditi.d@heliosmobility.com", "First Name": "Aditi", "Last Name": "Deshmukh", "Organization": "Helios", "Role": "Co-Founder", "Sector": "CleanTech" }, // suppressed in store!
  { "Work Email": "invalid-email-format-test", "First Name": "Test", "Last Name": "Invalid", "Organization": "Test Co", "Role": "QA", "Sector": "Testing" },
  { "Work Email": "kunal.shah@credex.co", "First Name": "Kunal", "Last Name": "Shah", "Organization": "Credex Media", "Role": "Founder", "Sector": "Consumer Tech" }, // duplicate in file!
  { "Work Email": "arjun.m@veritasventures.in", "First Name": "Arjun", "Last Name": "Mehta", "Organization": "Veritas", "Role": "Partner", "Sector": "VC" }, // already exists in store!
];

export function ImportLeadsPage() {
  const navigate = useNavigate();
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Record<string, ImportTarget>>({});
  const [busy, setBusy] = useState<"" | "reading" | "checking" | "importing">("");
  const [progress, setProgress] = useState(0);

  function loadSampleData() {
    setBusy("reading");
    setFileName("sample_prospect_list.csv");
    const h = Object.keys(SAMPLE_CSV_ROWS[0]);
    setHeaders(h);
    setRows(SAMPLE_CSV_ROWS);

    const m: Record<string, ImportTarget> = {};
    for (const header of h) {
      m[header] = guessTarget(header);
    }
    setMapping(m);
    setBusy("");
    toast.success("Loaded sample prospect list with 10 test entries");
  }

  async function handleFile(file: File) {
    setBusy("reading");
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const sheetName = wb.SheetNames[0];
      if (!sheetName) throw new Error("No sheet found in file");

      const sheet = wb.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
        raw: false,
      });

      if (json.length === 0) throw new Error("File is empty");

      const fileHeaders = Object.keys(json[0] || {});
      setHeaders(fileHeaders);
      setRows(json);

      // Guess target columns
      const m: Record<string, ImportTarget> = {};
      for (const h of fileHeaders) {
        m[h] = guessTarget(h);
      }
      setMapping(m);
      toast.success(`Loaded ${json.length} rows from ${file.name}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy("");
    }
  }

  // Pre-validate rows
  const existingEmails = new Set(store.getLeads().map((l) => l.email));
  const suppressedEmails = new Set(store.getSuppressions().map((s) => s.email));

  const mappedLeads: MappedLead[] = rows.map((r, i) => mapRow(r, mapping, i));
  const classification = classifyImportRows(mappedLeads, existingEmails);

  const readyToImport = classification.valid.filter(
    (l) => !suppressedEmails.has(normalizeEmail(l.email)),
  );
  const suppressedInImport = classification.valid.filter((l) =>
    suppressedEmails.has(normalizeEmail(l.email)),
  );

  const emailFieldMapped = Object.values(mapping).includes("email");

  async function handleImport() {
    if (readyToImport.length === 0 && suppressedInImport.length === 0) {
      toast.error("No valid leads to import");
      return;
    }

    setBusy("importing");
    setProgress(15);

    setTimeout(() => {
      setProgress(60);

      const toAdd = [...readyToImport, ...suppressedInImport].map((l) => ({
        email: l.email,
        first_name: l.first_name,
        last_name: l.last_name,
        company: l.company,
        designation: l.designation,
        industry: l.industry,
        custom_fields: l.custom_fields,
        source: "import",
        status: suppressedEmails.has(normalizeEmail(l.email))
          ? ("unsubscribed" as const)
          : ("not_contacted" as const),
        last_contacted_at: null,
      }));

      const added = store.addLeadsBatch(toAdd);
      setProgress(100);

      setTimeout(() => {
        toast.success(`Imported ${added} leads successfully`);
        navigate("/leads");
      }, 300);
    }, 500);
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
        eyebrow="Upload"
        title="Import leads"
        description="Upload leads from a CSV or Excel file. Columns will be auto-mapped and deduplicated."
      />

      {rows.length === 0 ? (
        <div className="space-y-6 max-w-2xl">
          <div className="rounded-lg border-2 border-dashed border-border bg-card p-12 text-center shadow-card hover:border-signal/50 transition-colors">
            <FileSpreadsheet className="mx-auto h-12 w-12 text-signal" />
            <h3 className="mt-4 text-xl font-semibold">Choose your spreadsheet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Supports CSV, XLSX, or XLS files up to 20,000 rows.
            </p>

            <div className="mt-6 flex flex-col items-center justify-center gap-3">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
                <span className="inline-flex h-10 items-center justify-center rounded-md bg-signal px-6 text-sm font-medium text-signal-foreground shadow-sm hover:bg-signal/90 transition-colors">
                  Select CSV or Excel file
                </span>
              </label>

              <span className="text-xs text-muted-foreground">or test without a file</span>

              <Button
                variant="outline"
                size="sm"
                onClick={loadSampleData}
                className="gap-2 text-xs"
              >
                <Sparkles className="h-3.5 w-3.5 text-signal" /> Load sample media prospect list
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* File loaded bar */}
          <div className="flex items-center justify-between rounded-lg border bg-card p-4 shadow-card">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-6 w-6 text-signal" />
              <div>
                <div className="font-semibold text-foreground">{fileName}</div>
                <div className="text-xs text-muted-foreground">
                  {rows.length} total rows detected &bull; {headers.length} columns
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRows([]);
                setHeaders([]);
                setFileName("");
              }}
            >
              Choose different file
            </Button>
          </div>

          {/* Validation Cards */}
          <div>
            <h2 className="text-xl font-semibold mb-3">Validation Summary</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <StatCard
                label="Ready to import"
                value={readyToImport.length}
                emphasis
                hint="Clean and unique"
              />
              <StatCard
                label="Existing"
                value={classification.alreadyExists.length}
                hint="Already in leads list"
              />
              <StatCard
                label="Duplicate in file"
                value={classification.duplicateInFile.length}
                hint="Skipped automatically"
              />
              <StatCard
                label="Invalid format"
                value={classification.invalid.length}
                hint="Malformed emails"
              />
              <StatCard
                label="Suppressed"
                value={suppressedInImport.length}
                hint="Imported as unsubscribed"
              />
            </div>
          </div>

          {/* Column Mapping Table */}
          <div className="rounded-lg border bg-card shadow-card overflow-hidden">
            <div className="border-b px-5 py-3 bg-muted/30">
              <h3 className="font-semibold text-sm">Match File Columns</h3>
              <p className="text-xs text-muted-foreground">
                Match each column in your file to DECILE lead fields.
              </p>
            </div>

            <div className="divide-y">
              {headers.map((header) => {
                const current = mapping[header] ?? "ignore";
                const sampleVal = String(rows[0]?.[header] ?? "");
                return (
                  <div
                    key={header}
                    className="flex flex-col md:flex-row md:items-center justify-between p-4 gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm text-foreground">{header}</div>
                      <div className="text-xs text-muted-foreground truncate font-mono">
                        Sample: "{sampleVal || "(empty)"}"
                      </div>
                    </div>
                    <div className="w-56">
                      <Select
                        value={current}
                        onValueChange={(val: any) =>
                          setMapping((prev) => ({ ...prev, [header]: val }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {IMPORT_TARGETS.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Import Action */}
          <div className="rounded-lg border bg-card p-6 shadow-card space-y-4">
            {!emailFieldMapped && (
              <div className="flex items-center gap-2 text-destructive text-sm font-medium">
                <AlertCircle className="h-4 w-4" /> Please map at least one column as "Email".
              </div>
            )}

            {busy === "importing" && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">
                  Processing leads into storage...
                </div>
                <Progress value={progress} />
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => navigate("/leads")}>
                Cancel
              </Button>
              <Button
                variant="signal"
                onClick={handleImport}
                disabled={!emailFieldMapped || readyToImport.length === 0 || busy === "importing"}
              >
                {busy === "importing"
                  ? "Importing..."
                  : `Import ${readyToImport.length} leads`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
