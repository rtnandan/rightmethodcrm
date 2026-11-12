import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  LogOut,
  Mail,
  Send,
  ShieldOff,
  Users,
  Menu,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { store } from "@/lib/store";
import { Wordmark } from "./LandingPage";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/leads", label: "Leads", icon: Users },
  { to: "/campaigns", label: "Campaigns", icon: Send },
  { to: "/accounts", label: "Sending accounts", icon: Mail },
  { to: "/suppression", label: "Suppression list", icon: ShieldOff },
] as const;

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(store.getCurrentUser());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setUser(store.getCurrentUser());
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) {
      navigate("/auth", { replace: true });
    }
  }, [user, navigate]);

  function signOut() {
    store.signOut();
    toast.info("Signed out");
    navigate("/auth", { replace: true });
  }

  if (!user) return null;

  return (
    <div className="min-h-screen md:grid md:grid-cols-[232px_1fr]">
      {/* Sidebar */}
      <aside className="sticky top-0 z-30 flex flex-col bg-sidebar text-sidebar-foreground md:h-screen">
        <div className="flex items-center justify-between px-5 py-4 md:py-6">
          <Link to="/dashboard" className="text-sidebar-accent-foreground">
            <Wordmark />
          </Link>
          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1 text-sidebar-foreground hover:text-white"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <button
              onClick={signOut}
              className="p-1 text-sidebar-foreground/70 hover:text-sidebar-accent-foreground"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav
          className={cn(
            "flex flex-col gap-1 px-3 pb-3 md:flex md:pb-0",
            mobileMenuOpen ? "flex" : "hidden md:flex",
          )}
        >
          {NAV.map((item) => {
            const active =
              location.pathname === item.to ||
              (item.to !== "/dashboard" && location.pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex shrink-0 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon className={cn("h-4 w-4", active && "text-sidebar-primary")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="mt-auto hidden border-t border-sidebar-border px-5 py-4 md:block">
          <div className="truncate text-xs font-mono text-sidebar-foreground/60">{user.email}</div>
          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-signal font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-signal animate-pulse"></span>
            Firebase Auth &amp; Firestore
          </div>
          <button
            onClick={signOut}
            className="mt-2.5 flex items-center gap-2 text-sm text-sidebar-foreground/80 hover:text-sidebar-accent-foreground cursor-pointer transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="min-w-0 px-5 py-8 md:px-10 md:py-10 bg-background text-foreground">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
