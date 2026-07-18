import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import clsx from "clsx";
import { CommandCenter } from "./pages/CommandCenter";
import { InvestigationWorkspace } from "./pages/InvestigationWorkspace";
import { PartnerVault } from "./pages/PartnerVault";
import { ConsumerCheck } from "./pages/ConsumerCheck";
import { DemoLabels } from "./labels/DemoLabels";
import { GlobeStage } from "./components/globe/GlobeStage";
import { WidgetDrawer } from "./components/WidgetDrawer";
import { useTheme } from "./lib/theme";

const NAV = [
  { to: "/", label: "Command", icon: GlobeIcon, end: true },
  { to: "/investigation", label: "Investigate", icon: NodesIcon },
  { to: "/vault", label: "Vault", icon: VaultIcon },
  { to: "/consumer", label: "Scan", icon: ScanIcon },
  { to: "/labels", label: "Labels", icon: TagIcon },
];

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden>
        <rect width="32" height="32" rx="9" fill="url(#lg)" />
        <circle cx="15" cy="15" r="7.5" stroke="#7ff0c1" strokeWidth="2" />
        <circle cx="15" cy="15" r="2.6" fill="#ffb545" />
        <path d="M20.5 20.5l4.5 4.5" stroke="#f4f7ff" strokeWidth="2.4" strokeLinecap="round" />
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="32" y2="32">
            <stop stopColor="#161e3a" />
            <stop offset="1" stopColor="#0d1220" />
          </linearGradient>
        </defs>
      </svg>
      <div className="leading-tight">
        <div className="display text-[15px] font-extrabold text-hi">RecallLens</div>
        <div className="text-[10px] font-medium text-lo">Find the source, not the secrets.</div>
      </div>
    </div>
  );
}

function PillNav() {
  const { theme, toggle } = useTheme();
  return (
    <header className="pointer-events-none fixed inset-x-0 top-4 z-30 flex justify-center px-3">
      <div className="glass glass-strong pill pointer-events-auto flex items-center gap-1 px-2 py-2 shadow-2xl">
        <div className="hidden pl-2 pr-3 sm:block">
          <Brand />
        </div>
        <nav className="flex items-center gap-0.5">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              title={n.label}
              className={({ isActive }) =>
                clsx(
                  "pill flex items-center gap-1.5 px-3 py-2 text-[13px] font-semibold transition-all",
                  isActive
                    ? "bg-[color-mix(in_oklab,var(--accent)_20%,transparent)] text-accent"
                    : "text-mid hover:text-hi hover:bg-white/5",
                )
              }
            >
              <n.icon />
              <span className="hidden md:inline">{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <button
          onClick={toggle}
          title={theme === "dark" ? "Switch to light" : "Switch to dark"}
          aria-label="Toggle theme"
          className="pill ml-0.5 flex h-9 w-9 items-center justify-center text-mid transition-colors hover:bg-white/5 hover:text-hi"
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>
    </header>
  );
}

export function App() {
  const loc = useLocation();
  // The Command page IS the cockpit: massive centered globe with floating glass
  // panels + the widget drawer, no scroll. Other pages are scrollable glass
  // content over the same globe backdrop.
  const isCommand = loc.pathname === "/";
  return (
    <div className="relative min-h-screen">
      <div className="app-aurora" />
      <GlobeStage />
      <PillNav />
      <WidgetDrawer />

      {isCommand ? (
        <Routes>
          <Route path="/" element={<CommandCenter />} />
        </Routes>
      ) : (
        <main className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-16 pt-24 sm:px-6">
          <Routes>
            <Route path="/investigation" element={<InvestigationWorkspace />} />
            <Route path="/vault" element={<PartnerVault />} />
            <Route path="/consumer" element={<ConsumerCheck />} />
            <Route path="/labels" element={<DemoLabels />} />
          </Routes>
          <footer className="mx-auto mt-10 max-w-3xl text-center text-[11px] leading-relaxed text-lo">
            RecallLens does not diagnose pathogens and does not replace
            epidemiologists, laboratory testing, FDA, or CDC investigations. It is
            a privacy-preserving coordination and traceback layer. Private partner
            and consumer records are synthetic and never written to the public
            ledger.
          </footer>
        </main>
      )}
    </div>
  );
}

/* ── inline rounded icons (stroke, currentColor) ───────────────────────────── */
type I = { className?: string };
function GlobeIcon(_: I) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
    </svg>
  );
}
function NodesIcon(_: I) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="5" cy="6" r="2.2" /><circle cx="5" cy="18" r="2.2" /><circle cx="19" cy="12" r="2.2" />
      <path d="M7 6.8 17 11M7 17.2 17 13" />
    </svg>
  );
}
function VaultIcon(_: I) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><circle cx="12" cy="12" r="3" /><path d="M12 4.5v3M12 16.5v3" />
    </svg>
  );
}
function ScanIcon(_: I) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M7 12h10" />
    </svg>
  );
}
function TagIcon(_: I) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 11V5a1 1 0 0 1 1-1h6l8 8-7 7-8-8Z" /><circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}
function SunIcon(_: I) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </svg>
  );
}
function MoonIcon(_: I) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M20 14.5A8 8 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z" />
    </svg>
  );
}
