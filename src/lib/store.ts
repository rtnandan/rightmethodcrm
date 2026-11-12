import { composeEmail } from "./compose";
import { type LeadLike, normalizeEmail, isValidEmail } from "./email-utils";
import { auth, db, handleFirestoreError, OperationType, logOutFirebase } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, getDocs, collection, query, where, deleteDoc } from "firebase/firestore";

export interface User {
  id: string;
  email: string;
  isFirebase?: boolean;
}

export interface AppSettings {
  owner_id: string;
  app_url: string;
  timezone: string;
  signature: string;
  first_campaign_approved_at: string | null;
}

export interface SendingAccount {
  id: string;
  email: string;
  from_name: string;
  secret_name: string;
  daily_limit: number;
  sent_today: number;
  status: "active" | "paused" | "error" | "rate_limited";
  last_error: string | null;
  last_checked_at: string;
  created_at: string;
}

export interface Lead {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  company: string;
  designation: string;
  industry: string;
  source: string;
  status:
    | "not_contacted"
    | "email_sent"
    | "delivered"
    | "replied"
    | "interested"
    | "meeting_requested"
    | "follow_up_required"
    | "not_interested"
    | "unsubscribed"
    | "bounced";
  custom_fields: Record<string, string>;
  unsubscribe_token: string;
  last_contacted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Suppression {
  id: string;
  email: string;
  reason: "unsubscribe" | "bounce" | "manual" | "complaint";
  note: string;
  created_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  subject: string;
  body: string;
  status: "draft" | "active" | "paused" | "completed";
  account_ids: string[];
  daily_limit: number;
  batch_size: number;
  approved_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignLead {
  id: string;
  campaign_id: string;
  lead_id: string;
  status: "queued" | "sending" | "sent" | "failed" | "skipped";
  sending_account_id: string | null;
  error: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface EmailMessage {
  id: string;
  lead_id: string;
  campaign_id: string | null;
  campaign_lead_id: string | null;
  step: number;
  direction: "outbound" | "inbound";
  is_test: boolean;
  sending_account_id: string | null;
  to_email: string;
  from_email: string;
  subject: string;
  body: string;
  status: "pending" | "sent" | "failed" | "bounced" | "received";
  error: string | null;
  sent_at: string;
  created_at: string;
}

const STORAGE_KEY = "decile_outreach_v1";

interface StateData {
  currentUser: User | null;
  settings: AppSettings;
  accounts: SendingAccount[];
  leads: Lead[];
  suppressions: Suppression[];
  campaigns: Campaign[];
  campaignLeads: CampaignLead[];
  messages: EmailMessage[];
}

function initialSeedData(): StateData {
  const defaultUser: User = {
    id: "user_nandan_involynk",
    email: "nandan.involynk@gmail.com",
  };

  const settings: AppSettings = {
    owner_id: defaultUser.id,
    app_url: "https://decileoutreach.lovable.app",
    timezone: "Asia/Kolkata",
    signature: "Best regards,\nNandan T\nDECILE Media | Partnerships\nnandan.involynk@gmail.com",
    first_campaign_approved_at: new Date(Date.now() - 86400000 * 4).toISOString(),
  };

  const account1: SendingAccount = {
    id: "acc_1",
    email: "nandan.involynk@gmail.com",
    from_name: "Nandan T",
    secret_name: "gmail_nandan",
    daily_limit: 250,
    sent_today: 42,
    status: "active",
    last_error: null,
    last_checked_at: new Date().toISOString(),
    created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
  };

  const account2: SendingAccount = {
    id: "acc_2",
    email: "outreach@decilemedia.com",
    from_name: "DECILE Growth Desk",
    secret_name: "gmail_desk",
    daily_limit: 150,
    sent_today: 18,
    status: "active",
    last_error: null,
    last_checked_at: new Date().toISOString(),
    created_at: new Date(Date.now() - 86400000 * 8).toISOString(),
  };

  const rawLeads = [
    { first_name: "Arjun", last_name: "Mehta", email: "arjun.m@veritasventures.in", company: "Veritas Ventures", designation: "Partner", industry: "Venture Capital", status: "interested" as const },
    { first_name: "Pooja", last_name: "Sharma", email: "pooja.sharma@kinetichq.com", company: "Kinetic Media", designation: "Head of Marketing", industry: "Digital Media", status: "meeting_requested" as const },
    { first_name: "Dev", last_name: "Natarajan", email: "dev@zenithcloud.io", company: "Zenith Cloud", designation: "VP Engineering", industry: "Cloud Infrastructure", status: "replied" as const },
    { first_name: "Rohan", last_name: "Verma", email: "rohan.v@omnicommerce.com", company: "Omni Commerce", designation: "Founder & CEO", industry: "E-Commerce", status: "follow_up_required" as const },
    { first_name: "Neha", last_name: "Kapoor", email: "neha.k@finscale.co", company: "FinScale", designation: "Chief Operating Officer", industry: "Fintech", status: "delivered" as const },
    { first_name: "Siddharth", last_name: "Rao", email: "siddharth@pulseedge.ai", company: "PulseEdge AI", designation: "Director of Partnerships", industry: "AI Software", status: "email_sent" as const },
    { first_name: "Ananya", last_name: "Iyer", email: "ananya@stratamarketing.org", company: "Strata Marketing", designation: "Growth Lead", industry: "Marketing Services", status: "not_contacted" as const },
    { first_name: "Vikram", last_name: "Singhania", email: "v.singhania@apexbrands.in", company: "Apex Brands", designation: "Managing Director", industry: "Consumer Goods", status: "not_contacted" as const },
    { first_name: "Maya", last_name: "Sengupta", email: "maya@novabio.tech", company: "Nova Biotech", designation: "VP Strategy", industry: "Biotechnology", status: "not_interested" as const },
    { first_name: "Karan", last_name: "Malhotra", email: "karan@bouncedtest-example.com", company: "Legacy Systems Inc", designation: "General Manager", industry: "Enterprise IT", status: "bounced" as const },
    { first_name: "Aditi", last_name: "Deshmukh", email: "aditi.d@heliosmobility.com", company: "Helios Mobility", designation: "Co-Founder", industry: "CleanTech", status: "unsubscribed" as const },
    { first_name: "Tarun", last_name: "Bansal", email: "tarun.b@quantahealth.in", company: "Quanta Health", designation: "Head of Growth", industry: "HealthTech", status: "not_contacted" as const },
    { first_name: "Kavita", last_name: "Pillai", email: "kavita@nexusretail.com", company: "Nexus Retail", designation: "Commercial Director", industry: "Retail", status: "delivered" as const },
    { first_name: "Sameer", last_name: "Gupta", email: "sameer@aegisanalytics.com", company: "Aegis Analytics", designation: "Chief Data Officer", industry: "Analytics", status: "not_contacted" as const },
  ];

  const leads: Lead[] = rawLeads.map((r, i) => ({
    id: `lead_${i + 1}`,
    email: r.email,
    first_name: r.first_name,
    last_name: r.last_name,
    company: r.company,
    designation: r.designation,
    industry: r.industry,
    source: i % 3 === 0 ? "manual" : "import",
    status: r.status,
    custom_fields: { portfolio_size: i > 5 ? "$10M+" : "$50M+" },
    unsubscribe_token: `token_${i + 1}_${Math.random().toString(36).slice(2, 9)}`,
    last_contacted_at:
      r.status !== "not_contacted"
        ? new Date(Date.now() - 86400000 * (1 + (i % 4))).toISOString()
        : null,
    created_at: new Date(Date.now() - 86400000 * 12).toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const suppressions: Suppression[] = [
    {
      id: "sup_1",
      email: "aditi.d@heliosmobility.com",
      reason: "unsubscribe",
      note: "Unsubscribed via opt-out reply",
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: "sup_2",
      email: "karan@bouncedtest-example.com",
      reason: "bounce",
      note: "Permanent 550 Mailbox does not exist",
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
  ];

  const campaign1: Campaign = {
    id: "camp_1",
    name: "Q4 Media & Growth Partnership Outreach",
    subject: "Quick question for {{company}}",
    body: `Hi {{first_name|there}},\n\nI came across {{company}} and noticed your work as {{designation}} in {{industry|your industry}}.\n\nAt DECILE Media, we partner with growing brands to build high-converting editorial campaigns that acquire high-intent buyers without burning ad budget.\n\nWould you be open to a quick 15-minute introductory call next Tuesday or Thursday?`,
    status: "active",
    account_ids: ["acc_1", "acc_2"],
    daily_limit: 200,
    batch_size: 5,
    approved_at: new Date(Date.now() - 86400000 * 4).toISOString(),
    started_at: new Date(Date.now() - 86400000 * 4).toISOString(),
    completed_at: null,
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    updated_at: new Date().toISOString(),
  };

  const campaign2: Campaign = {
    id: "camp_2",
    name: "FinTech & Cloud Leaders Introduction",
    subject: "Scaling editorial reach at {{company}}",
    body: `Hi {{first_name|there}},\n\nSaw the recent moves {{company}} has made in {{industry|the space}}.\n\nWe recently helped three enterprise teams scale organic authority and book 40+ qualified partner demos in under 60 days.\n\nAre you open to seeing the brief breakdown?`,
    status: "draft",
    account_ids: ["acc_1"],
    daily_limit: 100,
    batch_size: 5,
    approved_at: null,
    started_at: null,
    completed_at: null,
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    updated_at: new Date().toISOString(),
  };

  const campaignLeads: CampaignLead[] = [
    { id: "cl_1", campaign_id: "camp_1", lead_id: "lead_1", status: "sent", sending_account_id: "acc_1", error: null, sent_at: new Date(Date.now() - 86400000 * 3).toISOString(), created_at: new Date(Date.now() - 86400000 * 4).toISOString() },
    { id: "cl_2", campaign_id: "camp_1", lead_id: "lead_2", status: "sent", sending_account_id: "acc_2", error: null, sent_at: new Date(Date.now() - 86400000 * 3).toISOString(), created_at: new Date(Date.now() - 86400000 * 4).toISOString() },
    { id: "cl_3", campaign_id: "camp_1", lead_id: "lead_3", status: "sent", sending_account_id: "acc_1", error: null, sent_at: new Date(Date.now() - 86400000 * 2).toISOString(), created_at: new Date(Date.now() - 86400000 * 4).toISOString() },
    { id: "cl_4", campaign_id: "camp_1", lead_id: "lead_4", status: "sent", sending_account_id: "acc_2", error: null, sent_at: new Date(Date.now() - 86400000 * 2).toISOString(), created_at: new Date(Date.now() - 86400000 * 4).toISOString() },
    { id: "cl_5", campaign_id: "camp_1", lead_id: "lead_5", status: "sent", sending_account_id: "acc_1", error: null, sent_at: new Date(Date.now() - 86400000 * 1).toISOString(), created_at: new Date(Date.now() - 86400000 * 4).toISOString() },
    { id: "cl_6", campaign_id: "camp_1", lead_id: "lead_6", status: "sent", sending_account_id: "acc_2", error: null, sent_at: new Date(Date.now() - 86400000 * 1).toISOString(), created_at: new Date(Date.now() - 86400000 * 4).toISOString() },
    { id: "cl_7", campaign_id: "camp_1", lead_id: "lead_7", status: "queued", sending_account_id: null, error: null, sent_at: null, created_at: new Date(Date.now() - 86400000 * 4).toISOString() },
    { id: "cl_8", campaign_id: "camp_1", lead_id: "lead_8", status: "queued", sending_account_id: null, error: null, sent_at: null, created_at: new Date(Date.now() - 86400000 * 4).toISOString() },
    { id: "cl_9", campaign_id: "camp_1", lead_id: "lead_12", status: "queued", sending_account_id: null, error: null, sent_at: null, created_at: new Date(Date.now() - 86400000 * 4).toISOString() },
    { id: "cl_10", campaign_id: "camp_1", lead_id: "lead_13", status: "sent", sending_account_id: "acc_1", error: null, sent_at: new Date(Date.now() - 3600000 * 5).toISOString(), created_at: new Date(Date.now() - 86400000 * 4).toISOString() },
    { id: "cl_11", campaign_id: "camp_1", lead_id: "lead_14", status: "queued", sending_account_id: null, error: null, sent_at: null, created_at: new Date(Date.now() - 86400000 * 4).toISOString() },
    { id: "cl_12", campaign_id: "camp_1", lead_id: "lead_10", status: "failed", sending_account_id: "acc_1", error: "550 Mailbox does not exist", sent_at: null, created_at: new Date(Date.now() - 86400000 * 4).toISOString() },
    { id: "cl_13", campaign_id: "camp_1", lead_id: "lead_11", status: "skipped", sending_account_id: null, error: "On suppression list", sent_at: null, created_at: new Date(Date.now() - 86400000 * 4).toISOString() },
  ];

  const messages: EmailMessage[] = [
    {
      id: "msg_1",
      lead_id: "lead_1",
      campaign_id: "camp_1",
      campaign_lead_id: "cl_1",
      step: 0,
      direction: "outbound",
      is_test: false,
      sending_account_id: "acc_1",
      to_email: "arjun.m@veritasventures.in",
      from_email: "nandan.involynk@gmail.com",
      subject: "Quick question for Veritas Ventures",
      body: `Hi Arjun,\n\nI came across Veritas Ventures and noticed your work as Partner in Venture Capital.\n\nAt DECILE Media, we partner with growing brands to build high-converting editorial campaigns that acquire high-intent buyers without burning ad budget.\n\nWould you be open to a quick 15-minute introductory call next Tuesday or Thursday?\n\nBest regards,\nNandan T\nDECILE Media | Partnerships\nnandan.involynk@gmail.com\n\nP.S. If this isn't relevant, just reply "unsubscribe" and I won't email you again.`,
      status: "sent",
      error: null,
      sent_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
    {
      id: "msg_2",
      lead_id: "lead_2",
      campaign_id: "camp_1",
      campaign_lead_id: "cl_2",
      step: 0,
      direction: "outbound",
      is_test: false,
      sending_account_id: "acc_2",
      to_email: "pooja.sharma@kinetichq.com",
      from_email: "outreach@decilemedia.com",
      subject: "Quick question for Kinetic Media",
      body: `Hi Pooja,\n\nI came across Kinetic Media and noticed your work as Head of Marketing in Digital Media.\n\nAt DECILE Media, we partner with growing brands to build high-converting editorial campaigns that acquire high-intent buyers without burning ad budget.\n\nWould you be open to a quick 15-minute introductory call next Tuesday or Thursday?`,
      status: "sent",
      error: null,
      sent_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
    {
      id: "msg_3",
      lead_id: "lead_1",
      campaign_id: null,
      campaign_lead_id: null,
      step: 1,
      direction: "inbound",
      is_test: false,
      sending_account_id: null,
      to_email: "nandan.involynk@gmail.com",
      from_email: "arjun.m@veritasventures.in",
      subject: "Re: Quick question for Veritas Ventures",
      body: "Sounds interesting Nandan. Let's do Thursday 4pm IST. Send over a calendar invite.",
      status: "received",
      error: null,
      sent_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: "msg_4",
      lead_id: "lead_10",
      campaign_id: "camp_1",
      campaign_lead_id: "cl_12",
      step: 0,
      direction: "outbound",
      is_test: false,
      sending_account_id: "acc_1",
      to_email: "karan@bouncedtest-example.com",
      from_email: "nandan.involynk@gmail.com",
      subject: "Quick question for Legacy Systems Inc",
      body: "Hi Karan...",
      status: "bounced",
      error: "550 Mailbox not found",
      sent_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
  ];

  return {
    currentUser: defaultUser,
    settings,
    accounts: [account1, account2],
    leads,
    suppressions,
    campaigns: [campaign1, campaign2],
    campaignLeads,
    messages,
  };
}

class Store {
  private data: StateData;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.data = this.load();
    this.initFirebaseAuth();
  }

  private initFirebaseAuth() {
    try {
      onAuthStateChanged(auth, async (fbUser) => {
        if (fbUser) {
          const user: User = {
            id: fbUser.uid,
            email: fbUser.email || "user@example.com",
            isFirebase: true,
          };
          this.data.currentUser = user;
          this.save();
          try {
            const userDocRef = doc(db, "users", fbUser.uid);
            await setDoc(
              userDocRef,
              {
                id: fbUser.uid,
                email: fbUser.email || "",
                displayName: fbUser.displayName || "",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              { merge: true },
            );
          } catch (e) {
            handleFirestoreError(e, OperationType.WRITE, `users/${fbUser.uid}`);
          }
        }
      });
    } catch (e) {
      console.warn("Firebase Auth listener initialization error", e);
    }
  }

  private load(): StateData {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.leads)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Failed to load store, initializing seed data", e);
    }
    const seed = initialSeedData();
    this.save(seed);
    return seed;
  }

  private save(d: StateData = this.data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
    } catch (e) {
      console.error("Failed to save state", e);
    }
    this.notify();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const l of this.listeners) l();
  }

  // --- Auth ---
  public getCurrentUser(): User | null {
    return this.data.currentUser;
  }

  public signIn(email: string): User {
    const user: User = {
      id: `user_${normalizeEmail(email).replace(/[^a-z0-9]/g, "_")}`,
      email: normalizeEmail(email),
    };
    this.data.currentUser = user;
    this.save();
    return user;
  }

  public async signOut() {
    this.data.currentUser = null;
    this.save();
    try {
      await logOutFirebase();
    } catch (e) {
      console.warn("Firebase signout error", e);
    }
  }

  // --- Settings ---
  public getSettings(): AppSettings {
    return this.data.settings;
  }

  public updateSettings(updates: Partial<AppSettings>) {
    this.data.settings = { ...this.data.settings, ...updates };
    this.save();
  }

  // --- Sending Accounts ---
  public getAccounts(): SendingAccount[] {
    return this.data.accounts;
  }

  public addAccount(account: Omit<SendingAccount, "id" | "created_at" | "sent_today">) {
    const newAcc: SendingAccount = {
      ...account,
      id: `acc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      sent_today: 0,
      created_at: new Date().toISOString(),
    };
    this.data.accounts.push(newAcc);
    this.save();
    return newAcc;
  }

  public updateAccount(id: string, updates: Partial<SendingAccount>) {
    this.data.accounts = this.data.accounts.map((a) => (a.id === id ? { ...a, ...updates } : a));
    this.save();
  }

  public deleteAccount(id: string) {
    this.data.accounts = this.data.accounts.filter((a) => a.id !== id);
    this.save();
  }

  // --- Leads ---
  public getLeads(params?: {
    q?: string;
    status?: string;
    sort?: "newest" | "oldest" | "name" | "company" | "last_contacted";
  }) {
    let list = [...this.data.leads];

    if (params?.status) {
      list = list.filter((l) => l.status === params.status);
    }

    if (params?.q?.trim()) {
      const q = params.q.trim().toLowerCase();
      list = list.filter(
        (l) =>
          l.email.toLowerCase().includes(q) ||
          l.first_name.toLowerCase().includes(q) ||
          l.last_name.toLowerCase().includes(q) ||
          l.company.toLowerCase().includes(q) ||
          l.designation.toLowerCase().includes(q) ||
          l.industry.toLowerCase().includes(q),
      );
    }

    switch (params?.sort) {
      case "oldest":
        list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case "name":
        list.sort((a, b) =>
          `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`),
        );
        break;
      case "company":
        list.sort((a, b) => a.company.localeCompare(b.company));
        break;
      case "last_contacted":
        list.sort((a, b) => {
          if (!a.last_contacted_at) return 1;
          if (!b.last_contacted_at) return -1;
          return new Date(b.last_contacted_at).getTime() - new Date(a.last_contacted_at).getTime();
        });
        break;
      case "newest":
      default:
        list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }

    return list;
  }

  public getLeadById(id: string) {
    return this.data.leads.find((l) => l.id === id);
  }

  public addLead(lead: Omit<Lead, "id" | "created_at" | "updated_at" | "unsubscribe_token">) {
    const email = normalizeEmail(lead.email);
    const existing = this.data.leads.find((l) => l.email === email);
    if (existing) {
      throw new Error("A lead with this email already exists");
    }

    const isSuppressed = this.data.suppressions.some((s) => s.email === email);
    const newLead: Lead = {
      ...lead,
      email,
      id: `lead_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      status: isSuppressed ? "unsubscribed" : (lead.status || "not_contacted"),
      unsubscribe_token: `token_${Math.random().toString(36).slice(2, 12)}`,
      last_contacted_at: lead.last_contacted_at ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.data.leads.unshift(newLead);
    this.save();
    return newLead;
  }

  public addLeadsBatch(leadsToAdd: Omit<Lead, "id" | "created_at" | "updated_at" | "unsubscribe_token">[]) {
    const existingEmails = new Set(this.data.leads.map((l) => l.email));
    const suppressedEmails = new Set(this.data.suppressions.map((s) => s.email));
    const added: Lead[] = [];

    for (const item of leadsToAdd) {
      const email = normalizeEmail(item.email);
      if (!isValidEmail(email) || existingEmails.has(email)) continue;
      existingEmails.add(email);

      const isSuppressed = suppressedEmails.has(email);
      const newLead: Lead = {
        ...item,
        email,
        id: `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        status: isSuppressed ? "unsubscribed" : (item.status || "not_contacted"),
        unsubscribe_token: `token_${Math.random().toString(36).slice(2, 12)}`,
        last_contacted_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      added.push(newLead);
    }

    this.data.leads.unshift(...added);
    this.save();
    return added.length;
  }

  public updateLead(id: string, updates: Partial<Lead>) {
    this.data.leads = this.data.leads.map((l) =>
      l.id === id ? { ...l, ...updates, updated_at: new Date().toISOString() } : l,
    );
    this.save();
  }

  public deleteLeads(ids: string[]) {
    const set = new Set(ids);
    this.data.leads = this.data.leads.filter((l) => !set.has(l.id));
    this.data.campaignLeads = this.data.campaignLeads.filter((cl) => !set.has(cl.lead_id));
    this.data.messages = this.data.messages.filter((m) => !set.has(m.lead_id));
    this.save();
  }

  // --- Suppressions ---
  public getSuppressions() {
    return this.data.suppressions;
  }

  public addSuppressions(emails: string[], reason: Suppression["reason"] = "manual") {
    let addedCount = 0;
    const existing = new Set(this.data.suppressions.map((s) => s.email));
    const toSuppress = new Set<string>();

    for (const raw of emails) {
      const email = normalizeEmail(raw);
      if (isValidEmail(email) && !existing.has(email)) {
        existing.add(email);
        toSuppress.add(email);
        this.data.suppressions.unshift({
          id: `sup_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          email,
          reason,
          note: reason === "manual" ? "Manually added to suppression list" : "Automatic compliance",
          created_at: new Date().toISOString(),
        });
        addedCount++;
      }
    }

    if (toSuppress.size > 0) {
      // Mark matching leads as unsubscribed
      this.data.leads = this.data.leads.map((l) =>
        toSuppress.has(l.email) ? { ...l, status: "unsubscribed" } : l,
      );
      // Mark queued campaign leads as skipped
      const affectedLeadIds = new Set(
        this.data.leads.filter((l) => toSuppress.has(l.email)).map((l) => l.id),
      );
      this.data.campaignLeads = this.data.campaignLeads.map((cl) =>
        affectedLeadIds.has(cl.lead_id) && cl.status === "queued"
          ? { ...cl, status: "skipped", error: "On suppression list" }
          : cl,
      );
    }

    this.save();
    return addedCount;
  }

  public removeSuppression(id: string) {
    this.data.suppressions = this.data.suppressions.filter((s) => s.id !== id);
    this.save();
  }

  public handleUnsubscribeByToken(token: string) {
    const lead = this.data.leads.find((l) => l.unsubscribe_token === token);
    if (!lead) return false;
    this.addSuppressions([lead.email], "unsubscribe");
    return true;
  }

  // --- Campaigns ---
  public getCampaigns() {
    return this.data.campaigns.map((c) => {
      const leadsForCamp = this.data.campaignLeads.filter((cl) => cl.campaign_id === c.id);
      const stats = {
        total: leadsForCamp.length,
        queued: leadsForCamp.filter((cl) => cl.status === "queued").length,
        sending: leadsForCamp.filter((cl) => cl.status === "sending").length,
        sent: leadsForCamp.filter((cl) => cl.status === "sent").length,
        failed: leadsForCamp.filter((cl) => cl.status === "failed").length,
        skipped: leadsForCamp.filter((cl) => cl.status === "skipped").length,
      };
      return { ...c, stats };
    });
  }

  public getCampaignById(id: string) {
    const campaigns = this.getCampaigns();
    return campaigns.find((c) => c.id === id);
  }

  public createCampaign(data: {
    name: string;
    subject: string;
    body: string;
    account_ids: string[];
  }) {
    const newCamp: Campaign = {
      id: `camp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: data.name,
      subject: data.subject,
      body: data.body,
      status: "draft",
      account_ids: data.account_ids,
      daily_limit: 250,
      batch_size: 5,
      approved_at: null,
      started_at: null,
      completed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.data.campaigns.unshift(newCamp);
    this.save();
    return newCamp;
  }

  public updateCampaign(id: string, updates: Partial<Campaign>) {
    this.data.campaigns = this.data.campaigns.map((c) =>
      c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c,
    );
    this.save();
  }

  public deleteCampaign(id: string) {
    this.data.campaigns = this.data.campaigns.filter((c) => c.id !== id);
    this.data.campaignLeads = this.data.campaignLeads.filter((cl) => cl.campaign_id !== id);
    this.data.messages = this.data.messages.filter((m) => m.campaign_id !== id);
    this.save();
  }

  public enrollLeadsToCampaign(opts: {
    campaignId: string;
    leadIds: string[];
    skipContacted: boolean;
  }) {
    const existing = new Set(
      this.data.campaignLeads
        .filter((cl) => cl.campaign_id === opts.campaignId)
        .map((cl) => cl.lead_id),
    );
    const suppressed = new Set(this.data.suppressions.map((s) => s.email));

    let added = 0;
    for (const leadId of opts.leadIds) {
      if (existing.has(leadId)) continue;
      const lead = this.data.leads.find((l) => l.id === leadId);
      if (!lead) continue;
      if (suppressed.has(lead.email) || lead.status === "unsubscribed" || lead.status === "bounced")
        continue;
      if (opts.skipContacted && lead.status !== "not_contacted") continue;

      existing.add(leadId);
      this.data.campaignLeads.push({
        id: `cl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        campaign_id: opts.campaignId,
        lead_id: leadId,
        status: "queued",
        sending_account_id: null,
        error: null,
        sent_at: null,
        created_at: new Date().toISOString(),
      });
      added++;
    }

    this.save();
    return added;
  }

  public removeQueuedRecipient(campaignLeadId: string) {
    this.data.campaignLeads = this.data.campaignLeads.filter((cl) => cl.id !== campaignLeadId);
    this.save();
  }

  public getCampaignRecipients(campaignId: string, filterStatus?: string) {
    let list = this.data.campaignLeads.filter((cl) => cl.campaign_id === campaignId);
    if (filterStatus && filterStatus !== "all") {
      list = list.filter((cl) => cl.status === filterStatus);
    }
    return list.map((cl) => {
      const lead = this.data.leads.find((l) => l.id === cl.lead_id);
      return {
        ...cl,
        leads: lead || null,
      };
    });
  }

  // --- Batch Sender Engine ---
  public sendBatchNow(campaignId: string, count: number = 5) {
    const campaign = this.data.campaigns.find((c) => c.id === campaignId);
    if (!campaign) throw new Error("Campaign not found");

    const queuedRecipients = this.data.campaignLeads.filter(
      (cl) => cl.campaign_id === campaignId && cl.status === "queued",
    );
    if (queuedRecipients.length === 0) {
      return { sent: 0, message: "No queued recipients remaining in this campaign" };
    }

    const availableAccounts = this.data.accounts.filter(
      (a) => a.status === "active" && campaign.account_ids.includes(a.id),
    );
    if (availableAccounts.length === 0) {
      throw new Error("No active sending accounts selected for this campaign");
    }

    const batch = queuedRecipients.slice(0, count);
    let sentCount = 0;

    for (let i = 0; i < batch.length; i++) {
      const cl = batch[i];
      const lead = this.data.leads.find((l) => l.id === cl.lead_id);
      if (!lead) continue;

      // Select account round-robin
      const account = availableAccounts[i % availableAccounts.length];

      const { subject, body } = composeEmail({
        subject: campaign.subject,
        body: campaign.body,
        signature: this.data.settings.signature,
        lead,
        optOut: true,
      });

      const now = new Date().toISOString();

      // Update campaign lead
      cl.status = "sent";
      cl.sending_account_id = account.id;
      cl.sent_at = now;

      // Update lead
      lead.status = "delivered";
      lead.last_contacted_at = now;
      lead.updated_at = now;

      // Create message log
      this.data.messages.unshift({
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        lead_id: lead.id,
        campaign_id: campaign.id,
        campaign_lead_id: cl.id,
        step: 0,
        direction: "outbound",
        is_test: false,
        sending_account_id: account.id,
        to_email: lead.email,
        from_email: account.email,
        subject,
        body,
        status: "sent",
        error: null,
        sent_at: now,
        created_at: now,
      });

      account.sent_today += 1;
      sentCount++;
    }

    // Check if campaign completed
    const remainingQueued = this.data.campaignLeads.filter(
      (cl) => cl.campaign_id === campaignId && cl.status === "queued",
    ).length;
    if (remainingQueued === 0) {
      campaign.status = "completed";
      campaign.completed_at = new Date().toISOString();
    }

    this.save();
    return { sent: sentCount, remaining: remainingQueued };
  }

  public sendTestEmail(params: {
    campaignId: string;
    accountId: string;
    to: string;
    leadId?: string | null;
  }) {
    const campaign = this.data.campaigns.find((c) => c.id === params.campaignId);
    const account = this.data.accounts.find((a) => a.id === params.accountId);
    if (!campaign) throw new Error("Campaign not found");
    if (!account) throw new Error("Sending account not found");

    let sampleLead: LeadLike = {
      first_name: "Sample",
      last_name: "Lead",
      company: "Sample Enterprises",
      designation: "Marketing Director",
      industry: "Media & Tech",
      email: params.to,
    };

    if (params.leadId) {
      const realLead = this.data.leads.find((l) => l.id === params.leadId);
      if (realLead) sampleLead = realLead;
    }

    const { subject, body } = composeEmail({
      subject: campaign.subject,
      body: campaign.body,
      signature: this.data.settings.signature,
      lead: sampleLead,
      optOut: true,
    });

    const now = new Date().toISOString();
    this.data.messages.unshift({
      id: `msg_${Date.now()}_test`,
      lead_id: params.leadId || "lead_test",
      campaign_id: campaign.id,
      campaign_lead_id: null,
      step: 0,
      direction: "outbound",
      is_test: true,
      sending_account_id: account.id,
      to_email: params.to,
      from_email: account.email,
      subject: `[TEST] ${subject}`,
      body,
      status: "sent",
      error: null,
      sent_at: now,
      created_at: now,
    });

    this.save();
    return { ok: true };
  }

  // --- Lead & Messages History ---
  public getLeadDetails(id: string) {
    const lead = this.data.leads.find((l) => l.id === id);
    if (!lead) return null;
    const messages = this.data.messages.filter((m) => m.lead_id === id);
    const enrolments = this.data.campaignLeads
      .filter((cl) => cl.lead_id === id)
      .map((cl) => {
        const camp = this.data.campaigns.find((c) => c.id === cl.campaign_id);
        return {
          ...cl,
          campaigns: camp ? { id: camp.id, name: camp.name, status: camp.status } : null,
        };
      });
    return { lead, messages, enrolments };
  }

  public getRecentActivity(limit = 8) {
    return this.data.messages.slice(0, limit);
  }

  // --- Dashboard Stats ---
  public getDashboardStats() {
    const total_leads = this.data.leads.length;
    const emails_sent = this.data.messages.filter(
      (m) => m.direction === "outbound" && !m.is_test && m.status === "sent",
    ).length;
    const bounced = this.data.leads.filter((l) => l.status === "bounced").length;
    const replies = this.data.leads.filter((l) =>
      ["replied", "interested", "meeting_requested", "follow_up_required", "not_interested"].includes(
        l.status,
      ),
    ).length;
    const interested = this.data.leads.filter((l) => l.status === "interested").length;
    const meetings = this.data.leads.filter((l) => l.status === "meeting_requested").length;
    const pending_follow_ups = this.data.leads.filter(
      (l) => l.status === "follow_up_required",
    ).length;
    const queued = this.data.campaignLeads.filter(
      (cl) => cl.status === "queued",
    ).length;

    const by_status: Record<string, number> = {};
    for (const l of this.data.leads) {
      by_status[l.status] = (by_status[l.status] || 0) + 1;
    }

    return {
      total_leads,
      emails_sent,
      bounced,
      replies,
      interested,
      meetings,
      pending_follow_ups,
      queued,
      by_status,
    };
  }
}

export const store = new Store();
