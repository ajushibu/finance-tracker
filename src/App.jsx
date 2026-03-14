import { useState, useEffect, useRef } from "react";

// ─── Constants ──────────────────────────────────────────────
const CATS = [
  { id: "food", label: "Food & Dining", color: "#B8956E" },
  { id: "transport", label: "Transport", color: "#7A8D9C" },
  { id: "shopping", label: "Shopping", color: "#A07A62" },
  { id: "bills", label: "Bills & Utilities", color: "#8585A0" },
  { id: "health", label: "Health", color: "#7A9E78" },
  { id: "entertainment", label: "Entertainment", color: "#AD7D64" },
  { id: "education", label: "Education", color: "#6889A2" },
  { id: "other", label: "Other", color: "#8A8A8A" },
];
const CAT_IDS = CATS.map(c => c.id);
const MO = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MO_S = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmt = n => "\u20b9" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pctCh = (c, p) => p === 0 ? (c > 0 ? 100 : 0) : Math.round(((c - p) / p) * 100);

const INIT = { expenses: [], budgets: CATS.reduce((a, c) => ({ ...a, [c.id]: 0 }), {}), savingsGoals: [], salary: 0, savingsTarget: 0, pins: [], dark: false };
const SK = "fin-v6";
function ld() { try { const r = localStorage.getItem(SK); return r ? JSON.parse(r) : null; } catch { return null; } }
function sv(d) { try { localStorage.setItem(SK, JSON.stringify(d)); } catch {} }

// ─── Themes ─────────────────────────────────────────────────
const light = {
  bg: "#F2F0EB", bg2: "#EAE7E1", surface: "#FAFAF7", border: "#DDD9D0", borderLight: "#E8E5DD",
  text: "#2C2417", t2: "#6B6358", t3: "#9B9588", accent: "#A67C52", accentSoft: "#A67C5215", accentMed: "#A67C5228",
  danger: "#B54A4A", dangerSoft: "#B54A4A10", success: "#5A8A52", successSoft: "#5A8A5210", warn: "#A68A3E",
  modalOverlay: "rgba(44,36,23,0.45)", shadow: "rgba(44,36,23,0.08)", grainOpacity: 0.03,
};
const dark = {
  bg: "#111110", bg2: "#17161A", surface: "#1E1D22", border: "#2E2D34", borderLight: "#252428",
  text: "#E6E2DA", t2: "#9E9A90", t3: "#6A665E", accent: "#D4A66A", accentSoft: "#D4A66A12", accentMed: "#D4A66A25",
  danger: "#D46B6B", dangerSoft: "#D46B6B12", success: "#6BAA62", successSoft: "#6BAA6215", warn: "#C49A4E",
  modalOverlay: "rgba(0,0,0,0.65)", shadow: "rgba(0,0,0,0.3)", grainOpacity: 0.04,
};
const remCol = (p, dk) => {
  if (p > 50) return dk ? "#6BAA62" : "#5A8A52";
  if (p > 25) return dk ? "#8BC084" : "#7EA17B";
  if (p > 10) return dk ? "#C49A4E" : "#A68A3E";
  if (p > 0) return dk ? "#D46B6B" : "#B54A4A";
  return dk ? "#B03030" : "#8B2020";
};

function getApiKey() { return localStorage.getItem("fin-api-key") || ""; }

// ─── AI ─────────────────────────────────────────────────────
async function aiParse(text) {
  const key = getApiKey(); if (!key) return { expenses: [], error: "Add your Anthropic API key in Setup to enable AI features." };
  try {
    const today = new Date().toISOString().slice(0, 10);
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000,
        system: `Expense parser. India, INR. Today: ${today}. Return ONLY JSON: {"expenses":[{"amount":number,"category":"id","note":"short","date":"YYYY-MM-DD"}]}. Categories: food,transport,shopping,bills,health,entertainment,education,other. Default today. If can't parse: {"expenses":[],"error":"msg"}`,
        messages: [{ role: "user", content: text }] }) });
    const d = await r.json();
    return JSON.parse(d.content.map(c => c.text || "").join("").replace(/```json|```/g, "").trim());
  } catch { return { expenses: [], error: "Couldn't parse. Try: 'coffee 150'" }; }
}
async function aiInsight(expenses, budgets, salary, st) {
  const key = getApiKey(); if (!key) return { insights: ["Add your Anthropic API key in Setup to enable AI insights."] };
  try {
    const now = new Date(), m = now.getMonth(), y = now.getFullYear();
    const me = expenses.filter(e => { const d = new Date(e.date); return d.getMonth() === m && d.getFullYear() === y; });
    if (me.length < 2) return { insights: ["Add more expenses to unlock insights."] };
    const cs = {}; me.forEach(e => { cs[e.category] = (cs[e.category] || 0) + e.amount; });
    const sb = salary > 0 && st > 0 ? salary - st : Object.values(budgets).reduce((s, v) => s + v, 0);
    const info = JSON.stringify({ spent: me.reduce((s, e) => s + e.amount, 0), budget: sb || "unset", salary: salary || "unset", savTarget: st || "unset", day: now.getDate(), daysInMonth: new Date(y, m+1, 0).getDate(), cats: cs, recent: me.slice(0, 8).map(e => ({ a: e.amount, c: e.category, n: e.note })) });
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000,
        system: `Concise financial advisor, India. ONLY JSON: {"insights":["...",...]}.  3-4 insights, 1-2 sentences. Specific numbers. Focus: velocity, budget, outliers, daily allowance.`,
        messages: [{ role: "user", content: info }] }) });
    const d = await r.json();
    return JSON.parse(d.content.map(c => c.text || "").join("").replace(/```json|```/g, "").trim());
  } catch { return { insights: ["Unable to generate insights."] }; }
}

// ─── Film Grain CSS ─────────────────────────────────────────
const grainStyle = (opacity) => ({
  position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9998, opacity,
  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
  backgroundRepeat: "repeat", backgroundSize: "180px 180px",
});

// ─── Ring ───────────────────────────────────────────────────
function Ring({ pct, size = 64, stroke = 3.5, color, V }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (<svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
    <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={V.borderLight} strokeWidth={stroke} />
    <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color || V.accent} strokeWidth={stroke}
      strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(pct, 100) / 100)} strokeLinecap="round"
      style={{ transition: "stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)" }} />
  </svg>);
}

// ─── Modal ──────────────────────────────────────────────────
function Modal({ open, onClose, title, V, children }) {
  if (!open) return null;
  return (<div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: V.modalOverlay, WebkitBackdropFilter: "blur(16px)", backdropFilter: "blur(16px)", animation: "fi .2s" }}>
    <div onClick={e => e.stopPropagation()} style={{ background: V.surface, borderRadius: 20, padding: "32px 32px 24px", width: "min(440px, 90vw)", maxHeight: "82vh", overflowY: "auto", boxShadow: `0 32px 80px ${V.shadow}`, border: "1px solid " + V.border, animation: "mi .35s cubic-bezier(.2,.8,.25,1)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h3 style={{ margin: 0, fontFamily: "var(--fd)", fontSize: 24, fontWeight: 400, color: V.text }}>{title}</h3>
        <button onClick={onClose} style={{ background: "none", border: "1px solid " + V.border, outline: "none", fontFamily: "var(--fb)", width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: V.t3, fontSize: 15 }}>×</button>
      </div>
      {children}
    </div>
  </div>);
}

function Dots({ color }) {
  return (<span style={{ display: "inline-flex", gap: 3 }}>
    {[0,1,2].map(i => <span key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: color, animation: `dp .8s ease ${i*.12}s infinite alternate` }} />)}
  </span>);
}

// ─── Stagger Helper ─────────────────────────────────────────
const stagger = (i) => ({ animation: `ru .55s cubic-bezier(.22,.8,.3,1) ${i * 0.06}s both` });

// ═══════════════════════════════════════════════════════════
export default function App() {
  const [D, setD] = useState(INIT);
  const [ok, setOk] = useState(false);
  const [tab, setTab] = useState("overview");
  const [showGoal, setShowGoal] = useState(false);
  const [showBudget, setShowBudget] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [del, setDel] = useState(null);
  const [on, setOn] = useState(false);
  const [nl, setNl] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [insights, setInsights] = useState(null);
  const [insLoading, setInsLoading] = useState(false);

  const isDark = D.dark;
  const V = isDark ? dark : light;

  useEffect(() => { const d = ld(); if (d) setD({ ...INIT, ...d, pins: d.pins || [], dark: d.dark || false }); setOk(true); setTimeout(() => setOn(true), 120); }, []);
  useEffect(() => { if (ok) sv(D); }, [D, ok]);
  useEffect(() => { if (ok && D.salary === 0) { const t = setTimeout(() => setShowSetup(true), 500); return () => clearTimeout(t); } }, [ok, D.salary]);
  // Force font load
  useEffect(() => { try { document.fonts?.load('400 16px Fraunces'); document.fonts?.load('400 16px Manrope'); } catch {} }, []);

  const now = new Date(), cm = now.getMonth(), cy = now.getFullYear();
  const dim = new Date(cy, cm + 1, 0).getDate();
  const dleft = dim - now.getDate() + 1;
  const mExp = D.expenses.filter(e => { const d = new Date(e.date); return d.getMonth() === cm && d.getFullYear() === cy; });
  const spent = mExp.reduce((s, e) => s + e.amount, 0);
  const ct = {}; mExp.forEach(e => { ct[e.category] = (ct[e.category] || 0) + e.amount; });

  const pm = cm === 0 ? 11 : cm - 1, py = cm === 0 ? cy - 1 : cy;
  const lmExp = D.expenses.filter(e => { const d = new Date(e.date); return d.getMonth() === pm && d.getFullYear() === py; });
  const lmSpent = lmExp.reduce((s, e) => s + e.amount, 0);
  const lmCt = {}; lmExp.forEach(e => { lmCt[e.category] = (lmCt[e.category] || 0) + e.amount; });

  const sb = D.salary > 0 && D.savingsTarget > 0 ? D.salary - D.savingsTarget : 0;
  const rem = sb - spent;
  const pctL = sb > 0 ? (rem / sb) * 100 : 100;
  const da = dleft > 0 && rem > 0 ? Math.round(rem / dleft) : 0;
  const rc = remCol(pctL, isDark);
  const tb = Object.values(D.budgets).reduce((s, v) => s + v, 0);
  const tsaved = D.savingsGoals.reduce((s, g) => s + g.saved, 0);
  const has = D.salary > 0 && D.savingsTarget > 0;

  const dd = [];
  for (let i = 13; i >= 0; i--) { const d = new Date(cy, cm, now.getDate() - i); dd.push({ l: d.getDate(), v: D.expenses.filter(e => new Date(e.date).toDateString() === d.toDateString()).reduce((s, e) => s + e.amount, 0) }); }
  const maxD = Math.max(...dd.map(d => d.v), 1);

  // AI
  const doNl = async () => { if (!nl.trim() || parsing) return; setParsing(true); setParsed(null); const r = await aiParse(nl.trim()); if (r.expenses?.length) r.expenses = r.expenses.map(e => ({ ...e, category: CAT_IDS.includes(e.category) ? e.category : "other", amount: Math.abs(Number(e.amount)) || 0 })).filter(e => e.amount > 0); setParsed(r); setParsing(false); };
  const confirmParsed = () => { if (!parsed?.expenses?.length) return; setD(p => ({ ...p, expenses: [...parsed.expenses.map(e => ({ id: uid(), amount: e.amount, category: e.category, note: e.note || "", date: e.date || now.toISOString().slice(0, 10) })), ...p.expenses] })); setParsed(null); setNl(""); };
  const doInsights = async () => { setInsLoading(true); const r = await aiInsight(D.expenses, D.budgets, D.salary, D.savingsTarget); setInsights(r.insights || []); setInsLoading(false); };

  // Pins
  const pin = (e) => { setD(p => { const pins = p.pins || []; if (pins.some(x => x.note === e.note && x.amount === e.amount && x.category === e.category)) return p; return { ...p, pins: [...pins, { id: uid(), amount: e.amount, category: e.category, note: e.note }].slice(0, 6) }; }); };
  const unpin = (id) => setD(p => ({ ...p, pins: (p.pins || []).filter(x => x.id !== id) }));
  const usePin = (p) => setD(prev => ({ ...prev, expenses: [{ id: uid(), amount: p.amount, category: p.category, note: p.note, date: now.toISOString().slice(0, 10) }, ...prev.expenses] }));

  // Forms
  const [gf, setGf] = useState({ name: "", target: "", saved: "" });
  const addGoal = () => { if (!gf.name || Number(gf.target) <= 0) return; setD(p => ({ ...p, savingsGoals: [...p.savingsGoals, { id: uid(), name: gf.name, target: Number(gf.target), saved: Number(gf.saved) || 0 }] })); setGf({ name: "", target: "", saved: "" }); setShowGoal(false); };
  const updGoal = (id, a) => setD(p => ({ ...p, savingsGoals: p.savingsGoals.map(g => g.id === id ? { ...g, saved: Math.max(0, g.saved + a) } : g) }));
  const delGoal = (id) => { setD(p => ({ ...p, savingsGoals: p.savingsGoals.filter(g => g.id !== id) })); setDel(null); };
  const delExp = (id) => { setD(p => ({ ...p, expenses: p.expenses.filter(e => e.id !== id) })); setDel(null); };
  const [bd, setBd] = useState({});
  const [sd, setSd] = useState({ salary: "", savingsTarget: "", apiKey: "" });

  // Styles
  const br = { background: "none", border: "none", padding: 0, outline: "none", fontFamily: "var(--fb)" };
  const inp = { width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid " + V.border, background: V.bg, color: V.text, fontSize: 14, outline: "none", fontFamily: "var(--fb)", boxSizing: "border-box", transition: "border-color .2s" };
  const btn = { width: "100%", padding: "13px 0", borderRadius: 12, border: "none", cursor: "pointer", background: V.text, color: V.bg, fontWeight: 600, fontSize: 13, fontFamily: "var(--fb)", letterSpacing: "0.02em" };
  const lbl = { display: "block", fontSize: 10, color: V.t3, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, marginBottom: 7, fontFamily: "var(--fb)" };
  const cd = { background: V.surface, border: "1px solid " + V.border, borderRadius: 16 };
  const tabs = [{ id: "overview", l: "Overview" }, { id: "expenses", l: "Expenses" }, { id: "budgets", l: "Budgets" }, { id: "savings", l: "Savings" }];

  return (
    <div style={{ minHeight: "100vh", background: V.bg, fontFamily: "var(--fb)", color: V.text, opacity: on ? 1 : 0, transition: "opacity .6s, background .4s, color .4s" }}>
      <div style={grainStyle(V.grainOpacity)} />
      <style>{`
        :root { --fd: 'Fraunces', Georgia, serif; --fb: 'Manrope', system-ui, sans-serif; }
        * { box-sizing: border-box; margin: 0; }
        ::-webkit-scrollbar { width: 2px; }
        ::-webkit-scrollbar-thumb { background: ${V.border}; border-radius: 2px; }
        @keyframes fi { from{opacity:0}to{opacity:1} }
        @keyframes mi { from{opacity:0;transform:translateY(12px) scale(.97)}to{opacity:1;transform:none} }
        @keyframes ru { from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none} }
        @keyframes dp { from{opacity:.2}to{opacity:.9} }
        input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}
        input[type=number]{-moz-appearance:textfield}
        input:focus{border-color:${V.accent}!important;outline:none}
      `}</style>

      <div style={{ maxWidth: 540, margin: "0 auto", padding: "40px 28px 0" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32, ...stagger(0) }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: "0.25em", color: V.t3, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>Personal Finance</div>
            <h1 style={{ fontFamily: "var(--fd)", fontSize: 32, fontWeight: 400, color: V.text, lineHeight: 1.1 }}>
              {MO[cm]} <span style={{ color: V.t3 }}>'{String(cy).slice(2)}</span>
            </h1>
          </div>
          <div style={{ display: "flex", gap: 5, marginTop: 4 }}>
            <button onClick={() => setD(p => ({ ...p, dark: !p.dark }))} style={{ ...br, cursor: "pointer", width: 34, height: 34, borderRadius: 10, border: "1px solid " + V.border, display: "flex", alignItems: "center", justifyContent: "center", transition: "all .2s" }}>
              {isDark ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={V.t3} strokeWidth="1.5"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={V.t3} strokeWidth="1.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>}
            </button>
            <button onClick={() => { setSd({ salary: D.salary || "", savingsTarget: D.savingsTarget || "", apiKey: localStorage.getItem("fin-api-key") || "" }); setShowSetup(true); }} style={{ ...br, cursor: "pointer", fontSize: 10, color: V.t3, letterSpacing: "0.08em", textTransform: "uppercase", padding: "8px 12px", borderRadius: 10, border: "1px solid " + V.border, fontWeight: 600 }}>Setup</button>
            <button onClick={() => { if (window.confirm("Reset all data?")) { setD(INIT); setInsights(null); setParsed(null); } }} style={{ ...br, cursor: "pointer", fontSize: 10, color: V.t3, letterSpacing: "0.08em", textTransform: "uppercase", padding: "8px 12px", borderRadius: 10, border: "1px solid " + V.border, fontWeight: 600 }}>Reset</button>
          </div>
        </div>

        {/* AI Input */}
        <div style={{ marginBottom: 10, ...stagger(1) }}>
          <div style={{ display: "flex", background: V.surface, border: "1px solid " + V.border, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "0 0 0 15px", display: "flex", alignItems: "center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={V.t3} strokeWidth="1.5" strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            </div>
            <input type="text" placeholder="chai 40, uber 180, groceries 650" value={nl} onChange={e => setNl(e.target.value)} onKeyDown={e => { if (e.key === "Enter") doNl(); }} disabled={parsing}
              style={{ flex: 1, padding: "13px 12px", border: "none", background: "transparent", color: V.text, fontSize: 13, fontFamily: "var(--fb)", outline: "none" }} />
            <button onClick={doNl} disabled={parsing || !nl.trim()}
              style={{ ...br, cursor: parsing || !nl.trim() ? "default" : "pointer", padding: "0 18px", fontSize: 12, fontWeight: 700, color: V.bg, background: parsing || !nl.trim() ? V.border : V.text, minHeight: 44, letterSpacing: "0.04em", transition: "background .2s" }}>
              {parsing ? <Dots color={V.bg} /> : "ADD"}
            </button>
          </div>
          {parsed && (
            <div style={{ marginTop: 8, animation: "ru .3s ease" }}>
              {parsed.error && <div style={{ padding: "12px 16px", borderRadius: 12, border: "1px solid " + V.danger + "30", background: V.dangerSoft, fontSize: 12, color: V.danger }}>{parsed.error}</div>}
              {parsed.expenses?.length > 0 && (
                <div style={{ ...cd, padding: "14px 18px" }}>
                  {parsed.expenses.map((e, i) => { const c = CATS.find(x => x.id === e.category) || CATS[7]; return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", borderTop: i ? "1px solid " + V.borderLight : "none" }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.color }} />
                      <span style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>{e.note || c.label}</span>
                      <span style={{ fontSize: 13, fontFamily: "var(--fd)", fontWeight: 500 }}>{fmt(e.amount)}</span>
                    </div>); })}
                  <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                    <button onClick={confirmParsed} style={{ ...btn, flex: 1, padding: "9px 0", fontSize: 12 }}>Confirm</button>
                    <button onClick={() => setParsed(null)} style={{ padding: "9px 16px", borderRadius: 12, border: "1px solid " + V.border, background: V.surface, color: V.t2, fontSize: 12, cursor: "pointer", fontFamily: "var(--fb)" }}>×</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pins */}
        {(D.pins || []).length > 0 && (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 16, ...stagger(2) }}>
            {(D.pins || []).map(p => { const c = CATS.find(x => x.id === p.category) || CATS[7]; return (
              <button key={p.id} onClick={() => usePin(p)} style={{ ...br, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 20, border: "1px solid " + V.border, background: V.surface, fontSize: 11, fontWeight: 500, color: V.text, transition: "all .15s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = V.accent; e.currentTarget.style.background = V.accentSoft; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = V.border; e.currentTarget.style.background = V.surface; }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.color }} />
                {p.note || c.label} <span style={{ color: V.t3, fontWeight: 400 }}>{fmt(p.amount)}</span>
              </button>); })}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid " + V.border, marginBottom: 28, ...stagger(3) }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ ...br, padding: "0 0 11px", marginRight: 22, cursor: "pointer", fontSize: 12, fontWeight: tab === t.id ? 700 : 400, letterSpacing: "0.02em", color: tab === t.id ? V.text : V.t3, borderBottom: tab === t.id ? `2px solid ${V.accent}` : "2px solid transparent", transition: "all .2s", marginBottom: -1 }}>{t.l}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 540, margin: "0 auto", padding: "0 28px 100px" }}>

        {/* ════ OVERVIEW ════ */}
        {tab === "overview" && (<div>
          {/* ── THE HERO: Remaining Balance ── */}
          {has ? (
            <div style={{ marginBottom: 32, ...stagger(4) }}>
              {/* Remaining — the emotional centre */}
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 9, letterSpacing: "0.18em", color: V.t3, textTransform: "uppercase", fontWeight: 700, marginBottom: 10 }}>Left to spend</div>
                <div style={{
                  fontFamily: "var(--fd)", fontSize: 72, fontWeight: 300, color: rc,
                  letterSpacing: "-0.04em", lineHeight: 0.9, transition: "color .5s ease",
                }}>
                  {rem >= 0 ? fmt(rem) : "−" + fmt(Math.abs(rem))}
                </div>
              </div>
              {/* Sub-info */}
              <div style={{ display: "flex", gap: 20, marginTop: 14, alignItems: "baseline" }}>
                <div>
                  <span style={{ fontSize: 10, color: V.t3, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}>Spent </span>
                  <span style={{ fontFamily: "var(--fd)", fontSize: 18, fontWeight: 500, color: V.text }}>{fmt(spent)}</span>
                </div>
                <div>
                  <span style={{ fontSize: 10, color: V.t3, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}>Budget </span>
                  <span style={{ fontFamily: "var(--fd)", fontSize: 18, fontWeight: 500, color: V.t2 }}>{fmt(sb)}</span>
                </div>
                <div>
                  <span style={{ fontSize: 10, color: V.t3, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}>Per day </span>
                  <span style={{ fontFamily: "var(--fd)", fontSize: 18, fontWeight: 500, color: rc, transition: "color .5s" }}>{fmt(da)}</span>
                </div>
              </div>
              {/* Progress */}
              <div style={{ marginTop: 18, height: 4, borderRadius: 2, background: V.borderLight, overflow: "hidden" }}>
                <div style={{ height: 4, borderRadius: 2, background: rc, width: `${Math.min(100, (spent / sb) * 100)}%`, transition: "width .7s ease, background .5s" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7 }}>
                <span style={{ fontSize: 10, color: V.t3 }}>{Math.round((spent / sb) * 100)}% used</span>
                <span style={{ fontSize: 10, color: V.t3 }}>{dleft} day{dleft !== 1 ? "s" : ""} left</span>
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: 28, ...stagger(4) }}>
              <div style={{ fontSize: 9, letterSpacing: "0.18em", color: V.t3, textTransform: "uppercase", fontWeight: 700, marginBottom: 10 }}>Total Spent</div>
              <div style={{ fontFamily: "var(--fd)", fontSize: 56, fontWeight: 300, color: V.text, letterSpacing: "-0.03em", lineHeight: 0.9 }}>{fmt(spent)}</div>
              <div onClick={() => { setSd({ salary: D.salary || "", savingsTarget: D.savingsTarget || "", apiKey: localStorage.getItem("fin-api-key") || "" }); setShowSetup(true); }}
                style={{ marginTop: 16, padding: "12px 16px", borderRadius: 12, border: "1px dashed " + V.accent + "60", cursor: "pointer", fontSize: 12, color: V.t2, transition: "all .2s" }}>
                <span style={{ color: V.accent, fontWeight: 600 }}>Set salary & savings target</span> to see your spending runway
              </div>
            </div>
          )}

          {/* Salary split */}
          {has && (
            <div style={{ ...cd, padding: "16px 18px", marginBottom: 14, ...stagger(5) }}>
              <div style={{ display: "flex", gap: 0, height: 6, borderRadius: 3, overflow: "hidden", marginBottom: 10 }}>
                <div style={{ width: `${(D.savingsTarget / D.salary) * 100}%`, background: V.success }} />
                <div style={{ width: `${(Math.min(spent, sb) / D.salary) * 100}%`, background: V.accent }} />
                <div style={{ flex: 1, background: V.borderLight }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: V.t2 }}>
                <span><span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: V.success, marginRight: 5, verticalAlign: "middle" }} />Savings {fmt(D.savingsTarget)}</span>
                <span><span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: V.accent, marginRight: 5, verticalAlign: "middle" }} />Spent {fmt(spent)}</span>
                <span style={{ color: V.t3 }}>{fmt(D.salary)}</span>
              </div>
            </div>
          )}

          {/* Monthly comparison */}
          {lmSpent > 0 && (
            <div style={{ ...cd, padding: "18px 20px", marginBottom: 14, ...stagger(6) }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <span style={{ fontSize: 10, letterSpacing: "0.1em", color: V.t3, textTransform: "uppercase", fontWeight: 700 }}>vs {MO_S[pm]}</span>
                {(() => { const ch = pctCh(spent, lmSpent); return (<span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: ch > 0 ? V.dangerSoft : V.successSoft, color: ch > 0 ? V.danger : V.success }}>{ch > 0 ? "+" : ""}{ch}%</span>); })()}
              </div>
              {/* Mini side-by-side bars for top categories */}
              {CATS.filter(c => ct[c.id] || lmCt[c.id]).sort((a, b) => Math.max(ct[b.id]||0, lmCt[b.id]||0) - Math.max(ct[a.id]||0, lmCt[a.id]||0)).slice(0, 4).map(c => {
                const curr = ct[c.id] || 0, prev = lmCt[c.id] || 0, mx = Math.max(curr, prev, 1);
                return (<div key={c.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: V.t2 }}>{c.label}</span>
                    <span style={{ fontSize: 10, color: V.t3 }}>{fmt(curr)} <span style={{ opacity: 0.5 }}>vs</span> {fmt(prev)}</span>
                  </div>
                  <div style={{ display: "flex", gap: 3 }}>
                    <div style={{ flex: 1, height: 4, borderRadius: 2, background: V.borderLight }}><div style={{ height: 4, borderRadius: 2, background: c.color, width: `${(curr / mx) * 100}%`, transition: "width .5s" }} /></div>
                    <div style={{ flex: 1, height: 4, borderRadius: 2, background: V.borderLight }}><div style={{ height: 4, borderRadius: 2, background: c.color, opacity: 0.35, width: `${(prev / mx) * 100}%`, transition: "width .5s" }} /></div>
                  </div>
                </div>);
              })}
            </div>
          )}

          {/* 14-day chart */}
          <div style={{ ...cd, padding: "18px 18px 14px", marginBottom: 14, ...stagger(7) }}>
            <div style={{ fontSize: 10, letterSpacing: "0.1em", color: V.t3, textTransform: "uppercase", fontWeight: 700, marginBottom: 14 }}>14 days</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 64 }}>
              {dd.map((d, i) => {
                const over = has && da > 0 && d.v > da;
                return (<div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: "100%", maxWidth: 24, borderRadius: 3, height: maxD > 0 ? Math.max(2, (d.v / maxD) * 52) : 2, background: d.v > 0 ? (over ? V.danger : V.accent) : V.borderLight, transition: "height .5s cubic-bezier(.4,0,.2,1)", opacity: d.v > 0 ? 1 : 0.5 }} />
                  <span style={{ fontSize: 7, color: V.t3, fontWeight: 600 }}>{d.l}</span>
                </div>);
              })}
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14, ...stagger(8) }}>
            {[{ l: "Transactions", v: mExp.length }, { l: "Daily Avg", v: fmt(Math.round(spent / Math.max(now.getDate(), 1))) }, { l: "Total Saved", v: fmt(tsaved) }].map((s, i) => (
              <div key={i} style={{ ...cd, padding: "14px" }}>
                <div style={{ fontSize: 8, letterSpacing: "0.12em", color: V.t3, textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>{s.l}</div>
                <div style={{ fontFamily: "var(--fd)", fontSize: 20, fontWeight: 500 }}>{s.v}</div>
              </div>
            ))}
          </div>

          {/* AI Insights */}
          <div style={{ ...cd, padding: "18px 20px", marginBottom: 14, borderColor: V.accent + "25", ...stagger(9) }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: insights ? 14 : 0 }}>
              <span style={{ fontSize: 10, letterSpacing: "0.1em", color: V.t3, textTransform: "uppercase", fontWeight: 700 }}>AI Insights</span>
              <button onClick={doInsights} disabled={insLoading} style={{ ...br, cursor: insLoading ? "default" : "pointer", fontSize: 10, fontWeight: 700, color: V.accent, padding: "4px 10px", borderRadius: 8, border: "1px solid " + V.accent + "35", background: V.accentSoft, letterSpacing: "0.04em" }}>
                {insLoading ? <Dots color={V.accent} /> : (insights ? "REFRESH" : "ANALYSE")}
              </button>
            </div>
            {!insights && !insLoading && <div style={{ fontSize: 12, color: V.t3, marginTop: 8 }}>Get AI-powered spending analysis.</div>}
            {insights && <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {insights.map((ins, i) => (<div key={i} style={{ display: "flex", gap: 10 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: V.accent, minWidth: 14, marginTop: 2 }}>{i + 1}</span>
                <p style={{ fontSize: 12, color: V.t2, lineHeight: 1.5, margin: 0 }}>{ins}</p>
              </div>))}
            </div>}
          </div>

          {/* Categories */}
          <div style={{ ...cd, padding: "18px 20px", ...stagger(10) }}>
            <div style={{ fontSize: 10, letterSpacing: "0.1em", color: V.t3, textTransform: "uppercase", fontWeight: 700, marginBottom: 14 }}>Categories</div>
            {CATS.filter(c => ct[c.id]).sort((a, b) => (ct[b.id] || 0) - (ct[a.id] || 0)).map(c => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: c.color }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 500 }}>{c.label}</span>
                    <span style={{ fontSize: 12, fontFamily: "var(--fd)", fontWeight: 500 }}>{fmt(ct[c.id])}</span>
                  </div>
                  <div style={{ height: 2.5, borderRadius: 2, background: V.borderLight }}><div style={{ height: 2.5, borderRadius: 2, background: c.color, width: `${Math.min(100, spent > 0 ? (ct[c.id] / spent) * 100 : 0)}%`, transition: "width .5s" }} /></div>
                </div>
              </div>
            ))}
            {!Object.keys(ct).length && <div style={{ color: V.t3, fontSize: 12, textAlign: "center", padding: "14px 0" }}>No expenses this month</div>}
          </div>
        </div>)}

        {/* ════ EXPENSES ════ */}
        {tab === "expenses" && (<div>
          {has && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderRadius: 12, background: V.accentSoft, border: "1px solid " + rc + "20", marginBottom: 18, ...stagger(4) }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: V.t2 }}>Remaining</span>
              <span style={{ fontFamily: "var(--fd)", fontSize: 22, fontWeight: 500, color: rc, transition: "color .5s" }}>{rem >= 0 ? fmt(rem) : "−" + fmt(Math.abs(rem))}</span>
            </div>
          )}
          {!D.expenses.length && <div style={{ textAlign: "center", padding: "44px 0", ...stagger(4) }}><div style={{ fontFamily: "var(--fd)", fontSize: 24, fontWeight: 400, color: V.t2, marginBottom: 6 }}>Nothing yet</div><div style={{ fontSize: 12, color: V.t3 }}>Use the input above</div></div>}
          {(() => {
            const g = {}; D.expenses.slice(0, 60).forEach(e => { if (!g[e.date]) g[e.date] = []; g[e.date].push(e); });
            return Object.entries(g).sort(([a], [b]) => b.localeCompare(a)).map(([date, exps], gi) => (
              <div key={date} style={{ marginBottom: 16, ...stagger(4 + gi * 0.5) }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7, paddingLeft: 2 }}>
                  <span style={{ fontSize: 9, letterSpacing: "0.1em", color: V.t3, textTransform: "uppercase", fontWeight: 700 }}>{new Date(date + "T12:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</span>
                  <span style={{ fontSize: 11, fontFamily: "var(--fd)", fontWeight: 500, color: V.t2 }}>{fmt(exps.reduce((s, e) => s + e.amount, 0))}</span>
                </div>
                <div style={{ ...cd, overflow: "hidden" }}>
                  {exps.map((e, i) => { const cat = CATS.find(c => c.id === e.category) || CATS[7]; const isPinned = (D.pins || []).some(p => p.note === e.note && p.amount === e.amount && p.category === e.category);
                    return (<div key={e.id} style={{ padding: "11px 16px", display: "flex", alignItems: "center", gap: 10, borderTop: i ? "1px solid " + V.borderLight : "none", transition: "background .15s" }}
                      onMouseEnter={ev => ev.currentTarget.style.background = V.bg} onMouseLeave={ev => ev.currentTarget.style.background = "transparent"}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: cat.color }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.note || cat.label}</div>
                        <div style={{ fontSize: 9, color: V.t3, marginTop: 1 }}>{cat.label}</div>
                      </div>
                      <span style={{ fontSize: 14, fontFamily: "var(--fd)", fontWeight: 500 }}>{fmt(e.amount)}</span>
                      <button onClick={() => isPinned ? unpin((D.pins||[]).find(p => p.note===e.note&&p.amount===e.amount&&p.category===e.category)?.id) : pin(e)} style={{ ...br, cursor: "pointer", padding: 3 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill={isPinned ? V.accent : "none"} stroke={isPinned ? V.accent : V.t3} strokeWidth="2"><path d="M12 17v5M9 2h6l-1 7h4l-6 8h-4l1-7H5l4-8z"/></svg>
                      </button>
                      <button onClick={() => setDel({ t: "e", id: e.id })} style={{ ...br, cursor: "pointer", fontSize: 11, color: V.t3, padding: 3 }}>×</button>
                    </div>); })}
                </div>
              </div>));
          })()}
        </div>)}

        {/* ════ BUDGETS ════ */}
        {tab === "budgets" && (<div style={{ animation: "ru .5s cubic-bezier(.2,.8,.3,1)" }}>
          <button onClick={() => { setBd({ ...D.budgets }); setShowBudget(true); }} style={{ ...btn, marginBottom: 20 }}>Edit Budgets</button>
          {tb > 0 && (
            <div style={{ ...cd, padding: "22px", marginBottom: 16, display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ position: "relative" }}>
                <Ring pct={tb > 0 ? (spent / tb) * 100 : 0} size={70} stroke={4} color={spent > tb ? V.danger : V.accent} V={V} />
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--fd)", fontSize: 16, fontWeight: 500 }}>{Math.round((spent / tb) * 100)}%</div>
              </div>
              <div>
                <div style={{ fontFamily: "var(--fd)", fontSize: 24, fontWeight: 500 }}>{fmt(spent)}</div>
                <div style={{ fontSize: 11, color: V.t3, marginTop: 3 }}>of {fmt(tb)} budgets</div>
              </div>
            </div>
          )}
          {CATS.map(c => { const b = D.budgets[c.id] || 0, s = ct[c.id] || 0, p = b > 0 ? (s / b) * 100 : 0; if (!b && !s) return null; return (
            <div key={c.id} style={{ ...cd, padding: "14px 18px", marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: c.color }} /><span style={{ fontSize: 12, fontWeight: 500 }}>{c.label}</span></div>
                <span style={{ fontSize: 11, color: V.t2 }}>{fmt(s)} <span style={{ color: V.t3 }}>/ {b > 0 ? fmt(b) : "—"}</span></span>
              </div>
              <div style={{ height: 3, borderRadius: 2, background: V.borderLight }}><div style={{ height: 3, borderRadius: 2, background: p > 100 ? V.danger : c.color, width: `${Math.min(p, 100)}%`, transition: "width .5s" }} /></div>
              {p > 85 && p <= 100 && <div style={{ fontSize: 10, color: V.warn, marginTop: 6, fontWeight: 500 }}>Approaching limit</div>}
              {p > 100 && <div style={{ fontSize: 10, color: V.danger, marginTop: 6, fontWeight: 500 }}>Over by {fmt(s - b)}</div>}
            </div>); })}
          {tb === 0 && <div style={{ textAlign: "center", padding: "40px 0", color: V.t3 }}><div style={{ fontFamily: "var(--fd)", fontSize: 22, fontWeight: 400, color: V.t2, marginBottom: 6 }}>No budgets set</div></div>}
        </div>)}

        {/* ════ SAVINGS ════ */}
        {tab === "savings" && (<div style={{ animation: "ru .5s cubic-bezier(.2,.8,.3,1)" }}>
          <button onClick={() => setShowGoal(true)} style={{ ...btn, marginBottom: 20 }}>New Goal</button>
          {has && (
            <div style={{ ...cd, padding: "14px 18px", marginBottom: 16, borderColor: V.success + "30", background: V.successSoft }}>
              <div style={{ fontSize: 9, letterSpacing: "0.1em", color: V.success, textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Monthly Commitment</div>
              <div style={{ fontFamily: "var(--fd)", fontSize: 22, fontWeight: 500, color: V.success }}>{fmt(D.savingsTarget)}</div>
            </div>
          )}
          {!D.savingsGoals.length && <div style={{ textAlign: "center", padding: "40px 0", color: V.t3 }}><div style={{ fontFamily: "var(--fd)", fontSize: 22, fontWeight: 400, color: V.t2, marginBottom: 6 }}>No goals yet</div></div>}
          {D.savingsGoals.map(g => { const p = g.target > 0 ? (g.saved / g.target) * 100 : 0, done = p >= 100; return (
            <div key={g.id} style={{ ...cd, padding: "20px", marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div>
                  <div style={{ fontFamily: "var(--fd)", fontSize: 18, fontWeight: 500 }}>{g.name}</div>
                  <div style={{ fontSize: 11, color: V.t3, marginTop: 3 }}>{fmt(g.saved)} of {fmt(g.target)}</div>
                </div>
                <div style={{ position: "relative" }}>
                  <Ring pct={p} size={44} stroke={3} color={done ? V.success : V.accent} V={V} />
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700 }}>{Math.min(Math.round(p), 100)}%</div>
                </div>
              </div>
              <div style={{ height: 3, borderRadius: 2, background: V.borderLight, marginBottom: 12 }}><div style={{ height: 3, borderRadius: 2, background: done ? V.success : V.accent, width: `${Math.min(p, 100)}%`, transition: "width .5s" }} /></div>
              {done && <div style={{ fontSize: 10, color: V.success, fontWeight: 700, marginBottom: 10 }}>Goal reached</div>}
              <div style={{ display: "flex", gap: 6 }}>
                {[500, 1000, 5000].map(a => (<button key={a} onClick={() => updGoal(g.id, a)} style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "1px solid " + V.border, background: V.surface, color: V.text, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "var(--fb)", transition: "all .15s" }}>+{fmt(a)}</button>))}
                <button onClick={() => setDel({ t: "g", id: g.id })} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid " + V.border, background: V.surface, color: V.t3, fontSize: 11, cursor: "pointer", fontFamily: "var(--fb)" }}>×</button>
              </div>
            </div>); })}
        </div>)}
      </div>

      {/* Modals */}
      <Modal open={showSetup} onClose={() => setShowSetup(false)} title="Setup" V={V}>
        <p style={{ fontSize: 12, color: V.t2, lineHeight: 1.6, marginBottom: 20 }}>Spending budget = Salary − Savings Target.</p>
        <div style={{ marginBottom: 14 }}><label style={lbl}>Salary</label><input type="number" placeholder="50000" value={sd.salary} onChange={e => setSd(p => ({ ...p, salary: e.target.value }))} style={{ ...inp, fontFamily: "var(--fd)", fontSize: 22, fontWeight: 500, padding: "12px 14px" }} /></div>
        <div style={{ marginBottom: 16 }}><label style={lbl}>Savings Target</label><input type="number" placeholder="15000" value={sd.savingsTarget} onChange={e => setSd(p => ({ ...p, savingsTarget: e.target.value }))} style={{ ...inp, fontFamily: "var(--fd)", fontSize: 22, fontWeight: 500, padding: "12px 14px" }} /></div>
        {Number(sd.salary) > 0 && Number(sd.savingsTarget) > 0 && Number(sd.savingsTarget) < Number(sd.salary) && (
          <div style={{ padding: "12px 16px", borderRadius: 12, border: "1px solid " + V.accent + "30", background: V.accentSoft, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 10, color: V.t3 }}>Spending Budget</span><span style={{ fontFamily: "var(--fd)", fontSize: 18, fontWeight: 500, color: V.accent }}>{fmt(Number(sd.salary) - Number(sd.savingsTarget))}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}><span style={{ fontSize: 10, color: V.t3 }}>Daily Allowance</span><span style={{ fontFamily: "var(--fd)", fontSize: 15, fontWeight: 500, color: V.t2 }}>{fmt(Math.round((Number(sd.salary) - Number(sd.savingsTarget)) / dim))}</span></div>
          </div>
        )}
        {Number(sd.savingsTarget) >= Number(sd.salary) && Number(sd.salary) > 0 && <div style={{ fontSize: 11, color: V.danger, marginBottom: 12 }}>Must be less than salary.</div>}
        <div style={{ borderTop: "1px solid " + V.border, marginTop: 8, paddingTop: 16, marginBottom: 14 }}>
          <label style={lbl}>Anthropic API Key</label>
          <input type="password" placeholder="Paste your API key here" value={sd.apiKey} onChange={e => setSd(p => ({ ...p, apiKey: e.target.value }))} style={{ ...inp, fontSize: 13 }} />
          <div style={{ fontSize: 10, color: V.t3, marginTop: 6, lineHeight: 1.5 }}>Enables AI categorisation and insights. Get a key from console.anthropic.com. Stored locally on this device only.</div>
        </div>
        <button onClick={() => { setD(p => ({ ...p, salary: Number(sd.salary) || 0, savingsTarget: Number(sd.savingsTarget) || 0 })); if (sd.apiKey) localStorage.setItem("fin-api-key", sd.apiKey); setShowSetup(false); }}
          style={{ ...btn }}>Save</button>
      </Modal>

      <Modal open={showGoal} onClose={() => setShowGoal(false)} title="New Goal" V={V}>
        <div style={{ marginBottom: 14 }}><label style={lbl}>Name</label><input placeholder="Emergency Fund" value={gf.name} onChange={e => setGf(p => ({ ...p, name: e.target.value }))} style={inp} /></div>
        <div style={{ marginBottom: 14 }}><label style={lbl}>Target</label><input type="number" placeholder="0" value={gf.target} onChange={e => setGf(p => ({ ...p, target: e.target.value }))} style={inp} /></div>
        <div style={{ marginBottom: 18 }}><label style={lbl}>Already Saved</label><input type="number" placeholder="0" value={gf.saved} onChange={e => setGf(p => ({ ...p, saved: e.target.value }))} style={inp} /></div>
        <button onClick={addGoal} style={btn}>Create</button>
      </Modal>

      <Modal open={showBudget} onClose={() => setShowBudget(false)} title="Category Budgets" V={V}>
        {CATS.map(c => (<div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.color }} />
          <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: V.text }}>{c.label}</span>
          <input type="number" placeholder="0" value={bd[c.id] || ""} onChange={e => setBd(p => ({ ...p, [c.id]: Number(e.target.value) || 0 }))} style={{ ...inp, width: 100, textAlign: "right", padding: "8px 12px" }} />
        </div>))}
        <button onClick={() => { setD(p => ({ ...p, budgets: { ...bd } })); setShowBudget(false); }} style={{ ...btn, marginTop: 8 }}>Save</button>
      </Modal>

      <Modal open={!!del} onClose={() => setDel(null)} title="Remove?" V={V}>
        <p style={{ color: V.t2, fontSize: 12, marginBottom: 18 }}>This can't be undone.</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setDel(null)} style={{ ...btn, background: V.bg, color: V.text, border: "1px solid " + V.border }}>Cancel</button>
          <button onClick={() => del?.t === "g" ? delGoal(del.id) : delExp(del.id)} style={{ ...btn, background: V.danger, color: "#fff" }}>Remove</button>
        </div>
      </Modal>
    </div>
  );
}