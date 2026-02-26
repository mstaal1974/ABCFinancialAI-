
import { useState, useMemo, useEffect, useCallback, useReducer, useRef } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Line, ComposedChart, ReferenceLine, Legend, LineChart
} from "recharts";
import {
  LayoutDashboard, PieChart, TrendingUp, TrendingDown, Table, Calendar, Users, Edit,
  DollarSign, Box, MapPin, Target, CreditCard, Activity, Landmark, Loader2,
  Plus, Trash2, CalendarClock, AlertCircle, ArrowRight, Wallet,
  Save, X, Tag, AlertTriangle, RefreshCw, ChevronDown, Database, Upload, BarChart2,
  LogOut, Lock, Eye, EyeOff, Shield, ClipboardList, UserCircle, KeyRound,
  Bell, BellRing, FileText, TrendingUp as TrendUp, Zap, ChevronRight, CheckCircle, XCircle, Clock
} from "lucide-react";

// ─── SUPABASE CONFIG & AUTH ──────────────────────────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://juygejpmyujvahsxnrxa.supabase.co";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

// ── Auth token management ─────────────────────────────────────────────────────
let _authToken = null; // live access token, set after login
function getAuthHeaders(token) {
  const t = token || _authToken || SUPABASE_ANON;
  return { apikey: SUPABASE_ANON, Authorization: `Bearer ${t}`, "Content-Type": "application/json" };
}

// ── Supabase Auth REST helpers ────────────────────────────────────────────────
async function sbSignIn(email, password) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error_description || data.msg || "Login failed");
  _authToken = data.access_token;
  // Persist session to sessionStorage (clears on tab close)
  sessionStorage.setItem("sb_session", JSON.stringify({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    user: data.user,
    expires_at: Date.now() + (data.expires_in * 1000)
  }));
  return data;
}

async function sbSignOut() {
  try {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST", headers: getAuthHeaders()
    });
  } catch {}
  _authToken = null;
  sessionStorage.removeItem("sb_session");
}

async function sbUpdatePassword(newPassword) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify({ password: newPassword, data: { must_change_password: false } })
  });
  if (!r.ok) { const d = await r.json(); throw new Error(d.msg || "Password update failed"); }
  return r.json();
}

async function sbGetSession() {
  try {
    const raw = sessionStorage.getItem("sb_session");
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (Date.now() > session.expires_at - 60000) {
      // Token near expiry — refresh it
      const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON, "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: session.refresh_token })
      });
      if (!r.ok) { sessionStorage.removeItem("sb_session"); return null; }
      const data = await r.json();
      _authToken = data.access_token;
      const updated = { ...session, access_token: data.access_token, expires_at: Date.now() + (data.expires_in * 1000) };
      sessionStorage.setItem("sb_session", JSON.stringify(updated));
      return updated;
    }
    _authToken = session.access_token;
    return session;
  } catch { return null; }
}

// ── Data helpers (auth-aware) ─────────────────────────────────────────────────
async function sbGet(table) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
    headers: getAuthHeaders()
  });
  if (!r.ok) return null;
  return r.json();
}

async function sbUpsert(table, data) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...getAuthHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(data)
  });
  return r.ok;
}

async function sbDelete(table, match) {
  const params = Object.entries(match).map(([k,v]) => `${k}=eq.${encodeURIComponent(v)}`).join("&");
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    method: "DELETE", headers: getAuthHeaders()
  });
  return r.ok;
}

// ── Audit log helper ──────────────────────────────────────────────────────────
async function sbAudit(user, action, entity, detail, oldVal = null, newVal = null) {
  try {
    await sbUpsert("audit_log", [{
      id: `${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      user_email: user?.email || "unknown",
      user_name: user?.user_metadata?.full_name || user?.email?.split("@")[0] || "unknown",
      action,        // "UPDATE" | "CREATE" | "DELETE" | "LOGIN" | "LOGOUT"
      entity,        // "COA" | "UNIT" | "HIRE" | "AUTH"
      detail,        // human-readable description
      old_value: oldVal !== null ? JSON.stringify(oldVal) : null,
      new_value: newVal !== null ? JSON.stringify(newVal) : null,
      created_at: new Date().toISOString()
    }]);
  } catch(e) { console.warn("Audit log failed:", e); }
}

// ─── DATA HELPERS ─────────────────────────────────────────────────────────────
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function parseDate(s) {
  if (!s) return new Date();
  const clean = s.replace(/['\"]/g,"").trim();
  const parts = clean.split(/[- ]/);
  if (parts.length < 2) return new Date();
  const mi = MONTH_NAMES.indexOf(parts[0].substring(0,3));
  if (mi === -1) return new Date();
  let yr = parseInt(parts[1]);
  if (yr < 100) yr += 2000;
  return new Date(yr, mi, 1);
}

function getFinancialYear(d) {
  const yr = d.getFullYear(); const mo = d.getMonth();
  const fy = mo >= 6 ? yr + 1 : yr;
  return `FY${fy.toString().slice(-2)}`;
}

function getCalendarYear(d) { return d.getFullYear().toString(); }

function isMonthInPeriod(d, basis, period) {
  if (period === "All") return true;
  return (basis === "calendar" ? getCalendarYear(d) : getFinancialYear(d)) === period;
}

function fmtAUD(v, compact=true) {
  return new Intl.NumberFormat("en-AU",{style:"currency",currency:"AUD",notation:compact?"compact":"standard",maximumFractionDigits:compact?1:0}).format(v);
}

// ─── STATIC DATA FROM JSONs ────────────────────────────────────────────────────
const UNIT_RATES = {
  MSL20122:{QLD:338.75,NSW:null,NT:null,TAS:null,ACT:null,VIC:300,WA:977.4,SA:null},
  MSL30122:{QLD:391.69,NSW:594.62,NT:358.4,TAS:384.69,ACT:319.23,VIC:581.54,WA:601.48,SA:321.23},
  MSL40122:{QLD:775,NSW:782.67,NT:481.6,TAS:616.07,ACT:657.33,VIC:931,WA:1051.59,SA:396.27},
  MSL50122:{QLD:265.56,NSW:815.56,NT:733.6,TAS:450,ACT:492.78,VIC:556.11,WA:654.66,SA:324.88},
  HLT37215:{QLD:450.71,NSW:552.14,NT:432.14,TAS:322.64,ACT:350.71,VIC:417.86,WA:558.51,SA:278.64},
  FFS:{QLD:350,NSW:350,NT:350,TAS:350,ACT:350,VIC:350,WA:350,SA:350}
};

const BUDGET_INPUTS = [
  {role:"Administrator",location:"Head office",base_salary:68000,car_allowance:0,phone_allowance:0,number:4},
  {role:"Trainer",location:"NSW",base_salary:85000,car_allowance:12000,phone_allowance:1200,number:4},
  {role:"Trainer",location:"QLD",base_salary:85000,car_allowance:12000,phone_allowance:1200,number:5},
  {role:"Trainer Pathways",location:"QLD",base_salary:85000,car_allowance:12000,phone_allowance:1200,number:1},
  {role:"Sales",location:"QLD",base_salary:90000,car_allowance:12000,phone_allowance:1200,number:4},
  {role:"Manager",location:"QLD",base_salary:110000,car_allowance:12000,phone_allowance:1200,number:1},
  {role:"General Manager",location:"QLD",base_salary:120000,car_allowance:12000,phone_allowance:1200,number:1},
  {role:"Executive",location:"QLD",base_salary:180000,car_allowance:12000,phone_allowance:1200,number:2}
];

// Chart of accounts — updated from Xero P&L (Alan Bartlett Consulting Pty Ltd, Feb 2026)
// Actuals: Nov-25, Dec-25, Jan-26, Feb-26 from Xero
// Jul-Oct: back-calculated from YTD (YTD minus 4 known months ÷ 4)
// Mar-Jun: forward budget = average of known 4 months
// Wages, Super, Payroll Tax are 🔒 auto-calculated from staffing headcount
const CHART_OF_ACCOUNTS = [
  // ── Direct Costs ─────────────────────────────────────────────────────────────
  // Gross Wages: Xero "Wages and Salaries" actuals
  {section:"Direct Costs",account:"Gross Wages (IncPAYG)",months:{Jul:293466,Aug:293466,Sep:293466,Oct:293466,Nov:269969,Dec:387202,Jan:261413,Feb:240395,Mar:289745,Apr:289745,May:289745,Jun:289745}},
  // Superannuation: Xero actuals
  {section:"Direct Costs",account:"Superannuation",months:{Jul:31528,Aug:31528,Sep:31528,Oct:31528,Nov:28938,Dec:43711,Jan:29453,Feb:26729,Mar:32208,Apr:32208,May:32208,Jun:32208}},
  // Course Resources: Xero actuals
  {section:"Direct Costs",account:"Course Resources",months:{Jul:2164,Aug:2164,Sep:2164,Oct:2164,Nov:6643,Dec:0,Jan:0,Feb:3262,Mar:2463,Apr:2463,May:2463,Jun:2463}},
  // Travel - National: Xero "Travel - National" actuals
  {section:"Direct Costs",account:"Travel - National",months:{Jul:62242,Aug:62242,Sep:62242,Oct:62242,Nov:46549,Dec:29346,Jan:13212,Feb:1071,Mar:22545,Apr:22545,May:22545,Jun:22545}},
  // Travel - International: Xero actuals (split from combined Travel)
  {section:"Direct Costs",account:"Travel - International",months:{Jul:18374,Aug:18374,Sep:18374,Oct:18374,Nov:8841,Dec:72871,Jan:1191,Feb:0,Mar:20726,Apr:20726,May:20726,Jun:20726}},

  // ── Overheads ─────────────────────────────────────────────────────────────────
  {section:"Overheads",account:"Payroll Tax",months:{Jul:10297,Aug:10297,Sep:10297,Oct:10297,Nov:9974,Dec:7981,Jan:12442,Feb:10861,Mar:10314,Apr:10314,May:10314,Jun:10314}},
  {section:"Overheads",account:"Rent",months:{Jul:16395,Aug:16395,Sep:16395,Oct:16395,Nov:17721,Dec:17281,Jan:16093,Feb:17937,Mar:17258,Apr:17258,May:17258,Jun:17258}},
  {section:"Overheads",account:"IT Services",months:{Jul:23621,Aug:23621,Sep:23621,Oct:23621,Nov:28369,Dec:19944,Jan:21740,Feb:23113,Mar:23292,Apr:23292,May:23292,Jun:23292}},
  {section:"Overheads",account:"Entertainment",months:{Jul:11303,Aug:11303,Sep:11303,Oct:11303,Nov:4294,Dec:8809,Jan:8621,Feb:962,Mar:5672,Apr:5672,May:5672,Jun:5672}},
  {section:"Overheads",account:"Accounting & Audit",months:{Jul:5829,Aug:5829,Sep:5829,Oct:5829,Nov:5072,Dec:5281,Jan:5072,Feb:5072,Mar:5124,Apr:5124,May:5124,Jun:5124}},
  {section:"Overheads",account:"Insurance",months:{Jul:7954,Aug:7954,Sep:7954,Oct:7954,Nov:52,Dec:51,Jan:0,Feb:5340,Mar:1361,Apr:1361,May:1361,Jun:1361}},
  {section:"Overheads",account:"Subscriptions",months:{Jul:6233,Aug:6233,Sep:6233,Oct:6233,Nov:2790,Dec:1685,Jan:1058,Feb:649,Mar:1546,Apr:1546,May:1546,Jun:1546}},
  {section:"Overheads",account:"Legal",months:{Jul:3295,Aug:3295,Sep:3295,Oct:3295,Nov:0,Dec:3250,Jan:2273,Feb:0,Mar:1381,Apr:1381,May:1381,Jun:1381}},
  {section:"Overheads",account:"Motor Vehicle",months:{Jul:2386,Aug:2386,Sep:2386,Oct:2386,Nov:2587,Dec:1244,Jan:294,Feb:2669,Mar:1698,Apr:1698,May:1698,Jun:1698}},
  {section:"Overheads",account:"Conferences & Seminars",months:{Jul:1991,Aug:1991,Sep:1991,Oct:1991,Nov:9077,Dec:0,Jan:5391,Feb:564,Mar:3758,Apr:3758,May:3758,Jun:3758}},
  {section:"Overheads",account:"Advertising",months:{Jul:5750,Aug:5750,Sep:5750,Oct:5750,Nov:490,Dec:15000,Jan:0,Feb:0,Mar:3872,Apr:3872,May:3872,Jun:3872}},
  {section:"Overheads",account:"Contractors",months:{Jul:1730,Aug:1730,Sep:1730,Oct:1730,Nov:1759,Dec:1518,Jan:961,Feb:941,Mar:1295,Apr:1295,May:1295,Jun:1295}},
  {section:"Overheads",account:"Fringe Benefits Tax",months:{Jul:3646,Aug:3646,Sep:3646,Oct:3646,Nov:14585,Dec:0,Jan:0,Feb:0,Mar:3646,Apr:3646,May:3646,Jun:3646}},
  {section:"Overheads",account:"Office Expenses",months:{Jul:2995,Aug:2995,Sep:2995,Oct:2995,Nov:4401,Dec:858,Jan:1711,Feb:1026,Mar:1999,Apr:1999,May:1999,Jun:1999}},
  {section:"Overheads",account:"Staff Training",months:{Jul:790,Aug:790,Sep:790,Oct:790,Nov:3000,Dec:95,Jan:0,Feb:231,Mar:832,Apr:832,May:832,Jun:832}},
  {section:"Overheads",account:"Printing & Stationery",months:{Jul:3242,Aug:3242,Sep:3242,Oct:3242,Nov:662,Dec:60,Jan:591,Feb:0,Mar:328,Apr:328,May:328,Jun:328}},
  {section:"Overheads",account:"Telephone & Internet",months:{Jul:997,Aug:997,Sep:997,Oct:997,Nov:217,Dec:1201,Jan:748,Feb:0,Mar:541,Apr:541,May:541,Jun:541}},
  {section:"Overheads",account:"Bank Fees",months:{Jul:409,Aug:409,Sep:409,Oct:409,Nov:206,Dec:317,Jan:88,Feb:1819,Mar:608,Apr:608,May:608,Jun:608}},
  {section:"Overheads",account:"Cleaning",months:{Jul:405,Aug:405,Sep:405,Oct:405,Nov:411,Dec:411,Jan:411,Feb:411,Mar:411,Apr:411,May:411,Jun:411}},
  {section:"Overheads",account:"Uniforms",months:{Jul:1796,Aug:1796,Sep:1796,Oct:1796,Nov:120,Dec:0,Jan:0,Feb:320,Mar:110,Apr:110,May:110,Jun:110}},
  {section:"Overheads",account:"Licensing Fee",months:{Jul:3086,Aug:3086,Sep:3086,Oct:3086,Nov:61,Dec:0,Jan:0,Feb:0,Mar:15,Apr:15,May:15,Jun:15}},
  {section:"Overheads",account:"Storage",months:{Jul:722,Aug:722,Sep:722,Oct:722,Nov:740,Dec:740,Jan:0,Feb:0,Mar:370,Apr:370,May:370,Jun:370}},
  {section:"Overheads",account:"Room Hire",months:{Jul:0,Aug:0,Sep:0,Oct:0,Nov:1584,Dec:0,Jan:0,Feb:833,Mar:604,Apr:604,May:604,Jun:604}},
  {section:"Overheads",account:"Client Gifts",months:{Jul:233,Aug:233,Sep:233,Oct:233,Nov:0,Dec:4063,Jan:0,Feb:0,Mar:1016,Apr:1016,May:1016,Jun:1016}},
  {section:"Overheads",account:"Interest Expense",months:{Jul:603,Aug:603,Sep:603,Oct:603,Nov:1,Dec:3,Jan:0,Feb:518,Mar:130,Apr:130,May:130,Jun:130}},
  {section:"Overheads",account:"Refunds",months:{Jul:1453,Aug:1453,Sep:1453,Oct:1453,Nov:0,Dec:938,Jan:325,Feb:0,Mar:316,Apr:316,May:316,Jun:316}},
  {section:"Overheads",account:"Staff Amenities",months:{Jul:167,Aug:167,Sep:167,Oct:167,Nov:189,Dec:12,Jan:0,Feb:0,Mar:50,Apr:50,May:50,Jun:50}},
  {section:"Overheads",account:"Marketing",months:{Jul:1000,Aug:1000,Sep:1000,Oct:1000,Nov:1000,Dec:1000,Jan:1000,Feb:1000,Mar:1000,Apr:1000,May:1000,Jun:1000}},
  {section:"Overheads",account:"Loan to Blocksure",months:{Jul:8000,Aug:8000,Sep:8000,Oct:8000,Nov:8000,Dec:8000,Jan:8000,Feb:8000,Mar:8000,Apr:8000,May:8000,Jun:8000}},
];

// ─── FY26 ACTUALS (from Xero P&L export, Feb 2026) ───────────────────────────
// Months with confirmed Xero data: Jul-25 through Feb-26 (8 months)
// Jul-Oct are YTD back-calculated estimates; Nov-Feb are exact Xero actuals
// Mar-Jun are forecast only (no actuals yet)
const ACTUALS_CUTOFF_MK = "Feb"; // last month with actual Xero data
const ACTUALS_FY26_MKS = new Set(["Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb"]);

const ACTUALS_FY26 = {
  // Direct Costs
  "Gross Wages (IncPAYG)": {Jul:293466,Aug:293466,Sep:293466,Oct:293466,Nov:269969,Dec:387202,Jan:261413,Feb:240395},
  "Superannuation":        {Jul:31528, Aug:31528, Sep:31528, Oct:31528, Nov:28938, Dec:43711, Jan:29453, Feb:26729},
  "Course Resources":      {Jul:2164,  Aug:2164,  Sep:2164,  Oct:2164,  Nov:6643,  Dec:0,     Jan:0,     Feb:3262},
  "Travel - National":     {Jul:62242, Aug:62242, Sep:62242, Oct:62242, Nov:46549, Dec:29346, Jan:13212, Feb:1071},
  "Travel - International":{Jul:18374, Aug:18374, Sep:18374, Oct:18374, Nov:8841,  Dec:72871, Jan:1191,  Feb:0},
  // Overheads
  "Payroll Tax":           {Jul:10297, Aug:10297, Sep:10297, Oct:10297, Nov:9974,  Dec:7981,  Jan:12442, Feb:10861},
  "Rent":                  {Jul:16395, Aug:16395, Sep:16395, Oct:16395, Nov:17721, Dec:17281, Jan:16093, Feb:17937},
  "IT Services":           {Jul:23621, Aug:23621, Sep:23621, Oct:23621, Nov:28369, Dec:19944, Jan:21740, Feb:23113},
  "Entertainment":         {Jul:11303, Aug:11303, Sep:11303, Oct:11303, Nov:4294,  Dec:8809,  Jan:8621,  Feb:962},
  "Accounting & Audit":    {Jul:5829,  Aug:5829,  Sep:5829,  Oct:5829,  Nov:5072,  Dec:5281,  Jan:5072,  Feb:5072},
  "Insurance":             {Jul:7954,  Aug:7954,  Sep:7954,  Oct:7954,  Nov:52,    Dec:51,    Jan:0,     Feb:5340},
  "Subscriptions":         {Jul:6233,  Aug:6233,  Sep:6233,  Oct:6233,  Nov:2790,  Dec:1685,  Jan:1058,  Feb:649},
  "Legal":                 {Jul:3295,  Aug:3295,  Sep:3295,  Oct:3295,  Nov:0,     Dec:3250,  Jan:2273,  Feb:0},
  "Motor Vehicle":         {Jul:2386,  Aug:2386,  Sep:2386,  Oct:2386,  Nov:2587,  Dec:1244,  Jan:294,   Feb:2669},
  "Conferences & Seminars":{Jul:1991,  Aug:1991,  Sep:1991,  Oct:1991,  Nov:9077,  Dec:0,     Jan:5391,  Feb:564},
  "Advertising":           {Jul:5750,  Aug:5750,  Sep:5750,  Oct:5750,  Nov:490,   Dec:15000, Jan:0,     Feb:0},
  "Contractors":           {Jul:1730,  Aug:1730,  Sep:1730,  Oct:1730,  Nov:1759,  Dec:1518,  Jan:961,   Feb:941},
  "Fringe Benefits Tax":   {Jul:3646,  Aug:3646,  Sep:3646,  Oct:3646,  Nov:14585, Dec:0,     Jan:0,     Feb:0},
  "Office Expenses":       {Jul:2995,  Aug:2995,  Sep:2995,  Oct:2995,  Nov:4401,  Dec:858,   Jan:1711,  Feb:1026},
  "Staff Training":        {Jul:790,   Aug:790,   Sep:790,   Oct:790,   Nov:3000,  Dec:95,    Jan:0,     Feb:231},
  "Printing & Stationery": {Jul:3242,  Aug:3242,  Sep:3242,  Oct:3242,  Nov:662,   Dec:60,    Jan:591,   Feb:0},
  "Telephone & Internet":  {Jul:997,   Aug:997,   Sep:997,   Oct:997,   Nov:217,   Dec:1201,  Jan:748,   Feb:0},
  "Bank Fees":             {Jul:409,   Aug:409,   Sep:409,   Oct:409,   Nov:206,   Dec:317,   Jan:88,    Feb:1819},
  "Cleaning":              {Jul:405,   Aug:405,   Sep:405,   Oct:405,   Nov:411,   Dec:411,   Jan:411,   Feb:411},
  "Uniforms":              {Jul:1796,  Aug:1796,  Sep:1796,  Oct:1796,  Nov:120,   Dec:0,     Jan:0,     Feb:320},
  "Licensing Fee":         {Jul:3086,  Aug:3086,  Sep:3086,  Oct:3086,  Nov:61,    Dec:0,     Jan:0,     Feb:0},
  "Storage":               {Jul:722,   Aug:722,   Sep:722,   Oct:722,   Nov:740,   Dec:740,   Jan:0,     Feb:0},
  "Room Hire":             {Jul:0,     Aug:0,     Sep:0,     Oct:0,     Nov:1584,  Dec:0,     Jan:0,     Feb:833},
  "Client Gifts":          {Jul:233,   Aug:233,   Sep:233,   Oct:233,   Nov:0,     Dec:4063,  Jan:0,     Feb:0},
  "Interest Expense":      {Jul:603,   Aug:603,   Sep:603,   Oct:603,   Nov:1,     Dec:3,     Jan:0,     Feb:518},
  "Refunds":               {Jul:1453,  Aug:1453,  Sep:1453,  Oct:1453,  Nov:0,     Dec:938,   Jan:325,   Feb:0},
  "Staff Amenities":       {Jul:167,   Aug:167,   Sep:167,   Oct:167,   Nov:189,   Dec:12,    Jan:0,     Feb:0},
  "Marketing":             {Jul:1000,  Aug:1000,  Sep:1000,  Oct:1000,  Nov:1000,  Dec:1000,  Jan:1000,  Feb:1000},
  "Loan to Blocksure":     {Jul:8000,  Aug:8000,  Sep:8000,  Oct:8000,  Nov:8000,  Dec:8000,  Jan:8000,  Feb:8000},
};


// ─── 3-YEAR MONTH SCHEDULE (FY26 + FY27 + FY28) ──────────────────────────────
// Each entry: { label: "Jul-25", mk: "Jul", year: 2025, fyLabel: "FY26" }
function buildMonthSchedule() {
  const schedule = [];
  const fyDefs = [
    { fy: "FY26", startYear: 2025 },
    { fy: "FY27", startYear: 2026 },
    { fy: "FY28", startYear: 2027 },
  ];
  const MO_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const FY_ORDER = ["Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar","Apr","May","Jun"];
  fyDefs.forEach(({ fy, startYear }) => {
    FY_ORDER.forEach(mk => {
      const calYear = mk === "Jul" || mk === "Aug" || mk === "Sep" || mk === "Oct" || mk === "Nov" || mk === "Dec"
        ? startYear : startYear + 1;
      const label = `${mk}-${String(calYear).slice(2)}`;
      schedule.push({ label, mk, calYear, fy });
    });
  });
  return schedule;
}
const MONTH_SCHEDULE = buildMonthSchedule();
const ALL_MONTH_LABELS = MONTH_SCHEDULE.map(m => m.label);

// Unit growth rates per FY (applied to unit volumes, not prices)
const UNIT_GROWTH = { FY26: 1.0, FY27: 1.08, FY28: 1.08 * 1.08 }; // 8% YoY
// Cost inflation per FY (applied to chart of accounts)
const COST_INFLATION = { FY26: 1.0, FY27: 1.03, FY28: 1.03 * 1.03 }; // 3% YoY

// FY26 base unit assumptions (keyed by short month name)
const UNIT_ASSUMPTIONS_FY26 = {
  QLD: {
    MSL20122: {price: UNIT_RATES.MSL20122.QLD, monthly: {Jul:1528,Aug:312,Sep:128,Oct:144,Nov:240,Dec:100,Jan:20,Feb:30,Mar:80,Apr:320,May:430,Jun:452}},
    MSL30122: {price: UNIT_RATES.MSL30122.QLD, monthly: {Jul:20,Aug:20,Sep:20,Oct:20,Nov:22,Dec:15,Jan:15,Feb:22,Mar:24,Apr:24,May:26,Jun:29}},
    MSL40122: {price: UNIT_RATES.MSL40122.QLD, monthly: {Jul:80,Aug:80,Sep:80,Oct:80,Nov:88,Dec:44,Jan:80,Feb:80,Mar:96,Apr:115,May:138,Jun:166}},
    MSL50122: {price: UNIT_RATES.MSL50122.QLD, monthly: {Jul:15,Aug:20,Sep:20,Oct:20,Nov:22,Dec:11,Jan:10,Feb:11,Mar:12,Apr:13,May:14,Jun:15}},
    HLT37215: {price: UNIT_RATES.HLT37215.QLD, monthly: {Jul:60,Aug:60,Sep:60,Oct:60,Nov:60,Dec:30,Jan:30,Feb:50,Mar:50,Apr:80,May:90,Jun:100}},
    FFS:      {price: UNIT_RATES.FFS.QLD,       monthly: {Jul:15,Aug:15,Sep:15,Oct:15,Nov:17,Dec:17,Jan:17,Feb:18,Mar:20,Apr:22,May:24,Jun:26}},
  },
  NSW: {
    MSL30122: {price: UNIT_RATES.MSL30122.NSW, monthly: {Jul:20,Aug:20,Sep:20,Oct:20,Nov:20,Dec:10,Jan:10,Feb:15,Mar:18,Apr:18,May:20,Jun:22}},
    MSL40122: {price: UNIT_RATES.MSL40122.NSW, monthly: {Jul:80,Aug:80,Sep:80,Oct:80,Nov:80,Dec:50,Jan:50,Feb:75,Mar:94,Apr:117,May:129,Jun:141}},
    MSL50122: {price: UNIT_RATES.MSL50122.NSW, monthly: {Jul:10,Aug:10,Sep:10,Oct:10,Nov:10,Dec:5,Jan:5,Feb:10,Mar:16,Apr:22,May:28,Jun:28}},
    HLT37215: {price: UNIT_RATES.HLT37215.NSW, monthly: {Jul:40,Aug:40,Sep:40,Oct:50,Nov:50,Dec:40,Jan:40,Feb:50,Mar:95,Apr:80,May:80,Jun:80}},
    FFS:      {price: UNIT_RATES.FFS.NSW,       monthly: {Jul:15,Aug:17,Sep:17,Oct:17,Nov:17,Dec:11,Jan:11,Feb:15,Mar:17,Apr:19,May:21,Jun:23}},
  },
  NT: {
    MSL30122: {price: UNIT_RATES.MSL30122.NT, monthly: {Jul:4,Aug:0,Sep:4,Oct:0,Nov:0,Dec:2,Jan:0,Feb:4,Mar:0,Apr:8,May:0,Jun:12}},
    MSL40122: {price: UNIT_RATES.MSL40122.NT, monthly: {Jul:18,Aug:0,Sep:22,Oct:0,Nov:0,Dec:12,Jan:2,Feb:12,Mar:0,Apr:22,May:0,Jun:22}},
    MSL50122: {price: UNIT_RATES.MSL50122.NT, monthly: {Jul:4,Aug:0,Sep:8,Oct:0,Nov:0,Dec:3,Jan:2,Feb:7,Mar:0,Apr:7,May:0,Jun:8}},
    HLT37215: {price: UNIT_RATES.HLT37215.NT, monthly: {Jul:0,Aug:0,Sep:4,Oct:0,Nov:4,Dec:0,Jan:4,Feb:0,Mar:4,Apr:0,May:12,Jun:0}},
    FFS:      {price: UNIT_RATES.FFS.NT,       monthly: {Jul:2,Aug:0,Sep:2,Oct:0,Nov:0,Dec:1,Jan:0,Feb:1,Mar:0,Apr:1,May:0,Jun:1}},
  },
  TAS: {
    MSL30122: {price: UNIT_RATES.MSL30122.TAS, monthly: {Jul:0,Aug:4,Sep:0,Oct:4,Nov:0,Dec:0,Jan:0,Feb:0,Mar:0,Apr:0,May:0,Jun:0}},
    MSL40122: {price: UNIT_RATES.MSL40122.TAS, monthly: {Jul:15,Aug:0,Sep:18,Oct:0,Nov:0,Dec:6,Jan:0,Feb:20,Mar:0,Apr:25,May:0,Jun:31}},
    MSL50122: {price: UNIT_RATES.MSL50122.TAS, monthly: {Jul:3,Aug:0,Sep:3,Oct:0,Nov:0,Dec:4,Jan:0,Feb:2,Mar:0,Apr:12,May:0,Jun:12}},
    HLT37215: {price: UNIT_RATES.HLT37215.TAS, monthly: {Jul:0,Aug:12,Sep:0,Oct:12,Nov:0,Dec:8,Jan:0,Feb:12,Mar:16,Apr:20,May:28,Jun:36}},
    FFS:      {price: UNIT_RATES.FFS.TAS,       monthly: {Jul:4,Aug:0,Sep:4,Oct:0,Nov:0,Dec:2,Jan:0,Feb:4,Mar:0,Apr:2,May:0,Jun:2}},
  },
  ACT: {
    MSL30122: {price: UNIT_RATES.MSL30122.ACT, monthly: {Jul:0,Aug:4,Sep:0,Oct:4,Nov:0,Dec:4,Jan:0,Feb:2,Mar:0,Apr:0,May:0,Jun:4}},
    MSL40122: {price: UNIT_RATES.MSL40122.ACT, monthly: {Jul:0,Aug:6.6,Sep:0,Oct:6.6,Nov:0,Dec:6.6,Jan:0,Feb:6.6,Mar:0,Apr:6.6,May:0,Jun:6.6}},
    MSL50122: {price: UNIT_RATES.MSL50122.ACT, monthly: {Jul:0,Aug:6.6,Sep:0,Oct:6.6,Nov:0,Dec:6.6,Jan:0,Feb:3.3,Mar:0,Apr:2,May:0,Jun:6}},
    HLT37215: {price: UNIT_RATES.HLT37215.ACT, monthly: {Jul:8.8,Aug:10,Sep:10,Oct:17.6,Nov:30,Dec:30,Jan:15,Feb:35,Mar:48,Apr:70,May:90,Jun:120}},
    FFS:      {price: UNIT_RATES.FFS.ACT,       monthly: {Jul:2,Aug:0,Sep:2,Oct:0,Nov:0,Dec:2,Jan:0,Feb:2,Mar:0,Apr:2,May:0,Jun:2}},
  },
  VIC: {
    MSL30122: {price: UNIT_RATES.MSL30122.VIC, monthly: {Jul:0,Aug:0,Sep:0,Oct:0,Nov:0,Dec:5,Jan:0,Feb:5,Mar:5,Apr:10,May:15,Jun:25}},
    MSL40122: {price: UNIT_RATES.MSL40122.VIC, monthly: {Jul:0,Aug:8,Sep:4,Oct:32,Nov:48,Dec:4,Jan:0,Feb:8,Mar:8,Apr:96,May:144,Jun:180}},
    MSL50122: {price: UNIT_RATES.MSL50122.VIC, monthly: {Jul:0,Aug:0,Sep:0,Oct:0,Nov:0,Dec:0,Jan:0,Feb:0,Mar:0,Apr:6,May:6,Jun:9}},
    HLT37215: {price: UNIT_RATES.HLT37215.VIC, monthly: {Jul:0,Aug:0,Sep:0,Oct:0,Nov:0,Dec:0,Jan:0,Feb:0,Mar:30,Apr:60,May:90,Jun:120}},
    FFS:      {price: UNIT_RATES.FFS.VIC,       monthly: {Jul:0,Aug:0,Sep:0,Oct:0,Nov:0,Dec:0,Jan:0,Feb:0,Mar:0,Apr:0,May:0,Jun:0}},
  },
  WA: {
    MSL20122: {price: UNIT_RATES.MSL20122.WA, monthly: {Jul:0,Aug:0,Sep:0,Oct:0,Nov:10,Dec:10,Jan:0,Feb:0,Mar:0,Apr:0,May:0,Jun:0}},
    MSL30122: {price: UNIT_RATES.MSL30122.WA, monthly: {Jul:0,Aug:0,Sep:0,Oct:0,Nov:0,Dec:0,Jan:0,Feb:3,Mar:4,Apr:4,May:8,Jun:10}},
    MSL40122: {price: UNIT_RATES.MSL40122.WA, monthly: {Jul:0,Aug:0,Sep:0,Oct:0,Nov:10,Dec:10,Jan:0,Feb:10,Mar:25,Apr:40,May:46,Jun:53}},
    MSL50122: {price: UNIT_RATES.MSL50122.WA, monthly: {Jul:0,Aug:0,Sep:0,Oct:0,Nov:0,Dec:0,Jan:0,Feb:2,Mar:2,Apr:2,May:2,Jun:2}},
    HLT37215: {price: UNIT_RATES.HLT37215.WA, monthly: {Jul:0,Aug:0,Sep:0,Oct:0,Nov:5,Dec:5,Jan:0,Feb:5,Mar:20,Apr:40,May:60,Jun:80}},
    FFS:      {price: UNIT_RATES.FFS.WA,       monthly: {Jul:0,Aug:0,Sep:0,Oct:0,Nov:0,Dec:0,Jan:0,Feb:0,Mar:0,Apr:0,May:0,Jun:0}},
  },
  SA: {
    MSL30122: {price: UNIT_RATES.MSL30122.SA, monthly: {Jul:2,Aug:4,Sep:6,Oct:6,Nov:8,Dec:4,Jan:5,Feb:12,Mar:12,Apr:12,May:14,Jun:12}},
    MSL40122: {price: UNIT_RATES.MSL40122.SA, monthly: {Jul:6,Aug:6,Sep:6,Oct:7,Nov:7,Dec:4,Jan:7,Feb:18,Mar:22,Apr:22,May:24,Jun:22}},
    MSL50122: {price: UNIT_RATES.MSL50122.SA, monthly: {Jul:0,Aug:0,Sep:2,Oct:2,Nov:2,Dec:1,Jan:1,Feb:2,Mar:4,Apr:8,May:8,Jun:9}},
    HLT37215: {price: UNIT_RATES.HLT37215.SA, monthly: {Jul:0,Aug:0,Sep:0,Oct:0,Nov:0,Dec:0,Jan:0,Feb:0,Mar:0,Apr:5,May:15,Jun:30}},
    FFS:      {price: UNIT_RATES.FFS.SA,       monthly: {Jul:0,Aug:0,Sep:0,Oct:0,Nov:0,Dec:0,Jan:0,Feb:0,Mar:0,Apr:0,May:0,Jun:0}},
  }
};

// ─── Ramp helpers (used by both buildBaselineData and StaffPlanner) ──────────
function _getTrainerUnits(mo) { if(mo<3)return 0; if(mo===3)return 10; if(mo===4)return 25; return 42; }
// Sales ramp: 3-month cliff, then 21 units × (month - 3) linear ramp
// Target: $100,000/mo revenue ≈ 212 units/mo at QLD avg $471/unit (reached ~month 13)
// Formula derived from Sales_Unit_Distribution formula sheet.
function _getSalesUnits(mo) {
  if (mo < 3) return 0;  // cliff
  return 21 * (mo - 3 + 1); // month 4 (mo=3, 0-indexed) → 21; month 5 → 42; etc.
}
function _regionAvgUnitValue(region) {
  const EXCL = new Set(["MSL20122","FFS"]);
  const courses = UNIT_ASSUMPTIONS_FY26[region];
  if(!courses) return 0;
  const prices = Object.entries(courses).filter(([c])=>!EXCL.has(c)).map(([,v])=>v.price);
  return prices.length ? prices.reduce((s,p)=>s+p,0)/prices.length : 0;
}

function buildBaselineData(adjustments = {}, filledHires = [], coaAdjustments = {}) {
  // Build unit data across all 36 months
  const units = [];
  Object.entries(UNIT_ASSUMPTIONS_FY26).forEach(([region, courses]) => {
    Object.entries(courses).forEach(([code, {price, monthly}]) => {
      const monthlyData = MONTH_SCHEDULE.map(({ label, mk, fy }) => {
        const adjKey = `${region}|${code}|${label}`;
        const growth = UNIT_GROWTH[fy] || 1;
        const baseCount = monthly[mk] || 0;
        const count = adjustments[adjKey] !== undefined
          ? adjustments[adjKey]
          : Math.round(baseCount * growth * 10) / 10;
        return { month: label, fy, units: count, revenue: count * price, dateObj: parseDate(label) };
      });
      const totalRevenue = monthlyData.reduce((s, m) => s + m.revenue, 0);
      const totalUnits   = monthlyData.reduce((s, m) => s + m.units, 0);
      units.push({ region, code, price, monthlyData, totalRevenue, totalUnits });
    });
  });

  // Build regions
  const regionNames = [...new Set(units.map(u => u.region))];
  const regions = regionNames.map(rName => {
    const rUnits = units.filter(u => u.region === rName);
    const mData = MONTH_SCHEDULE.map(({ label, fy }, i) => {
      const revenue    = rUnits.reduce((s, u) => s + (u.monthlyData[i]?.revenue || 0), 0);
      const unitsCount = rUnits.reduce((s, u) => s + (u.monthlyData[i]?.units   || 0), 0);
      const budget     = revenue * 0.95;
      return { month: label, fy, revenue, units: unitsCount, budget };
    });
    return {
      region: rName,
      totalRevenue: mData.reduce((s, m) => s + m.revenue, 0),
      totalUnits:   mData.reduce((s, m) => s + m.units, 0),
      totalBudget:  mData.reduce((s, m) => s + m.budget, 0),
      monthlyData:  mData,
    };
  });

  // Pre-index filled hires for fast per-month lookup
  const filledByIdx = filledHires.map(ev => ({
    ...ev,
    si: ALL_MONTH_LABELS.indexOf(ev.startMonth),
    count: Number(ev.count),
    uv: _regionAvgUnitValue(ev.region),
    eventType: ev.eventType || "hire",
  })).filter(ev => ev.si !== -1);

  // Build operational financials — filled hires baked into actuals
  let balance = 850000;
  const opFin = MONTH_SCHEDULE.map(({ label, mk, fy }, i) => {
    const inflation = COST_INFLATION[fy] || 1;
    // Use coaAdjustments override if present, else COA default * inflation
    // Calculated rows (Gross Wages, Super, Payroll Tax) are NOT in COA for calc purposes — they come from staffing
    const CALC_ROWS = new Set(["Gross Wages (IncPAYG)", "Superannuation", "Payroll Tax"]);
    let pmt = Math.round(CHART_OF_ACCOUNTS
      .filter(ac => !CALC_ROWS.has(ac.account))
      .reduce((s, ac) => {
        const key = `${fy}|${ac.account}|${mk}`;
        const v = coaAdjustments[key] !== undefined ? coaAdjustments[key] : Math.round((ac.months[mk] || 0) * inflation);
        return s + v;
      }, 0));
    // Add staffing rows: baseline BUDGET_INPUTS wages/super/payrolltax with inflation
    const staffBase = CHART_OF_ACCOUNTS
      .filter(ac => CALC_ROWS.has(ac.account))
      .reduce((s, ac) => s + Math.round((ac.months[mk] || 0) * inflation), 0);
    pmt += staffBase;
    const baseRevenue = regions.reduce((s, r) => s + (r.monthlyData[i]?.revenue || 0), 0);

    // Filled events: confirmed hires add cost+revenue, confirmed departures remove both
    let filledStaffCostDelta = 0, filledRevDelta = 0;
    filledByIdx.forEach(ev => {
      if (i >= ev.si) {
        const mCost = getMonthlyCost(ev.roleId) * ev.count;
        const ma = i - ev.si;
        const uPP = ev.roleId === "trainer" ? _getTrainerUnits(ma) : ev.roleId === "sales" ? _getSalesUnits(ma) : 0;
        const mRev = uPP * ev.count * ev.uv;
        if (ev.eventType === "departure") {
          filledStaffCostDelta -= mCost;  // wage saving
          filledRevDelta       -= mRev;   // lost revenue
        } else {
          filledStaffCostDelta += mCost;
          filledRevDelta       += mRev;
        }
      }
    });

    pmt += filledStaffCostDelta;
    const revenue = baseRevenue + filledRevDelta;
    const net     = revenue - pmt;
    const opening = balance;
    balance = opening + net;
    return {
      month: label, fy, dateObj: parseDate(label),
      payments: pmt, netCashflow: net,
      openingBalance: opening, closingBalance: balance,
      filledStaffCostDelta, filledRevDelta,
    };
  });

  return {
    units,
    regions,
    operationalFinancials: opFin,
    grandTotalRevenue: regions.reduce((s, r) => s + r.totalRevenue, 0),
    grandTotalUnits:   regions.reduce((s, r) => s + r.totalUnits,   0),
    grandTotalBudget:  regions.reduce((s, r) => s + r.totalBudget,  0),
    months: ALL_MONTH_LABELS,
  };
}

// ─── STAFF ROLES ──────────────────────────────────────────────────────────────
const STAFF_ROLES = [
  {id:"trainer",label:"Trainer",baseWage:85000,carAllowance:12000,phoneAllowance:1200,superRate:0.12,payrollTaxRate:0.055},
  {id:"sales",label:"Sales",baseWage:100000,carAllowance:12000,phoneAllowance:1200,superRate:0.12,payrollTaxRate:0.055},
  {id:"admin",label:"Administration",baseWage:67500,carAllowance:0,phoneAllowance:0,superRate:0.12,payrollTaxRate:0.055},
  {id:"manager",label:"Manager",baseWage:110000,carAllowance:0,phoneAllowance:0,superRate:0.12,payrollTaxRate:0.055},
  {id:"snr_manager",label:"Senior Manager",baseWage:120000,carAllowance:0,phoneAllowance:0,superRate:0.12,payrollTaxRate:0.055},
  {id:"executive",label:"Executive",baseWage:180000,carAllowance:12000,phoneAllowance:1200,superRate:0.12,payrollTaxRate:0.055}
];

function getMonthlyCost(roleId) {
  const r = STAFF_ROLES.find(x => x.id === roleId);
  if (!r) return 0;
  const gross = r.baseWage + r.carAllowance + r.phoneAllowance;
  const superAmt = r.baseWage * r.superRate;
  const payroll = (gross + superAmt) * r.payrollTaxRate;
  return (gross + superAmt + payroll) / 12;
}

// ─── COLORS ──────────────────────────────────────────────────────────────────
const COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#06b6d4","#84cc16"];
const REGION_COLORS = {QLD:"#f59e0b",NSW:"#3b82f6",NT:"#ef4444",TAS:"#10b981",ACT:"#8b5cf6",VIC:"#06b6d4",WA:"#ec4899",SA:"#84cc16"};

// ─── STATS CARD ───────────────────────────────────────────────────────────────
function StatsCard({title, value, trend, icon: Icon, color}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex items-start gap-4">
      <div className={`p-3 rounded-xl ${color} text-white shrink-0`}><Icon size={22}/></div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">{title}</p>
        <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
        <p className="text-xs text-slate-400 mt-0.5">{trend}</p>
      </div>
    </div>
  );
}

// ─── DASHBOARD OVERVIEW ───────────────────────────────────────────────────────
function DashboardOverview({data, yearBasis, selectedYear, hiringEvents=[], anomalies=[], anomalyStatus="idle", lastScanned=null, onShowAnomalies}) {
  const {regions, units, operationalFinancials} = data;

  const filtered = useMemo(() => {
    let totalRevenue=0,totalUnits=0,totalBudget=0,totalPayments=0,totalNetCashflow=0,currentCash=0;
    const regionStats = [];
    regions.forEach(r => {
      let rRev=0,rUnits=0,rBudget=0;
      r.monthlyData.forEach(md => {
        const d = units[0]?.monthlyData.find(x=>x.month===md.month)?.dateObj;
        if (d && isMonthInPeriod(d, yearBasis, selectedYear)) {
          rRev+=md.revenue; rUnits+=md.units; rBudget+=md.budget;
        }
      });
      totalRevenue+=rRev; totalUnits+=rUnits; totalBudget+=rBudget;
      regionStats.push({region:r.region, totalRevenue:rRev, totalUnits:rUnits, totalBudget:rBudget});
    });
    let lastDate=null;
    operationalFinancials.forEach(op => {
      if (isMonthInPeriod(op.dateObj, yearBasis, selectedYear)) {
        totalPayments+=op.payments; totalNetCashflow+=op.netCashflow;
        if (!lastDate || op.dateObj>lastDate) {lastDate=op.dateObj; currentCash=op.closingBalance;}
      }
    });
    return {totalRevenue, totalUnits, totalBudget, totalPayments, totalNetCashflow, currentCash, regionStats};
  }, [regions, units, operationalFinancials, yearBasis, selectedYear]);

  // Planned (unfilled) hires — shown as a projected line on the chart
  const plannedHires = useMemo(() => hiringEvents.filter(ev => !ev.filled), [hiringEvents]);

  const chartData = useMemo(() => {
    // Build projected balance from planned (unfilled) hires on top of current actuals
    const allMonths = data.months;
    const plannedByIdx = plannedHires.map(ev => ({
      ...ev,
      si: allMonths.indexOf(ev.startMonth),
      count: Number(ev.count),
      uv: _regionAvgUnitValue(ev.region),
    })).filter(ev => ev.si !== -1);

    let projBal = null;
    return operationalFinancials.map((op,i) => {
      if (!isMonthInPeriod(op.dateObj, yearBasis, selectedYear)) return null;
      const rev = regions.reduce((s,r) => s+(r.monthlyData[i]?.revenue||0), 0);

      // Compute planned hire impact for this month
      let planCost = 0, planRev = 0;
      plannedByIdx.forEach(ev => {
        if (i >= ev.si) {
          planCost += getMonthlyCost(ev.roleId) * ev.count;
          const ma = i - ev.si;
          const uPP = ev.roleId === "trainer" ? _getTrainerUnits(ma) : ev.roleId === "sales" ? _getSalesUnits(ma) : 0;
          if (uPP > 0) planRev += uPP * ev.count * ev.uv;
        }
      });

      const projNet = op.netCashflow + planRev - planCost;
      if (projBal === null) projBal = op.openingBalance;
      projBal = projBal + projNet;

      return {
        month: op.month,
        revenue: rev,
        payments: op.payments,
        netCashflow: op.netCashflow,
        cashPosition: op.closingBalance,
        projectedCash: plannedHires.length > 0 ? Math.round(projBal) : null,
      };
    }).filter(Boolean);
  }, [regions, operationalFinancials, yearBasis, selectedYear, plannedHires, data.months]);

  const variance = filtered.totalRevenue - filtered.totalBudget;

  return (
    <div className="space-y-6">
      {/* Anomaly alert banner */}
      {(anomalyStatus !== "idle") && (
        <div className="flex items-center justify-between bg-white border border-slate-100 rounded-xl px-5 py-3 shadow-sm">
          <div className="flex items-center gap-2">
            <Bell size={14} className="text-slate-400"/>
            <span className="text-xs text-slate-500 font-medium">AI Anomaly Monitor</span>
          </div>
          <AnomalyBadge anomalies={anomalies} anomalyStatus={anomalyStatus} onClick={onShowAnomalies}/>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatsCard title="Total Revenue" value={fmtAUD(filtered.totalRevenue)} trend={`${variance>=0?"+":""}${fmtAUD(variance)} vs Budget`} icon={DollarSign} color={variance>=0?"bg-emerald-500":"bg-amber-500"}/>
        <StatsCard title="Total Payments" value={fmtAUD(filtered.totalPayments)} trend="Operational Outflow" icon={CreditCard} color="bg-rose-500"/>
        <StatsCard title="Net Cashflow" value={fmtAUD(filtered.totalNetCashflow)} trend="Period Movement" icon={Activity} color={filtered.totalNetCashflow>=0?"bg-blue-500":"bg-red-500"}/>
        <StatsCard title="Cash Position" value={fmtAUD(filtered.currentCash)} trend="Closing Balance" icon={Landmark} color={filtered.currentCash>=0?"bg-indigo-500":"bg-orange-500"}/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-bold text-slate-800">Financial Performance</h3>
            {plannedHires.length > 0 && (
              <span className="flex items-center gap-1.5 text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full font-semibold">
                <span className="inline-block w-4 border-t-2 border-dashed border-emerald-500"/>
                {[
                  plannedHires.filter(e=>e.eventType!=="departure").length > 0 && `${plannedHires.filter(e=>e.eventType!=="departure").length} hire${plannedHires.filter(e=>e.eventType!=="departure").length>1?"s":""}`,
                  plannedHires.filter(e=>e.eventType==="departure").length > 0 && `${plannedHires.filter(e=>e.eventType==="departure").length} departure${plannedHires.filter(e=>e.eventType==="departure").length>1?"s":""}`,
                ].filter(Boolean).join(" + ")} predicted
              </span>
            )}
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/>
                <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false}/>
                <YAxis yAxisId="l" tickFormatter={v=>`$${v/1000}k`} fontSize={11} tickLine={false} axisLine={false}/>
                <YAxis yAxisId="r" orientation="right" tickFormatter={v=>`$${v/1000}k`} fontSize={11} tickLine={false} axisLine={false}/>
                <Tooltip formatter={(v,n)=>[fmtAUD(v,false),n]} contentStyle={{borderRadius:"8px",border:"none",boxShadow:"0 4px 6px -1px rgb(0 0 0/0.1)"}}/>
                <Legend iconType="circle" wrapperStyle={{paddingTop:"12px"}}/>
                <Bar yAxisId="l" dataKey="netCashflow" name="Net Cashflow" fill="#cbd5e1" opacity={0.6} barSize={18}/>
                <Area yAxisId="l" type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#revGrad)" name="Revenue"/>
                <Line yAxisId="l" type="monotone" dataKey="payments" stroke="#e11d48" strokeWidth={2} dot={false} name="Payments"/>
                <Line yAxisId="r" type="monotone" dataKey="cashPosition" stroke="#4f46e5" strokeWidth={3} dot={{r:2}} name="Cash Position (Actual)"/>
                <Line yAxisId="r" type="monotone" dataKey="projectedCash" stroke="#10b981" strokeWidth={2.5} dot={false} strokeDasharray="6 3" name="Cash Position (Projected)" connectNulls={false}/>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-base font-bold text-slate-800 mb-5">Cashflow Summary</h3>
          <div className="space-y-5">
            {[
              {label:"Revenue",value:filtered.totalRevenue,color:"blue"},
              {label:"Payments",value:filtered.totalPayments,color:"rose"},
            ].map(({label,value,color})=>(
              <div key={label}>
                <p className="text-xs text-slate-500 mb-1">{label}</p>
                <p className={`text-xl font-bold text-${color}-600`}>{fmtAUD(value,false)}</p>
                <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1.5">
                  <div className={`bg-${color}-500 h-1.5 rounded-full`} style={{width:`${Math.min(100,(value/Math.max(filtered.totalRevenue,1))*100)}%`}}/>
                </div>
              </div>
            ))}
            <div className="pt-3 border-t border-slate-100">
              <p className="text-xs text-slate-500 mb-1">Net Cashflow</p>
              <p className={`text-2xl font-bold ${filtered.totalNetCashflow>=0?"text-emerald-600":"text-red-600"}`}>{fmtAUD(filtered.totalNetCashflow,false)}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl">
              <p className="text-xs text-slate-500 mb-1">Closing Balance</p>
              <p className={`text-2xl font-bold ${filtered.currentCash>=0?"text-indigo-700":"text-orange-600"}`}>{fmtAUD(filtered.currentCash,false)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-base font-bold text-slate-800 mb-5">Revenue vs Budget by Region</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filtered.regionStats} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0"/>
                <XAxis type="number" hide/>
                <YAxis dataKey="region" type="category" width={50} fontSize={11} tickLine={false} axisLine={false}/>
                <Tooltip formatter={v=>fmtAUD(v,false)} cursor={{fill:"#f1f5f9"}}/>
                <Legend iconType="circle"/>
                <Bar dataKey="totalRevenue" fill="#6366f1" radius={[0,4,4,0]} name="Revenue" barSize={10}/>
                <Bar dataKey="totalBudget" fill="#d8b4fe" radius={[0,4,4,0]} name="Budget" barSize={10}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-base font-bold text-slate-800 mb-5">Unit Volume by Region</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filtered.regionStats} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0"/>
                <XAxis type="number" hide/>
                <YAxis dataKey="region" type="category" width={50} fontSize={11} tickLine={false} axisLine={false}/>
                <Tooltip cursor={{fill:"#f1f5f9"}}/>
                <Bar dataKey="totalUnits" fill="#10b981" radius={[0,4,4,0]} name="Units" barSize={20}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── REGIONAL ANALYSIS ────────────────────────────────────────────────────────
function RegionalAnalysis({data, yearBasis, selectedYear}) {
  const [selectedRegion, setSelectedRegion] = useState(data.regions[0]?.region || "QLD");
  const regionUnits = data.units.filter(u => u.region === selectedRegion);
  const regionData = data.regions.find(r => r.region === selectedRegion);

  const stats = useMemo(() => {
    let totalRevenue=0, totalUnits=0, totalBudget=0;
    const breakdown = [];
    regionUnits.forEach(u => {
      let uUnits=0, uRev=0;
      u.monthlyData.forEach(md => {
        if (isMonthInPeriod(md.dateObj, yearBasis, selectedYear)) { uUnits+=md.units; uRev+=md.revenue; }
      });
      totalRevenue+=uRev; totalUnits+=uUnits;
      breakdown.push({code:u.code, units:uUnits, revenue:uRev});
    });
    if (regionData) {
      regionData.monthlyData.forEach(md => {
        const d = regionUnits[0]?.monthlyData.find(x=>x.month===md.month)?.dateObj;
        if (d && isMonthInPeriod(d, yearBasis, selectedYear)) totalBudget+=md.budget;
      });
    }
    return {totalRevenue, totalUnits, totalBudget, breakdown};
  }, [regionUnits, regionData, yearBasis, selectedYear]);

  const chartData = useMemo(() => {
    if (!regionUnits[0]) return [];
    return regionUnits[0].monthlyData.map((md,i) => {
      if (!isMonthInPeriod(md.dateObj, yearBasis, selectedYear)) return null;
      const pt = {month:md.month};
      regionUnits.forEach(u => { pt[u.code] = Math.round(u.monthlyData[i]?.units||0); });
      return pt;
    }).filter(Boolean);
  }, [regionUnits, yearBasis, selectedYear]);

  const revChartData = useMemo(() => {
    if (!regionData) return [];
    return regionData.monthlyData.map((md,i) => {
      const d = regionUnits[0]?.monthlyData.find(x=>x.month===md.month)?.dateObj;
      if (!d || !isMonthInPeriod(d, yearBasis, selectedYear)) return null;
      return {month:md.month, revenue:Math.round(md.revenue), budget:Math.round(md.budget)};
    }).filter(Boolean);
  }, [regionData, regionUnits, yearBasis, selectedYear]);

  return (
    <div className="space-y-5">
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-bold text-slate-800">Regional Analysis</h2>
          <div className="flex flex-wrap gap-2 ml-auto">
            {data.regions.map(r => (
              <button key={r.region} onClick={()=>setSelectedRegion(r.region)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${selectedRegion===r.region?"text-white shadow":"bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                style={selectedRegion===r.region?{background:REGION_COLORS[r.region]||"#3b82f6"}:{}}
              >{r.region}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatsCard title="Revenue" value={fmtAUD(stats.totalRevenue)} trend="Period total" icon={DollarSign} color="bg-blue-500"/>
        <StatsCard title="Total Units" value={stats.totalUnits.toLocaleString()} trend="Enrolled units" icon={Box} color="bg-emerald-500"/>
        <StatsCard title="Vs Budget" value={fmtAUD(stats.totalRevenue - stats.totalBudget)} trend={`Budget: ${fmtAUD(stats.totalBudget)}`} icon={Target} color={stats.totalRevenue>=stats.totalBudget?"bg-green-500":"bg-amber-500"}/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Revenue vs Budget Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={revChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/>
                <XAxis dataKey="month" fontSize={10} tickLine={false} axisLine={false}/>
                <YAxis tickFormatter={v=>`$${v/1000}k`} fontSize={10} tickLine={false} axisLine={false}/>
                <Tooltip formatter={v=>fmtAUD(v,false)}/>
                <Legend iconType="circle"/>
                <Area type="monotone" dataKey="revenue" stroke={REGION_COLORS[selectedRegion]||"#3b82f6"} fill={REGION_COLORS[selectedRegion]||"#3b82f6"} fillOpacity={0.15} strokeWidth={2} name="Revenue"/>
                <Line type="monotone" dataKey="budget" stroke="#94a3b8" strokeWidth={2} dot={false} strokeDasharray="5 5" name="Budget"/>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Units by Course Code</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/>
                <XAxis dataKey="month" fontSize={10} tickLine={false} axisLine={false}/>
                <YAxis fontSize={10} tickLine={false} axisLine={false}/>
                <Tooltip/>
                <Legend iconType="circle"/>
                {regionUnits.map((u,i) => (
                  <Bar key={u.code} dataKey={u.code} stackId="a" fill={COLORS[i%COLORS.length]} barSize={24}/>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800">Course Breakdown — {selectedRegion}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {["Course","Price/Unit","Units","Revenue","% of Total"].map(h=>(
                  <th key={h} className="px-5 py-3 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.breakdown.filter(b=>b.units>0).map(b=>(
                <tr key={b.code} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-5 py-3"><span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-xs font-semibold">{b.code}</span></td>
                  <td className="px-5 py-3 font-mono text-slate-500">{fmtAUD(regionUnits.find(u=>u.code===b.code)?.price||0,false)}</td>
                  <td className="px-5 py-3 font-semibold">{Math.round(b.units).toLocaleString()}</td>
                  <td className="px-5 py-3 font-semibold text-emerald-600">{fmtAUD(b.revenue,false)}</td>
                  <td className="px-5 py-3 text-slate-500">{stats.totalRevenue>0?((b.revenue/stats.totalRevenue)*100).toFixed(1):0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── UNIT MODELER — Spreadsheet Table ────────────────────────────────────────
function UnitModeler({data, yearBasis, selectedYear, onUpdateUnits, onSave, saving}) {
  const [selectedRegion, setSelectedRegion] = useState(data.regions[0]?.region || "QLD");
  const [viewMode, setViewMode] = useState("units"); // "units" | "revenue"
  // activeCell: { code, month }
  const [activeCell, setActiveCell] = useState(null);
  const [cellValue, setCellValue] = useState("");
  const inputRef = useCallback(node => { if (node) { node.focus(); node.select(); } }, []);

  const displayMonths = useMemo(() => data.months.filter(m => {
    const d = data.units[0]?.monthlyData.find(md => md.month === m)?.dateObj;
    return d && isMonthInPeriod(d, yearBasis, selectedYear);
  }), [data.months, data.units, yearBasis, selectedYear]);

  // All course rows for this region
  const regionRows = useMemo(() =>
    data.units.filter(u => u.region === selectedRegion),
  [data.units, selectedRegion]);

  // Row totals per course
  const rowTotals = useMemo(() => {
    const t = {};
    regionRows.forEach(u => {
      let units = 0, revenue = 0;
      displayMonths.forEach(m => {
        const md = u.monthlyData.find(x => x.month === m);
        units += md?.units || 0;
        revenue += md?.revenue || 0;
      });
      t[u.code] = { units, revenue };
    });
    return t;
  }, [regionRows, displayMonths]);

  // Column totals per month
  const colTotals = useMemo(() => {
    const t = {};
    displayMonths.forEach(m => {
      let units = 0, revenue = 0;
      regionRows.forEach(u => {
        const md = u.monthlyData.find(x => x.month === m);
        units += md?.units || 0;
        revenue += md?.revenue || 0;
      });
      t[m] = { units, revenue };
    });
    return t;
  }, [regionRows, displayMonths]);

  const grandTotal = useMemo(() => ({
    units: regionRows.reduce((s,u) => s + (rowTotals[u.code]?.units||0), 0),
    revenue: regionRows.reduce((s,u) => s + (rowTotals[u.code]?.revenue||0), 0),
  }), [regionRows, rowTotals]);

  function startEdit(code, month, currentUnits) {
    setActiveCell({ code, month });
    setCellValue(Math.round(currentUnits).toString());
  }

  function commitEdit() {
    if (!activeCell) return;
    const v = parseFloat(cellValue);
    if (!isNaN(v) && v >= 0) {
      onUpdateUnits(selectedRegion, activeCell.code, activeCell.month, v);
    }
    setActiveCell(null);
  }

  function handleKeyDown(e, code, month, colIdx, rowIdx) {
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      commitEdit();
      // Move to next cell: Tab→right, Enter→down
      if (e.key === "Tab") {
        const nextCol = colIdx + 1;
        if (nextCol < displayMonths.length) {
          const nextMonth = displayMonths[nextCol];
          const u = regionRows[rowIdx];
          const md = u?.monthlyData.find(x => x.month === nextMonth);
          startEdit(code, nextMonth, md?.units || 0);
        }
      } else {
        const nextRow = rowIdx + 1;
        if (nextRow < regionRows.length) {
          const nextCode = regionRows[nextRow].code;
          const u = regionRows[nextRow];
          const md = u?.monthlyData.find(x => x.month === month);
          startEdit(nextCode, month, md?.units || 0);
        }
      }
    } else if (e.key === "Escape") {
      setActiveCell(null);
    }
  }

  // highlight modified cells
  function isModified(code, month) {
    const key = `${selectedRegion}|${code}|${month}`;
    return Object.prototype.hasOwnProperty.call(
      // access the raw adjustments via the unit data comparison
      {}, key  // placeholder — visual only via opacity
    );
  }

  const COURSE_COLORS = {
    MSL20122:"#3b82f6", MSL30122:"#10b981", MSL40122:"#f59e0b",
    MSL50122:"#8b5cf6", HLT37215:"#ef4444", FFS:"#06b6d4"
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Edit size={17} className="text-emerald-500"/>Unit Acquisition — Spreadsheet
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Click any cell to edit · Tab = next column · Enter = next row</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Region tabs */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
            {data.regions.map(r => (
              <button key={r.region} onClick={() => { setSelectedRegion(r.region); setActiveCell(null); }}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${selectedRegion===r.region ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                {r.region}
              </button>
            ))}
          </div>
          {/* View toggle */}
          <div className="flex bg-slate-100 p-1 rounded-lg">
            {[["units","Units"],["revenue","Revenue"]].map(([v,l]) => (
              <button key={v} onClick={() => setViewMode(v)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${viewMode===v?"bg-white text-emerald-600 shadow-sm":"text-slate-500 hover:text-slate-700"}`}>
                {l}
              </button>
            ))}
          </div>
          <button onClick={onSave} disabled={saving}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors">
            {saving ? <Loader2 size={12} className="animate-spin"/> : <Database size={12}/>}
            {saving ? "Saving…" : "Save to Supabase"}
          </button>
        </div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-5 py-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-emerald-700">Total Units — {selectedRegion}</span>
          <span className="text-lg font-bold text-emerald-800">{Math.round(grandTotal.units).toLocaleString()}</span>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-blue-700">Total Revenue — {selectedRegion}</span>
          <span className="text-lg font-bold text-blue-800">{fmtAUD(grandTotal.revenue, false)}</span>
        </div>
      </div>

      {/* Spreadsheet */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="text-xs border-collapse" style={{minWidth: "100%"}}>
            <thead>
              {/* Header row */}
              <tr className="bg-slate-800 text-white">
                <th className="sticky left-0 z-20 bg-slate-800 px-4 py-3 text-left font-semibold w-32 border-r border-slate-700">
                  Course
                </th>
                <th className="px-3 py-3 text-right font-semibold w-20 border-r border-slate-700 text-slate-300">
                  Rate
                </th>
                {displayMonths.map(m => (
                  <th key={m} className="px-3 py-3 text-center font-semibold w-20 border-r border-slate-700 whitespace-nowrap">
                    {m}
                  </th>
                ))}
                <th className="px-3 py-3 text-right font-semibold w-24 bg-slate-900 border-l border-slate-700">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {regionRows.map((u, rowIdx) => {
                const rowTotal = rowTotals[u.code];
                const dotColor = COURSE_COLORS[u.code] || "#6b7280";
                return (
                  <tr key={u.code} className="group border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                    {/* Course label */}
                    <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50/60 px-4 py-0 border-r border-slate-200 w-32">
                      <div className="flex items-center gap-2 py-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{background: dotColor}}/>
                        <span className="font-bold text-slate-700 text-xs">{u.code}</span>
                      </div>
                    </td>
                    {/* Rate */}
                    <td className="px-3 py-2 text-right text-slate-400 font-mono border-r border-slate-100 w-20 whitespace-nowrap">
                      ${u.price.toFixed(0)}
                    </td>
                    {/* Month cells */}
                    {displayMonths.map((month, colIdx) => {
                      const md = u.monthlyData.find(x => x.month === month);
                      const units = md?.units || 0;
                      const revenue = md?.revenue || 0;
                      const isActive = activeCell?.code === u.code && activeCell?.month === month;
                      const displayVal = viewMode === "units"
                        ? Math.round(units)
                        : Math.round(revenue / 1000 * 10) / 10; // show as $k

                      return (
                        <td key={month}
                          className={`px-1 py-1 text-center border-r border-slate-100 w-20 cursor-pointer select-none
                            ${isActive ? "bg-emerald-50 ring-2 ring-inset ring-emerald-400" : "hover:bg-blue-50"}
                            ${units === 0 ? "text-slate-300" : "text-slate-700"}`}
                          onClick={() => !isActive && startEdit(u.code, month, units)}
                        >
                          {isActive ? (
                            <input
                              ref={inputRef}
                              type="number"
                              value={cellValue}
                              min="0"
                              onChange={e => setCellValue(e.target.value)}
                              onBlur={commitEdit}
                              onKeyDown={e => handleKeyDown(e, u.code, month, colIdx, rowIdx)}
                              className="w-full text-center bg-transparent outline-none font-bold text-emerald-700 text-xs py-1.5"
                            />
                          ) : (
                            <span className={`font-mono text-xs block py-1.5 ${units > 0 ? "font-semibold" : ""}`}>
                              {viewMode === "units"
                                ? (units > 0 ? Math.round(units).toLocaleString() : "—")
                                : (revenue > 0 ? `$${(revenue/1000).toFixed(1)}k` : "—")
                              }
                            </span>
                          )}
                        </td>
                      );
                    })}
                    {/* Row total */}
                    <td className="px-3 py-2 text-right font-bold border-l border-slate-200 bg-slate-50 w-24 whitespace-nowrap">
                      {viewMode === "units"
                        ? <span className="text-slate-700">{Math.round(rowTotal?.units||0).toLocaleString()}</span>
                        : <span className="text-emerald-600">{fmtAUD(rowTotal?.revenue||0)}</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Footer totals */}
            <tfoot>
              <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold">
                <td className="sticky left-0 z-10 bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-600 border-r border-slate-200">
                  TOTAL
                </td>
                <td className="border-r border-slate-200"/>
                {displayMonths.map(m => {
                  const ct = colTotals[m] || {units:0, revenue:0};
                  return (
                    <td key={m} className="px-3 py-2.5 text-center border-r border-slate-200 text-xs font-bold text-slate-700">
                      {viewMode === "units"
                        ? (ct.units > 0 ? Math.round(ct.units).toLocaleString() : "—")
                        : (ct.revenue > 0 ? `$${(ct.revenue/1000).toFixed(1)}k` : "—")
                      }
                    </td>
                  );
                })}
                <td className="px-3 py-2.5 text-right border-l border-slate-300 bg-slate-200 text-xs font-black text-slate-800">
                  {viewMode === "units"
                    ? Math.round(grandTotal.units).toLocaleString()
                    : fmtAUD(grandTotal.revenue)
                  }
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 flex items-center gap-4">
          <span>💡 <strong>Click</strong> any cell to edit units</span>
          <span><strong>Tab</strong> = move right</span>
          <span><strong>Enter</strong> = move down</span>
          <span><strong>Esc</strong> = cancel</span>
          <span className="ml-auto">Showing: <strong>{displayMonths.length}</strong> months · <strong>{regionRows.length}</strong> courses</span>
        </div>
      </div>
    </div>
  );
}

// ─── STAFF PLANNER ────────────────────────────────────────────────────────────
function StaffPlanner({data, hiringEvents, setHiringEvents, onSaveHiring}) {
  const months = data.operationalFinancials.map(op=>op.month);
  const regions = data.regions.map(r=>r.region);

  const [role, setRole] = useState(STAFF_ROLES[0].id);
  const [count, setCount] = useState(1);
  const [startMonth, setStartMonth] = useState(months[0]||"");
  const [region, setRegion] = useState(regions[0]||"QLD");
  const [aStart, setAStart] = useState(months[0]||"");
  const [aEnd, setAEnd] = useState(months[months.length-1]||"");

  // ── Trainer ramp: 0 units for first 3 months, then 10 / 25 / 42 / 42… ──────
  // monthsActive = i - startIndex (0-based)
  // Month 0,1,2 → 0 units (settling in)
  // Month 3      → 10 units
  // Month 4      → 25 units
  // Month 5+     → 42 units
  // Units are spread EVENLY across all active course codes for that region.
  const getTrainerUnits = mo => {
    if (mo < 3) return 0;
    if (mo === 3) return 10;
    if (mo === 4) return 25;
    return 42;
  };

  // Average unit value per region — unweighted mean of "sellable" course prices.
  // MSL20122 and FFS are excluded as they are not sold through the sales team.
  // This gives QLD avg ≈ $471, matching the benchmark in the sales formula sheet.
  const SALES_EXCLUDED_CODES = new Set(["MSL20122", "FFS"]);
  const regionUnitValues = useMemo(() => {
    const m = new Map();
    data.regions.forEach(r => {
      const sellable = data.units.filter(
        u => u.region === r.region && u.price > 0 && !SALES_EXCLUDED_CODES.has(u.code)
      );
      const avg = sellable.length > 0
        ? sellable.reduce((s, u) => s + u.price, 0) / sellable.length
        : 0;
      m.set(r.region, avg);
    });
    return m;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.regions, data.units]);

  // Count active courses per region (courses with at least 1 unit in the period)
  const regionCourseCounts = useMemo(() => {
    const m = new Map();
    data.regions.forEach(r => {
      const activeCourses = new Set(
        data.units.filter(u => u.region === r.region && u.totalUnits > 0).map(u => u.code)
      );
      m.set(r.region, Math.max(activeCourses.size, 1));
    });
    return m;
  }, [data.regions, data.units]);

  // ── Sales ramp model ─────────────────────────────────────────────────────────
  // Target: $100,000 revenue/month per salesperson
  // 3-month cliff (months 1-3): 0 units
  // Linear ramp from month 4: 21 units × (month - 3)
  //   Month 4  → 21 units  (~$9,891 @ QLD avg $471)
  //   Month 5  → 42 units  (~$19,782)
  //   Month 13 → 210 units (~$98,910) ← hits $100k target
  // Formula from Sales_Unit_Distribution formula sheet.
  const getSalesUnits = mo => {
    if (mo < 3) return 0;         // cliff — no delivery yet
    return 21 * (mo - 3 + 1);    // mo=3 (month 4) → 21, mo=4 → 42, etc.
  };

  // Pre-compute reference schedule for the UI
  // Uses new linear formula: 21 × (month - 3) from month 4 onwards
  const salesRampSchedule = useMemo(() => {
    return Array.from({length: 18}, (_, mo) => ({
      month: mo + 1,
      units: Math.round(getSalesUnits(mo)),
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const projData = useMemo(() => {
    const base = data.operationalFinancials;
    if (!base.length) return [];
    // Only use UNFILLED (planned) events — filled ones are already baked into data.operationalFinancials
    const valid = hiringEvents
      .filter(ev => !ev.filled)
      .map(ev => ({...ev, si: months.indexOf(ev.startMonth), count: Number(ev.count), isDeparture: ev.eventType === "departure"}))
      .filter(ev => ev.si !== -1);
    let bal = base[0].openingBalance;
    return base.map((op, i) => {
      let staffCostDelta = 0, revDelta = 0, genUnits = 0, headcount = 0;
      valid.forEach(ev => {
        if (i >= ev.si) {
          const mCost = getMonthlyCost(ev.roleId) * ev.count;
          const ma = i - ev.si;
          let uPP = 0;
          if (ev.roleId === "trainer") uPP = getTrainerUnits(ma);
          else if (ev.roleId === "sales") uPP = getSalesUnits(ma);
          const uv = regionUnitValues.get(ev.region) || 0;
          const mRev = uPP * ev.count * uv;

          if (ev.isDeparture) {
            // Departure: save the wage cost but LOSE the revenue contribution
            staffCostDelta -= mCost;   // negative = savings on payments
            revDelta       -= mRev;    // negative = lost revenue
            headcount      -= ev.count;
          } else {
            // Hire: add wage cost, gain revenue
            staffCostDelta += mCost;
            revDelta       += mRev;
            genUnits       += uPP * ev.count;
            headcount      += ev.count;
          }
        }
      });
      // newNet = baseline net + revenue delta - extra cost delta
      // For hire:      baseline + genRev - staffCost
      // For departure: baseline - lostRev + wageSavings (staffCostDelta is negative so: - staffCostDelta = + savings)
      const newNet = op.netCashflow + revDelta - staffCostDelta;
      const opening = i === 0 ? op.openingBalance : bal;
      const closing = opening + newNet;
      bal = closing;
      return {
        month: op.month,
        baselineBalance: op.closingBalance,
        projectedBalance: closing,
        baselineCashflow: op.netCashflow,
        projectedCashflow: newNet,
        staffCostDelta, revDelta, genUnits, headcount
      };
    });
  }, [data.operationalFinancials, data.units, hiringEvents, regionUnitValues, regionCourseCounts, months]);

  const viewData = useMemo(() => {
    const si = months.indexOf(aStart), ei = months.indexOf(aEnd);
    if(si===-1||ei===-1||si>ei) return projData;
    return projData.slice(si, ei+1);
  }, [projData, aStart, aEnd, months]);

  const summary = useMemo(() => {
    if(!viewData.length) return {staffCostDelta:0,revDelta:0,netImpact:0,endBalance:0,baseEndBalance:0};
    return {
      staffCostDelta: viewData.reduce((s,d)=>s+d.staffCostDelta,0),
      revDelta: viewData.reduce((s,d)=>s+d.revDelta,0),
      netImpact: viewData.reduce((s,d)=>s+(d.projectedCashflow-d.baselineCashflow),0),
      endBalance: viewData[viewData.length-1].projectedBalance,
      baseEndBalance: viewData[viewData.length-1].baselineBalance,
    };
  }, [viewData]);

  const [eventType, setEventType] = useState("hire"); // "hire" | "departure"
  const [roiResult, setRoiResult] = useState(null);   // AI ROI analysis
  const [roiLoading, setRoiLoading] = useState(false);
  const [lastRoiKey, setLastRoiKey] = useState("");   // tracks which hire was analysed

  // Compute deterministic ROI numbers for the selected hire config
  const computeRoiNumbers = (roleId, regionId, numCount, startMo) => {
    const roleObj = STAFF_ROLES.find(r => r.id === roleId);
    if (!roleObj) return null;
    const uv = regionUnitValues.get(regionId) || 471;
    const monthlyCost = getMonthlyCost(roleId) * numCount;
    const startIdx = months.indexOf(startMo);
    if (startIdx === -1) return null;

    // Project 18 months forward
    let cumCost = 0, cumRev = 0, breakEvenMonth = null;
    const monthly = [];
    for (let mo = 0; mo < 18; mo++) {
      const units = roleId === "sales" ? getSalesUnits(mo) : roleId === "trainer" ? getTrainerUnits(mo) : 0;
      const rev = units * numCount * uv;
      cumCost += monthlyCost;
      cumRev  += rev;
      const net = cumRev - cumCost;
      if (net >= 0 && breakEvenMonth === null) breakEvenMonth = mo + 1;
      const calLabel = months[startIdx + mo] || `M${mo+1}`;
      monthly.push({ mo: mo + 1, label: calLabel, rev, cost: monthlyCost, net: cumRev - cumCost });
    }

    // FY26 remaining months from startMonth
    const fy26Months = MONTH_SCHEDULE.filter(m => m.fy === "FY26");
    const fy26Remaining = fy26Months.filter(m => months.indexOf(m.label) >= startIdx);
    const fy26Net = fy26Remaining.reduce((s, _, idx) => {
      const units = roleId === "sales" ? getSalesUnits(idx) : roleId === "trainer" ? getTrainerUnits(idx) : 0;
      return s + (units * numCount * uv) - monthlyCost;
    }, 0);

    return {
      roleLabel: roleObj.label,
      region: regionId,
      count: numCount,
      startMonth: startMo,
      monthlyCost,
      uv: Math.round(uv),
      breakEvenMonth,
      fy26Net: Math.round(fy26Net),
      monthly,
      totalCost18: Math.round(monthlyCost * 18),
      totalRev18: Math.round(monthly.reduce((s,m)=>s+m.rev,0)),
    };
  };

  const addEvent = () => {
    if(!startMonth) return;
    const newEvent = {
      id: Math.random().toString(36).slice(2,9),
      roleId: role,
      count: Math.max(1, Number(count)),
      startMonth,
      region,
      eventType,
    };
    setHiringEvents(prev => [...prev, newEvent]);

    // Trigger AI ROI analysis for hires only
    if (eventType === "hire") {
      const roiKey = `${role}-${region}-${count}-${startMonth}`;
      if (roiKey !== lastRoiKey) {
        setLastRoiKey(roiKey);
        runRoiAnalysis(role, region, Math.max(1, Number(count)), startMonth);
      }
    }
  };

  const runRoiAnalysis = async (roleId, regionId, numCount, startMo) => {
    setRoiLoading(true);
    setRoiResult(null);
    const numbers = computeRoiNumbers(roleId, regionId, numCount, startMo);
    if (!numbers) { setRoiLoading(false); return; }

    try {
      const prompt = `You are a concise financial analyst for ABC Training, an Australian RTO.
A hiring decision is being evaluated:
- Role: ${numbers.roleLabel} × ${numbers.count}
- Region: ${numbers.region}
- Start month: ${numbers.startMonth}
- Monthly cost (wages+super+payroll tax): ${fmtAUD(numbers.monthlyCost, false)}
- Average unit value in ${numbers.region}: $${numbers.uv}
- Break-even month: ${numbers.breakEvenMonth ? `Month ${numbers.breakEvenMonth}` : "Beyond 18 months"}
- Net contribution to FY26 (remaining months): ${fmtAUD(numbers.fy26Net, false)}
- 18-month total cost: ${fmtAUD(numbers.totalCost18, false)}
- 18-month total revenue: ${fmtAUD(numbers.totalRev18, false)}
- 18-month net: ${fmtAUD(numbers.totalRev18 - numbers.totalCost18, false)}

${numbers.breakEvenMonth
  ? `The hire breaks even at month ${numbers.breakEvenMonth} (${numbers.startMonth} + ${numbers.breakEvenMonth - 1} months).`
  : "This hire does NOT break even within 18 months."}

Write a 3-sentence hiring ROI verdict for a manager. Cover:
1. The payback period and what it means
2. The FY26 net contribution (positive or negative)
3. One key risk or opportunity to watch

Be direct, specific with dollar amounts, and use plain English. No bullet points, just 3 sentences.`;

      const verdict = await callGemini(prompt, "", 512);
      setRoiResult({ ...numbers, verdict: verdict.trim() });
    } catch (e) {
      setRoiResult({ ...numbers, verdict: null });
    }
    setRoiLoading(false);
  };

  return (
    <div className="space-y-5">
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2"><Users size={18} className="text-indigo-500"/>Staff Planner</h2>
          <p className="text-xs text-slate-500 mt-1">
            {hiringEvents.filter(e=>e.filled).length > 0
              ? <span className="font-semibold text-slate-700">
                  {hiringEvents.filter(e=>e.filled&&e.eventType!=="departure").length > 0 &&
                    <span className="text-emerald-600">✓ {hiringEvents.filter(e=>e.filled&&e.eventType!=="departure").length} hire{hiringEvents.filter(e=>e.filled&&e.eventType!=="departure").length>1?"s":""} confirmed</span>}
                  {hiringEvents.filter(e=>e.filled&&e.eventType!=="departure").length > 0 && hiringEvents.filter(e=>e.filled&&e.eventType==="departure").length > 0 && " · "}
                  {hiringEvents.filter(e=>e.filled&&e.eventType==="departure").length > 0 &&
                    <span className="text-red-600">✓ {hiringEvents.filter(e=>e.filled&&e.eventType==="departure").length} departure{hiringEvents.filter(e=>e.filled&&e.eventType==="departure").length>1?"s":""} confirmed</span>}
                  {hiringEvents.filter(e=>!e.filled).length > 0 &&
                    <span className="text-amber-600"> · {hiringEvents.filter(e=>!e.filled).length} predicted</span>}
                </span>
              : "Add hires or departures — confirm them to update actuals"
            }
          </p>
        </div>
        <button onClick={onSaveHiring} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-xs font-medium transition-colors">
          <Database size={12}/>Save Plan
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
            {/* Hire / Departure toggle */}
            <div className="flex bg-slate-100 p-0.5 rounded-lg mb-4">
              <button onClick={()=>setEventType("hire")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-all ${eventType==="hire"?"bg-indigo-600 text-white shadow":"text-slate-500 hover:text-slate-700"}`}>
                <Plus size={12}/>New Hire
              </button>
              <button onClick={()=>setEventType("departure")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-all ${eventType==="departure"?"bg-rose-600 text-white shadow":"text-slate-500 hover:text-slate-700"}`}>
                <Trash2 size={12}/>Departure
              </button>
            </div>

            {eventType === "departure" && (
              <div className="mb-3 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-[10px] text-rose-700">
                <strong>Departure</strong> — removes staff cost saving <em>and</em> loses their unit/revenue contribution from that month forward.
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Role</label>
                <select value={role} onChange={e=>setRole(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-400 outline-none">
                  {STAFF_ROLES.map(r=><option key={r.id} value={r.id}>{r.label} ({fmtAUD(r.baseWage,false)})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Region</label>
                  <select value={region} onChange={e=>setRegion(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-400 outline-none">
                    {regions.map(r=><option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Count</label>
                  <input type="number" min="1" value={count} onChange={e=>setCount(Math.max(1,parseInt(e.target.value)||1))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"/>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">{eventType==="departure"?"Last Working Month":"Start Month"}</label>
                <select value={startMonth} onChange={e=>setStartMonth(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-400 outline-none">
                  {months.map(m=><option key={m}>{m}</option>)}
                </select>
              </div>
              <button onClick={addEvent}
                className={`w-full flex items-center justify-center gap-1.5 text-white py-2 rounded-lg text-sm font-medium transition-colors ${eventType==="departure"?"bg-rose-600 hover:bg-rose-700":"bg-indigo-600 hover:bg-indigo-700"}`}>
                {eventType==="departure"?<><Trash2 size={14}/>Add Departure</>:<><Plus size={15}/>Add Hire + AI ROI</>}
              </button>
            </div>
          </div>

          {/* ── AI Hiring ROI Panel ──────────────────────────────────────── */}
          {(roiLoading || roiResult) && (
            <div className={`rounded-xl border overflow-hidden shadow-sm transition-all ${roiResult && !roiLoading ? "bg-white border-slate-100" : "bg-white border-slate-100"}`}>
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-[9px] font-black shrink-0">AI</div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Hiring ROI Analysis</p>
                    <p className="text-[10px] text-slate-400">Gemini · instant payback calculation</p>
                  </div>
                </div>
                <button onClick={() => setRoiResult(null)} className="text-slate-300 hover:text-slate-500"><X size={13}/></button>
              </div>

              {roiLoading && (
                <div className="px-4 py-6 text-center text-slate-400">
                  <Loader2 size={22} className="mx-auto mb-2 animate-spin text-violet-400"/>
                  <p className="text-xs">Calculating ROI and payback period…</p>
                </div>
              )}

              {roiResult && !roiLoading && (
                <div className="p-4 space-y-3">
                  {/* Key metrics row */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className={`rounded-lg p-2.5 text-center ${roiResult.breakEvenMonth ? "bg-emerald-50" : "bg-rose-50"}`}>
                      <p className="text-[9px] text-slate-500 font-medium">Break-even</p>
                      <p className={`text-sm font-black ${roiResult.breakEvenMonth ? "text-emerald-700" : "text-rose-600"}`}>
                        {roiResult.breakEvenMonth ? `Month ${roiResult.breakEvenMonth}` : ">18 mo"}
                      </p>
                    </div>
                    <div className={`rounded-lg p-2.5 text-center ${roiResult.fy26Net >= 0 ? "bg-emerald-50" : "bg-amber-50"}`}>
                      <p className="text-[9px] text-slate-500 font-medium">FY26 Net</p>
                      <p className={`text-sm font-black ${roiResult.fy26Net >= 0 ? "text-emerald-700" : "text-amber-700"}`}>
                        {roiResult.fy26Net >= 0 ? "+" : ""}{fmtAUD(roiResult.fy26Net, false)}
                      </p>
                    </div>
                    <div className="bg-indigo-50 rounded-lg p-2.5 text-center">
                      <p className="text-[9px] text-slate-500 font-medium">18-mo Net</p>
                      <p className={`text-sm font-black ${roiResult.totalRev18 - roiResult.totalCost18 >= 0 ? "text-indigo-700" : "text-rose-600"}`}>
                        {roiResult.totalRev18 - roiResult.totalCost18 >= 0 ? "+" : ""}{fmtAUD(roiResult.totalRev18 - roiResult.totalCost18, false)}
                      </p>
                    </div>
                  </div>

                  {/* Monthly cost vs revenue */}
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>Monthly cost: <span className="font-bold text-rose-600">{fmtAUD(roiResult.monthlyCost, false)}</span></span>
                    <span>Unit value: <span className="font-bold text-slate-700">${roiResult.uv}/unit</span></span>
                  </div>

                  {/* Mini sparkline — cumulative net over 18 months */}
                  <div className="h-20">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={roiResult.monthly} margin={{top:4,right:4,left:4,bottom:0}}>
                        <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#f1f5f9"/>
                        <XAxis dataKey="mo" fontSize={8} tickLine={false} axisLine={false} tickFormatter={v=>`M${v}`} interval={2}/>
                        <YAxis hide/>
                        <Tooltip formatter={(v,n)=>[fmtAUD(v,false),n]} contentStyle={{fontSize:"10px",borderRadius:"6px",border:"none",boxShadow:"0 2px 8px rgb(0 0 0/0.1)"}}/>
                        <ReferenceLine y={0} stroke="#e11d48" strokeDasharray="3 2" strokeWidth={1}/>
                        <Bar dataKey="rev" fill="#10b981" name="Revenue" opacity={0.6} barSize={6}/>
                        <Line dataKey="net" stroke="#6366f1" strokeWidth={2} dot={false} name="Cumulative Net"/>
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>

                  {/* AI verdict */}
                  {roiResult.verdict && (
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                      <p className="text-[10px] font-bold text-violet-600 mb-1.5 flex items-center gap-1">
                        <span className="w-4 h-4 rounded bg-violet-100 flex items-center justify-center text-[8px] font-black text-violet-700">AI</span>
                        Gemini Verdict
                      </p>
                      <p className="text-[11px] text-slate-600 leading-relaxed">{roiResult.verdict}</p>
                    </div>
                  )}

                  <button onClick={() => runRoiAnalysis(roiResult.roleLabel ? STAFF_ROLES.find(r=>r.label===roiResult.roleLabel)?.id || role : role, roiResult.region, roiResult.count, roiResult.startMonth)}
                    className="w-full text-[10px] text-slate-400 hover:text-violet-600 flex items-center justify-center gap-1 py-1 transition-colors">
                    <RefreshCw size={10}/>Regenerate analysis
                  </button>
                </div>
              )}
            </div>
          )}


          {/* Ramp reference card */}
          {role === "trainer" && (
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
              <h4 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-1.5">
                <Activity size={13} className="text-indigo-400"/>Trainer Ramp Schedule
              </h4>
              <div className="space-y-1">
                {[
                  {mo:"Months 1–3", units:0, note:"Onboarding / cliff"},
                  {mo:"Month 4",    units:10, note:""},
                  {mo:"Month 5",    units:25, note:""},
                  {mo:"Month 6+",   units:42, note:"Sustained capacity"},
                ].map(r => (
                  <div key={r.mo} className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 w-24">{r.mo}</span>
                    <div className="flex-1 mx-2 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-indigo-400 h-full rounded-full" style={{width: `${(r.units/42)*100}%`}}/>
                    </div>
                    <span className="font-bold text-slate-700 w-12 text-right">{r.units > 0 ? `${r.units} units` : "—"}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-2">Units spread evenly across all active courses in region.</p>
            </div>
          )}

          {role === "sales" && (
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
              <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                <TrendingUp size={13} className="text-emerald-400"/>Sales Revenue Ramp — {region}
              </h4>
              <div className="mb-3 p-2 bg-indigo-50 border border-indigo-100 rounded-lg">
                <p className="text-[10px] font-bold text-indigo-700">Target: $100,000 revenue / month</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  3-month cliff · then +21 units/month · avg {fmtAUD(regionUnitValues.get(region)||0, false)}/unit ({region})
                </p>
                <p className="text-[10px] text-indigo-600 font-semibold mt-0.5">
                  $100k target reached at month 13 · {Math.round(100000/(regionUnitValues.get(region)||471))} units/mo
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-100">
                      <th className="text-left pb-1.5 font-semibold">Month</th>
                      <th className="text-right pb-1.5 font-semibold">Units/mo</th>
                      <th className="text-right pb-1.5 font-semibold">Revenue/mo</th>
                      <th className="text-right pb-1.5 font-semibold">vs $100k</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesRampSchedule.map(r => {
                      const uv = regionUnitValues.get(region) || 0;
                      const rev = r.units * uv;
                      const pct = Math.round((rev / 100000) * 100);
                      const isTarget = pct >= 100;
                      const isCrunch = r.month <= 3;
                      return (
                        <tr key={`${r.month}-${r.units}`} className={`border-b border-slate-50 ${isTarget ? "bg-emerald-50 font-bold" : isCrunch ? "bg-slate-50/80 opacity-60" : ""}`}>
                          <td className="py-1 text-slate-600 font-mono">{r.month}</td>
                          <td className="py-1 text-right font-mono text-slate-800">
                            {r.units === 0 ? <span className="text-slate-300">—</span> : r.units}
                          </td>
                          <td className="py-1 text-right font-mono text-emerald-700">
                            {rev === 0 ? <span className="text-slate-300">—</span> : fmtAUD(rev, false)}
                          </td>
                          <td className="py-1 text-right">
                            {r.units === 0
                              ? <span className="text-slate-300 font-mono">cliff</span>
                              : <div className="flex items-center justify-end gap-1">
                                  <div className="w-10 bg-slate-100 rounded-full h-1 overflow-hidden">
                                    <div className={`h-full rounded-full ${isTarget?"bg-emerald-500":"bg-indigo-400"}`} style={{width:`${Math.min(pct,100)}%`}}/>
                                  </div>
                                  <span className={`font-mono text-[9px] ${isTarget?"text-emerald-600 font-bold":"text-slate-500"}`}>
                                    {pct}%{isTarget?" ✓":""}
                                  </span>
                                </div>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[9px] text-slate-400 mt-2">Formula: 21 × (month − 3) units from month 4. Revenue based on regional avg unit value.</p>
            </div>
          )}

          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2"><CalendarClock size={16}/>Hiring Schedule</h3>
              {hiringEvents.length > 0 && (
                <div className="flex items-center gap-2 text-[10px] flex-wrap">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"/>Predicted</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/>Hire confirmed</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"/>Departure confirmed</span>
                </div>
              )}
            </div>
            {hiringEvents.length===0?(
              <div className="text-center py-8 text-slate-400 text-xs border-2 border-dashed border-slate-100 rounded-xl">No hires planned yet</div>
            ):(
              <div className="space-y-2">
                {hiringEvents.map(ev=>{
                  const r = STAFF_ROLES.find(x=>x.id===ev.roleId);
                  const isFilled = !!ev.filled;
                  const isDep = ev.eventType === "departure";
                  const mCost = getMonthlyCost(ev.roleId) * ev.count;

                  // Card colour: confirmed=green, departure planned=red-tinted, hire planned=slate
                  const cardCls = isFilled
                    ? (isDep ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200")
                    : (isDep ? "bg-rose-50/60 border-rose-200" : "bg-slate-50 border-slate-200");

                  return (
                    <div key={ev.id} className={`p-3 rounded-lg border transition-all ${cardCls}`}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Hire/departure icon */}
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isDep?"bg-rose-100 text-rose-700":"bg-indigo-100 text-indigo-700"}`}>
                              {isDep ? "↓ Departure" : "↑ Hire"}
                            </span>
                            <span className="font-bold text-slate-800 text-xs">{ev.count}× {r?.label}</span>
                            <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-600">{ev.region}</span>
                            {isFilled
                              ? <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${isDep?"bg-red-100 text-red-700":"bg-emerald-100 text-emerald-700"}`}>
                                  {isDep ? "✓ Confirmed — actuals updated" : "✓ Confirmed — in budget"}
                                </span>
                              : <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">Predicted</span>
                            }
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {isDep ? "Last month: " : "Starts: "}{ev.startMonth}
                          </p>
                        </div>
                        <button onClick={()=>setHiringEvents(prev=>prev.filter(x=>x.id!==ev.id))} className="text-slate-400 hover:text-rose-500 ml-2 shrink-0"><Trash2 size={14}/></button>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        {isDep
                          ? <div>
                              <p className="text-xs text-emerald-700 font-medium">+{fmtAUD(mCost,false)}/mo saved</p>
                              <p className="text-[10px] text-rose-500">− revenue contribution lost</p>
                            </div>
                          : <p className="text-xs text-rose-600 font-medium">−{fmtAUD(mCost,false)}/mo cost</p>
                        }
                        {!isFilled ? (
                          <button
                            onClick={()=>setHiringEvents(prev=>prev.map(x=>x.id===ev.id?{...x,filled:true}:x))}
                            className={`flex items-center gap-1 text-white px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors ${isDep?"bg-red-600 hover:bg-red-700":"bg-emerald-600 hover:bg-emerald-700"}`}
                          >
                            {isDep ? "✓ Confirm Departure" : "✓ Confirm Hire"}
                          </button>
                        ) : (
                          <button
                            onClick={()=>setHiringEvents(prev=>prev.map(x=>x.id===ev.id?{...x,filled:false}:x))}
                            className="flex items-center gap-1 bg-slate-200 hover:bg-slate-300 text-slate-600 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors"
                          >
                            ↩ Unconfirm
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
            <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
              <h3 className="font-bold text-slate-800 text-sm">Impact Analysis</h3>
              <div className="flex items-center gap-2 text-sm">
                <select value={aStart} onChange={e=>setAStart(e.target.value)} className="border border-slate-200 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-indigo-400 outline-none">
                  {months.map(m=><option key={m}>{m}</option>)}
                </select>
                <ArrowRight size={12} className="text-slate-400"/>
                <select value={aEnd} onChange={e=>setAEnd(e.target.value)} className="border border-slate-200 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-indigo-400 outline-none">
                  {months.map(m=><option key={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                {label:"End Balance",value:fmtAUD(summary.endBalance,false),sub:`vs ${fmtAUD(summary.baseEndBalance,false)} baseline`,color:"indigo"},
                {label:"Net Impact",value:fmtAUD(summary.netImpact,false),sub:"vs Baseline",color:summary.netImpact>=0?"emerald":"rose"},
                {
                  label: summary.revDelta >= 0 ? "Revenue Added" : "Revenue Lost",
                  value: fmtAUD(Math.abs(summary.revDelta),false),
                  sub: summary.revDelta >= 0 ? "From new hires" : "From departures",
                  color: summary.revDelta >= 0 ? "green" : "rose"
                },
                {
                  label: summary.staffCostDelta >= 0 ? "Staff Cost Added" : "Wage Savings",
                  value: fmtAUD(Math.abs(summary.staffCostDelta),false),
                  sub: summary.staffCostDelta >= 0 ? "New hire payroll" : "From departures",
                  color: summary.staffCostDelta >= 0 ? "red" : "emerald"
                },
              ].map(({label,value,sub,color})=>(
                <div key={label} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[11px] font-semibold text-slate-500 mb-1">{label}</p>
                  <p className={`text-base font-bold text-${color}-700`}>{value}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 text-sm mb-4">Cash Position Impact</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={viewData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/>
                  <XAxis dataKey="month" fontSize={10} tickLine={false} axisLine={false}/>
                  <YAxis tickFormatter={v=>`$${v/1000}k`} fontSize={10} tickLine={false} axisLine={false}/>
                  <Tooltip formatter={v=>fmtAUD(v,false)}/>
                  <Legend/>
                  <Bar dataKey="projectedCashflow" name="Net Cashflow" fill="#10b981" opacity={0.3} barSize={20} radius={[4,4,0,0]}/>
                  <Line type="monotone" dataKey="baselineBalance" name="Baseline" stroke="#94a3b8" strokeWidth={2} dot={false} strokeDasharray="5 5"/>
                  <Line type="monotone" dataKey="projectedBalance" name="Projected" stroke="#6366f1" strokeWidth={3} dot={false}/>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── EXPENSES / COA ───────────────────────────────────────────────────────────
// Staffing-calculated rows — locked, derived from BUDGET_INPUTS + confirmed hires
const STAFFING_CALC_ROWS = new Set(["Gross Wages (IncPAYG)", "Superannuation", "Payroll Tax"]);

// Compute staffing-driven monthly values per FY
// Returns { "Jul": 275962, ... } for each staffing row
function calcStaffingRows(fy, filledHires = []) {
  const inflation = COST_INFLATION[fy] || 1;
  const fyMonths = MONTH_SCHEDULE.filter(m => m.fy === fy);

  // Get FY26 monthly base pattern from COA, scaled by inflation
  const baseWages   = CHART_OF_ACCOUNTS.find(ac => ac.account === "Gross Wages (IncPAYG)")?.months || {};
  const baseSuper   = CHART_OF_ACCOUNTS.find(ac => ac.account === "Superannuation")?.months || {};
  const basePayroll = CHART_OF_ACCOUNTS.find(ac => ac.account === "Payroll Tax")?.months || {};

  const result = { wages: {}, super: {}, payroll: {} };
  fyMonths.forEach(({ label, mk }) => {
    // Base = FY26 actuals × inflation
    let wages = Math.round((baseWages[mk]   || 0) * inflation);
    let sup   = Math.round((baseSuper[mk]   || 0) * inflation);
    let pt    = Math.round((basePayroll[mk] || 0) * inflation);

    // Layer in confirmed hire/departure events active by this month
    const globalIdx = ALL_MONTH_LABELS.indexOf(label);
    filledHires.forEach(ev => {
      const evStart = ALL_MONTH_LABELS.indexOf(ev.startMonth);
      if (evStart === -1 || globalIdx < evStart) return;
      const role = STAFF_ROLES.find(r => r.id === ev.roleId);
      if (!role) return;
      const gross    = (role.baseWage + role.carAllowance + role.phoneAllowance) * ev.count / 12;
      const superAmt = role.baseWage * 0.12 * ev.count / 12;
      const ptAdd    = (gross + superAmt) * 0.055;
      const sign     = ev.eventType === "departure" ? -1 : 1;
      wages += Math.round(sign * (gross + superAmt));
      sup   += Math.round(sign * superAmt);
      pt    += Math.round(sign * ptAdd);
    });
    result.wages[mk]   = wages;
    result.super[mk]   = sup;
    result.payroll[mk] = pt;
  });
  return result;
}

function ExpensesView({ data, coaAdjustments, onUpdateCoa, onSaveCoa, saving, filledHires = [] }) {
  const [activeFY, setActiveFY] = useState("FY26");
  const [activeCell, setActiveCell] = useState(null);
  const [cellValue, setCellValue] = useState("");
  const [viewMode, setViewMode] = useState("forecast"); // "forecast" | "actuals"
  const inputRef = useCallback(node => { if (node) { node.focus(); node.select(); } }, []);

  const FY_TABS = ["FY26","FY27","FY28"];
  const FY_LABELS = { FY26:"FY 2025–26", FY27:"FY 2026–27", FY28:"FY 2027–28" };

  const fyMonths = useMemo(() => MONTH_SCHEDULE.filter(m => m.fy === activeFY), [activeFY]);
  const inflation = COST_INFLATION[activeFY] || 1;

  const staffAllFY = useMemo(() => {
    const m = {};
    FY_TABS.forEach(fy => { m[fy] = calcStaffingRows(fy, filledHires); });
    return m;
  }, [filledHires]);

  const staffRows = useMemo(() => staffAllFY[activeFY], [staffAllFY, activeFY]);

  // Forecast value for a given account/month/FY
  const getValFY = useCallback((account, mk, fy) => {
    const sr = staffAllFY[fy] || {};
    const infl = COST_INFLATION[fy] || 1;
    if (account === "Gross Wages (IncPAYG)") return sr.wages?.[mk] || 0;
    if (account === "Superannuation")         return sr.super?.[mk]  || 0;
    if (account === "Payroll Tax")            return sr.payroll?.[mk] || 0;
    const key = `${fy}|${account}|${mk}`;
    if (coaAdjustments[key] !== undefined) return coaAdjustments[key];
    const base = CHART_OF_ACCOUNTS.find(ac => ac.account === account)?.months[mk] || 0;
    return Math.round(base * infl);
  }, [coaAdjustments, staffAllFY]);

  // Actual value — only available for FY26 months up to ACTUALS_CUTOFF_MK
  const getActual = useCallback((account, mk) => {
    if (!ACTUALS_FY26_MKS.has(mk)) return null; // no actual yet
    return ACTUALS_FY26[account]?.[mk] ?? null;
  }, []);

  // Convenience: forecast for active FY
  const getVal = useCallback((account, mk) => getValFY(account, mk, activeFY), [getValFY, activeFY]);

  // Is this month an actual (vs forecast) in the active FY?
  const isActualMonth = useCallback((mk) => activeFY === "FY26" && ACTUALS_FY26_MKS.has(mk), [activeFY]);

  const startEdit = (account, mk, current) => {
    if (STAFFING_CALC_ROWS.has(account)) return;
    setActiveCell({ account, mk });
    setCellValue(String(current));
  };

  const commitEdit = () => {
    if (!activeCell) return;
    const v = parseFloat(cellValue);
    if (!isNaN(v) && v >= 0) onUpdateCoa(activeFY, activeCell.account, activeCell.mk, Math.round(v));
    setActiveCell(null);
  };

  const resetRow = (account) => {
    fyMonths.forEach(({ mk }) => onUpdateCoa(activeFY, account, mk, -1));
  };

  const fmtCell = (v) => {
    if (v === 0) return "—";
    if (v < 1000) return `$${v.toLocaleString()}`;
    if (v < 10000) return `$${(v/1000).toFixed(1)}k`;
    return `$${Math.round(v/1000)}k`;
  };

  const handleKeyDown = (e, account, mk, colIdx) => {
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault(); commitEdit();
      if (e.key === "Tab") {
        const nextCol = colIdx + 1;
        if (nextCol < fyMonths.length) {
          const nm = fyMonths[nextCol].mk;
          startEdit(account, nm, getVal(account, nm));
        }
      }
    } else if (e.key === "Escape") setActiveCell(null);
  };

  // ── Per-FY totals (all three) ───────────────────────────────────────────────
  const fyTotals = useMemo(() => FY_TABS.map(fy => {
    const fym = MONTH_SCHEDULE.filter(m => m.fy === fy);
    const direct    = CHART_OF_ACCOUNTS.filter(ac => ac.section === "Direct Costs")
      .reduce((s, ac) => s + fym.reduce((ss, {mk}) => ss + getValFY(ac.account, mk, fy), 0), 0);
    const overheads = CHART_OF_ACCOUNTS.filter(ac => ac.section === "Overheads")
      .reduce((s, ac) => s + fym.reduce((ss, {mk}) => ss + getValFY(ac.account, mk, fy), 0), 0);
    return { fy, direct, overheads, total: direct + overheads };
  }), [getValFY]);

  // ── Active-FY derived totals ────────────────────────────────────────────────
  const { direct: directTotal, overheads: overheadsTotal, total } =
    fyTotals.find(f => f.fy === activeFY) || { direct: 0, overheads: 0, total: 0 };

  // ── Row totals for the active FY (for the FY-total column in the table) ────
  const rowTotals = useMemo(() =>
    CHART_OF_ACCOUNTS.map(ac => ({
      account: ac.account,
      total: fyMonths.reduce((s, {mk}) => s + getVal(ac.account, mk), 0),
      // Also compute per-FY totals for the 3-year summary row
      fy26: MONTH_SCHEDULE.filter(m=>m.fy==="FY26").reduce((s,{mk})=>s+getValFY(ac.account,mk,"FY26"),0),
      fy27: MONTH_SCHEDULE.filter(m=>m.fy==="FY27").reduce((s,{mk})=>s+getValFY(ac.account,mk,"FY27"),0),
      fy28: MONTH_SCHEDULE.filter(m=>m.fy==="FY28").reduce((s,{mk})=>s+getValFY(ac.account,mk,"FY28"),0),
    })),
  [fyMonths, getVal, getValFY]);

  // ── Chart: active-FY monthly breakdown ─────────────────────────────────────
  const chartData = useMemo(() =>
    fyMonths.map(({label, mk}) => {
      const forecast = CHART_OF_ACCOUNTS.reduce((s,ac)=>s+getVal(ac.account,mk),0);
      const hasActual = isActualMonth(mk);
      const actual = hasActual
        ? CHART_OF_ACCOUNTS.reduce((s,ac)=>{
            const a = getActual(ac.account, mk);
            return s + (a !== null ? a : getVal(ac.account, mk));
          }, 0)
        : null;
      return {
        month: label,
        Forecast: forecast,
        Actual: actual,
        Variance: actual !== null ? actual - forecast : null,
        isActual: hasActual,
        Direct:    CHART_OF_ACCOUNTS.filter(ac=>ac.section==="Direct Costs").reduce((s,ac)=>s+getVal(ac.account,mk),0),
        Overheads: CHART_OF_ACCOUNTS.filter(ac=>ac.section==="Overheads").reduce((s,ac)=>s+getVal(ac.account,mk),0),
      };
    }),
  [fyMonths, getVal, getActual, isActualMonth]);

  // ── YTD actuals summary ────────────────────────────────────────────────────
  const ytdSummary = useMemo(() => {
    if (activeFY !== "FY26") return null;
    const actualMonths = fyMonths.filter(({mk}) => isActualMonth(mk));
    const totalActual   = actualMonths.reduce((s,{mk}) =>
      s + CHART_OF_ACCOUNTS.reduce((ss,ac) => {
        const a = getActual(ac.account, mk);
        return ss + (a !== null ? a : getVal(ac.account, mk));
      }, 0), 0);
    const totalForecast = actualMonths.reduce((s,{mk}) =>
      s + CHART_OF_ACCOUNTS.reduce((ss,ac) => ss + getVal(ac.account, mk), 0), 0);
    return { totalActual, totalForecast, variance: totalActual - totalForecast, months: actualMonths.length };
  }, [activeFY, fyMonths, getActual, getVal, isActualMonth]);

  // ── Chart: 3-year monthly overview (all 36 months) ─────────────────────────
  const chart3yr = useMemo(() =>
    MONTH_SCHEDULE.map(({label, mk, fy}) => ({
      month: label,
      Direct:    CHART_OF_ACCOUNTS.filter(ac=>ac.section==="Direct Costs").reduce((s,ac)=>s+getValFY(ac.account,mk,fy),0),
      Overheads: CHART_OF_ACCOUNTS.filter(ac=>ac.section==="Overheads").reduce((s,ac)=>s+getValFY(ac.account,mk,fy),0),
      fy,
    })),
  [getValFY]);

  return (
    <div className="space-y-5">

      {/* ── 3-year summary header cards ─────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="grid grid-cols-3 gap-4 flex-1">
          {fyTotals.map(({ fy, direct, overheads, total: t }) => (
            <button key={fy} onClick={() => setActiveFY(fy)}
              className={`rounded-xl p-4 border text-left transition-all ${activeFY===fy ? "bg-rose-600 text-white border-rose-600 shadow-lg" : "bg-white border-slate-200 hover:border-rose-300"}`}>
              <p className={`text-xs font-semibold mb-1 ${activeFY===fy?"text-rose-100":"text-slate-500"}`}>{FY_LABELS[fy]}</p>
              <p className={`text-2xl font-black ${activeFY===fy?"text-white":"text-slate-800"}`}>{fmtAUD(t)}</p>
              <div className={`flex gap-3 mt-2 text-[10px] ${activeFY===fy?"text-rose-200":"text-slate-400"}`}>
                <span>Direct {fmtAUD(direct, false)}</span>
                <span>·</span>
                <span>OH {fmtAUD(overheads, false)}</span>
              </div>
              {fy !== "FY26" && (
                <p className={`text-[10px] mt-1 ${activeFY===fy?"text-rose-200":"text-slate-400"}`}>
                  +{((COST_INFLATION[fy]-1)*100).toFixed(0)}% cost inflation base
                </p>
              )}
            </button>
          ))}
        </div>
        {/* View mode toggle */}
        {activeFY === "FY26" && (
          <div className="flex flex-col gap-1">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">View</p>
            <div className="flex bg-slate-100 rounded-xl p-1 border border-slate-200">
              <button onClick={()=>setViewMode("forecast")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode==="forecast"?"bg-indigo-600 text-white shadow":"text-slate-500 hover:text-slate-700"}`}>
                Forecast
              </button>
              <button onClick={()=>setViewMode("actuals")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode==="actuals"?"bg-emerald-600 text-white shadow":"text-slate-500 hover:text-slate-700"}`}>
                Actuals vs Forecast
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── YTD Actuals vs Forecast banner (FY26 only) ──────────────────────── */}
      {activeFY === "FY26" && ytdSummary && viewMode === "actuals" && (
        <div className={`rounded-xl p-4 border flex items-center gap-6 flex-wrap ${ytdSummary.variance <= 0 ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"}`}>
          <div className="flex items-center gap-2">
            {ytdSummary.variance <= 0
              ? <span className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-sm font-bold">↓</span>
              : <span className="w-8 h-8 rounded-full bg-rose-500 flex items-center justify-center text-white text-sm font-bold">↑</span>
            }
            <div>
              <p className="text-xs font-bold text-slate-700">YTD Actuals vs Forecast</p>
              <p className="text-[10px] text-slate-500">{ytdSummary.months} months of Xero actuals (Jul-25 to Feb-26)</p>
            </div>
          </div>
          <div className="flex gap-6">
            <div>
              <p className="text-[10px] text-slate-500">Actual Spend</p>
              <p className="text-base font-black text-slate-800">{fmtAUD(ytdSummary.totalActual)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500">Forecast Spend</p>
              <p className="text-base font-black text-slate-600">{fmtAUD(ytdSummary.totalForecast)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500">Variance</p>
              <p className={`text-base font-black ${ytdSummary.variance <= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {ytdSummary.variance <= 0 ? "−" : "+"}{fmtAUD(Math.abs(ytdSummary.variance))}
                <span className="text-[10px] ml-1 font-normal">
                  {ytdSummary.variance <= 0 ? "under budget ✓" : "over budget"}
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── KPI cards for selected FY ────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <StatsCard title="Total Expenses"    value={fmtAUD(total)}          trend={FY_LABELS[activeFY]}          icon={DollarSign} color="bg-rose-500"/>
        <StatsCard title="Direct Costs"      value={fmtAUD(directTotal)}    trend="Wages, Super, Resources"      icon={Users}      color="bg-orange-500"/>
        <StatsCard title="Overheads"         value={fmtAUD(overheadsTotal)} trend="Rent, IT, Travel, etc"        icon={MapPin}     color="bg-amber-500"/>
      </div>

      {/* ── 3-year overview chart ────────────────────────────────────────────── */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <h3 className="text-sm font-bold text-slate-800 mb-1">3-Year Expense Overview — Jul 2025 to Jun 2028</h3>
        <p className="text-[10px] text-slate-400 mb-4">All 36 months · FY boundaries shown · click FY card above to edit that year</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart3yr} barCategoryGap="15%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/>
              <XAxis dataKey="month" fontSize={9} tickLine={false} axisLine={false}
                tick={({x,y,payload,index}) => {
                  const m = chart3yr[index];
                  const isFYStart = m?.mk === "Jul";
                  return (
                    <g transform={`translate(${x},${y})`}>
                      {isFYStart && <line y1={-200} y2={0} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3"/>}
                      <text x={0} y={0} dy={12} textAnchor="middle" fontSize={9}
                        fill={isFYStart ? "#6366f1" : "#94a3b8"} fontWeight={isFYStart?"700":"400"}>
                        {payload.value}
                      </text>
                    </g>
                  );
                }}
              />
              <YAxis tickFormatter={v=>`$${(v/1000).toFixed(0)}k`} fontSize={10} tickLine={false} axisLine={false}/>
              <Tooltip formatter={(v,n)=>[fmtAUD(v,false),n]} contentStyle={{borderRadius:"8px",border:"none",boxShadow:"0 4px 6px -1px rgb(0 0 0/0.1)"}}
                labelFormatter={l => {
                  const m = chart3yr.find(c=>c.month===l);
                  return `${l} (${FY_LABELS[m?.fy]||m?.fy||""})`;
                }}
              />
              <Legend iconSize={8}/>
              <Bar dataKey="Direct"    stackId="a" fill="#f97316" name="Direct Costs"/>
              <Bar dataKey="Overheads" stackId="a" fill="#e11d48" name="Overheads" radius={[3,3,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Selected-FY monthly breakdown chart ─────────────────────────────── */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-800">
            Monthly Breakdown — {FY_LABELS[activeFY]}
            {viewMode === "actuals" && activeFY === "FY26" && (
              <span className="ml-2 text-[10px] font-normal text-slate-400">Solid = Actual · Outline = Forecast</span>
            )}
          </h3>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            {viewMode === "actuals" && activeFY === "FY26" ? (
              <ComposedChart data={chartData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/>
                <XAxis dataKey="month" fontSize={10} tickLine={false} axisLine={false}/>
                <YAxis tickFormatter={v=>`$${(v/1000).toFixed(0)}k`} fontSize={10} tickLine={false} axisLine={false}/>
                <Tooltip formatter={(v,n)=>[fmtAUD(v,false), n]} contentStyle={{borderRadius:"8px",border:"none",boxShadow:"0 4px 6px -1px rgb(0 0 0/0.1)"}}/>
                <Legend iconSize={8}/>
                <Bar dataKey="Forecast" fill="#94a3b8" name="Forecast" opacity={0.5} radius={[3,3,0,0]}/>
                <Bar dataKey="Actual"   fill="#10b981" name="Actual"   radius={[3,3,0,0]}/>
                <Line dataKey="Variance" stroke="#f43f5e" strokeWidth={2} dot={{r:3,fill:"#f43f5e"}} name="Variance (Actual−Forecast)" strokeDasharray="4 2"/>
              </ComposedChart>
            ) : (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/>
                <XAxis dataKey="month" fontSize={10} tickLine={false} axisLine={false}/>
                <YAxis tickFormatter={v=>`$${v/1000}k`} fontSize={10} tickLine={false} axisLine={false}/>
                <Tooltip formatter={v=>fmtAUD(v,false)}/>
                <Legend/>
                <Bar dataKey="Direct" stackId="a" fill="#f97316" name="Direct Costs"/>
                <Bar dataKey="Overheads" stackId="a" fill="#e11d48" name="Overheads" radius={[4,4,0,0]}/>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Chart of Accounts — editable per-FY view ─────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Chart of Accounts — {FY_LABELS[activeFY]}</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              🔒 Wages, Super & Payroll Tax auto-calculated from staffing · Click any other cell to edit
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* FY tab switcher inside COA */}
            <div className="flex bg-slate-200 rounded-lg p-0.5">
              {FY_TABS.map(fy => (
                <button key={fy} onClick={() => setActiveFY(fy)}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${activeFY===fy?"bg-rose-600 text-white shadow":"text-slate-500 hover:text-slate-700"}`}>
                  {fy}
                </button>
              ))}
            </div>
            {activeFY !== "FY26" && (
              <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                +{((COST_INFLATION[activeFY]-1)*100).toFixed(0)}% inflation base
              </span>
            )}
            <button onClick={onSaveCoa}
              className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
              <Database size={12}/>{saving ? "Saving…" : "Save COA"}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="px-4 py-3 text-left font-semibold sticky left-0 bg-slate-800 z-10 border-r border-slate-700 min-w-[110px]">Section</th>
                <th className="px-4 py-3 text-left font-semibold border-r border-slate-700 min-w-[170px]">Account</th>
                {fyMonths.map(({ label, mk }) => {
                  const isActual = isActualMonth(mk) && viewMode === "actuals";
                  return (
                    <th key={label} className={`px-3 py-3 text-center font-semibold whitespace-nowrap border-r border-slate-700 ${isActual ? "min-w-[110px] bg-emerald-900" : "min-w-[72px]"}`}>
                      <div>{label}</div>
                      {isActual && <div className="text-[9px] font-normal text-emerald-300 mt-0.5">A vs F</div>}
                    </th>
                  );
                })}
                <th className="px-4 py-3 text-right font-semibold bg-slate-900 min-w-[90px]">{activeFY} Total</th>
                {viewMode === "actuals" && activeFY === "FY26" && (
                  <th className="px-4 py-3 text-right font-semibold bg-emerald-900 min-w-[90px]">YTD Variance</th>
                )}
                <th className="px-4 py-3 text-right font-semibold bg-indigo-900 min-w-[90px]">FY26</th>
                <th className="px-4 py-3 text-right font-semibold bg-indigo-900 min-w-[90px]">FY27</th>
                <th className="px-4 py-3 text-right font-semibold bg-indigo-900 min-w-[90px]">FY28</th>
              </tr>
            </thead>
            <tbody>
              {["Direct Costs","Overheads"].map(section => {
                const rows = CHART_OF_ACCOUNTS.filter(ac => ac.section === section);
                return [
                  <tr key={`hdr-${section}`} className="bg-slate-700">
                    <td colSpan={fyMonths.length + 6} className="px-4 py-1.5 text-xs font-bold text-slate-200 uppercase tracking-widest">
                      {section}
                    </td>
                  </tr>,
                  ...rows.map((ac) => {
                    const isLocked = STAFFING_CALC_ROWS.has(ac.account);
                    const rt = rowTotals.find(r => r.account === ac.account) || {};
                    const hasEdits = !isLocked && fyMonths.some(({mk}) => coaAdjustments[`${activeFY}|${ac.account}|${mk}`] !== undefined);
                    return (
                      <tr key={ac.account} className={`border-b border-slate-100 group ${isLocked ? "bg-slate-50/60" : section==="Direct Costs" ? "bg-orange-50/10" : ""}`}>
                        <td className="px-4 py-2 text-slate-400 text-[10px] sticky left-0 bg-inherit border-r border-slate-100">{ac.section}</td>
                        <td className="px-4 py-2 font-medium text-slate-700 whitespace-nowrap border-r border-slate-100">
                          <div className="flex items-center gap-1.5">
                            {isLocked
                              ? <span title="Auto-calculated from staffing" className="text-slate-400 text-[10px]">🔒</span>
                              : hasEdits
                                ? <button onClick={() => resetRow(ac.account)} title="Reset to default" className="text-blue-400 hover:text-rose-500 text-[10px] font-bold">↺</button>
                                : <span className="w-3"/>
                            }
                            {ac.account}
                            {isLocked && <span className="text-[9px] text-slate-400 ml-1">auto</span>}
                          </div>
                        </td>
                        {fyMonths.map(({ mk, label }, colIdx) => {
                          const forecastVal = getVal(ac.account, mk);
                          const actualVal   = getActual(ac.account, mk);
                          const showActual  = viewMode === "actuals" && isActualMonth(mk) && actualVal !== null;
                          const displayVal  = forecastVal;
                          const isActive    = activeCell?.account === ac.account && activeCell?.mk === mk;
                          const isEdited    = !isLocked && coaAdjustments[`${activeFY}|${ac.account}|${mk}`] !== undefined;
                          const variance    = showActual ? actualVal - forecastVal : null;
                          const varPct      = forecastVal > 0 && variance !== null ? (variance / forecastVal * 100) : null;
                          return (
                            <td key={label}
                              onClick={() => !showActual && !isLocked && !isActive && startEdit(ac.account, mk, displayVal)}
                              title={showActual ? `Actual: $${actualVal?.toLocaleString()} | Forecast: $${forecastVal.toLocaleString()}` : (forecastVal > 0 ? `$${forecastVal.toLocaleString()}` : undefined)}
                              className={`px-1 border-r border-slate-100 text-center
                                ${showActual ? "py-1 bg-emerald-50/40 cursor-default min-w-[110px]" : isLocked ? "py-1 cursor-default" : "py-1 cursor-pointer hover:bg-indigo-50"}
                                ${isActive ? "bg-rose-50 ring-2 ring-inset ring-rose-400" : ""}
                                ${isEdited && !showActual ? "bg-blue-50/60" : ""}
                              `}
                            >
                              {showActual ? (
                                // Actuals vs Forecast cell — stacked display
                                <div className="py-1 space-y-0.5">
                                  {/* Actual row */}
                                  <div className="flex items-center justify-between gap-1 px-1">
                                    <span className="text-[9px] text-emerald-600 font-semibold">A</span>
                                    <span className="font-mono text-xs font-bold text-emerald-700">{fmtCell(actualVal)}</span>
                                  </div>
                                  {/* Forecast row */}
                                  <div className="flex items-center justify-between gap-1 px-1">
                                    <span className="text-[9px] text-slate-400 font-semibold">F</span>
                                    <span className="font-mono text-[10px] text-slate-400">{fmtCell(forecastVal)}</span>
                                  </div>
                                  {/* Variance */}
                                  {variance !== null && forecastVal > 0 && (
                                    <div className={`text-[9px] font-bold px-1 rounded text-center ${variance > 0 ? "text-rose-600 bg-rose-50" : variance < 0 ? "text-emerald-600 bg-emerald-50" : "text-slate-400"}`}>
                                      {variance > 0 ? "+" : ""}{fmtCell(variance)}
                                      {varPct !== null && <span className="ml-0.5 opacity-70">({varPct > 0 ? "+" : ""}{varPct.toFixed(0)}%)</span>}
                                    </div>
                                  )}
                                </div>
                              ) : isActive ? (
                                <input ref={inputRef} type="number" min="0"
                                  value={cellValue}
                                  onChange={e => setCellValue(e.target.value)}
                                  onBlur={commitEdit}
                                  onKeyDown={e => handleKeyDown(e, ac.account, mk, colIdx)}
                                  className="w-full text-center bg-transparent outline-none font-bold text-rose-700 text-xs py-1"
                                />
                              ) : (
                                <span className={`font-mono text-xs block py-1.5
                                  ${isLocked ? "text-slate-600 font-semibold" : displayVal > 0 ? "text-slate-600" : "text-slate-300"}
                                  ${isEdited ? "text-indigo-700 font-bold" : ""}
                                `}>{fmtCell(displayVal)}</span>
                              )}
                            </td>
                          );
                        })}
                        {/* FY total (active year) */}
                        <td className="px-3 py-2 text-right font-bold border-l-2 border-slate-300 bg-slate-50 whitespace-nowrap">
                          <span className={isLocked ? "text-slate-600" : "text-rose-600"}>{fmtAUD(rt.total||0, false)}</span>
                          {hasEdits && <span className="ml-1 text-[9px] text-indigo-500">✎</span>}
                        </td>
                        {/* YTD variance column */}
                        {viewMode === "actuals" && activeFY === "FY26" && (() => {
                          const actualMks = ["Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb"];
                          const ytdActual   = actualMks.reduce((s,mk) => s + (ACTUALS_FY26[ac.account]?.[mk] ?? getValFY(ac.account, mk, "FY26")), 0);
                          const ytdForecast = actualMks.reduce((s,mk) => s + getValFY(ac.account, mk, "FY26"), 0);
                          const ytdVar = ytdActual - ytdForecast;
                          const ytdPct = ytdForecast > 0 ? (ytdVar / ytdForecast * 100) : 0;
                          return (
                            <td className={`px-3 py-2 text-right font-bold border-l-2 border-emerald-200 whitespace-nowrap ${ytdVar < 0 ? "bg-emerald-50 text-emerald-700" : ytdVar > 0 ? "bg-rose-50 text-rose-700" : "bg-slate-50 text-slate-500"}`}>
                              <div className="font-mono text-xs">{ytdVar >= 0 ? "+" : ""}{fmtCell(ytdVar)}</div>
                              <div className="text-[9px] opacity-70">{ytdPct >= 0 ? "+" : ""}{ytdPct.toFixed(0)}%</div>
                            </td>
                          );
                        })()}
                        {/* 3-year breakdown columns */}
                        <td className={`px-3 py-2 text-right font-mono border-l border-indigo-100 ${activeFY==="FY26"?"bg-indigo-50/60 font-bold text-indigo-700":"text-slate-400 bg-indigo-50/20"}`}>
                          {fmtCell(rt.fy26||0)}
                        </td>
                        <td className={`px-3 py-2 text-right font-mono border-l border-indigo-100 ${activeFY==="FY27"?"bg-indigo-50/60 font-bold text-indigo-700":"text-slate-400 bg-indigo-50/20"}`}>
                          {fmtCell(rt.fy27||0)}
                        </td>
                        <td className={`px-3 py-2 text-right font-mono border-l border-indigo-100 ${activeFY==="FY28"?"bg-indigo-50/60 font-bold text-indigo-700":"text-slate-400 bg-indigo-50/20"}`}>
                          {fmtCell(rt.fy28||0)}
                        </td>
                      </tr>
                    );
                  })
                ];
              })}
            </tbody>
            <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-bold text-xs">
              <tr>
                <td colSpan={2} className="px-4 py-3 font-bold text-slate-700 sticky left-0 bg-slate-100">Total</td>
                {fyMonths.map(({ mk, label }) => {
                  const t = CHART_OF_ACCOUNTS.reduce((s, ac) => s + getVal(ac.account, mk), 0);
                  return <td key={label} className="px-3 py-3 text-center font-bold text-slate-700 font-mono">${(t/1000).toFixed(0)}k</td>;
                })}
                <td className="px-3 py-3 text-right font-bold text-slate-800 border-l-2 border-slate-300">{fmtAUD(total, false)}</td>
                {FY_TABS.map(fy => (
                  <td key={fy} className={`px-3 py-3 text-right font-bold border-l border-indigo-200 ${activeFY===fy?"text-indigo-700 bg-indigo-100":"text-slate-500"}`}>
                    {fmtAUD(fyTotals.find(f=>f.fy===fy)?.total||0, false)}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 flex items-center gap-4 flex-wrap">
          <span>🔒 = auto from staffing</span>
          <span className="text-indigo-600 font-semibold">■ = manually edited (✎ in total)</span>
          <span className="text-indigo-500">↺ = reset year to defaults</span>
          <span><strong>Click</strong> any editable cell · <strong>Tab</strong> = next month · <strong>Enter / Esc</strong> = done</span>
          <span className="ml-auto text-indigo-400 font-semibold">FY26 · FY27 · FY28 columns show 3-year totals per row</span>
        </div>
      </div>
    </div>
  );
}

// ─── CRM SALES REPORT ─────────────────────────────────────────────────────────
// Default CRM data (from exported sales report — can be replaced via upload)
const CRM_DEFAULT_DATA = [
  {year:2022,month:"January",pipeline:196980,closedWon:196980},
  {year:2022,month:"February",pipeline:336300,closedWon:336300},
  {year:2022,month:"March",pipeline:352150,closedWon:352650},
  {year:2022,month:"April",pipeline:304951,closedWon:303001},
  {year:2022,month:"May",pipeline:253375,closedWon:254575},
  {year:2022,month:"June",pipeline:463400,closedWon:463400},
  {year:2022,month:"July",pipeline:444245,closedWon:444245},
  {year:2022,month:"August",pipeline:530225,closedWon:530225},
  {year:2022,month:"September",pipeline:499300,closedWon:499300},
  {year:2022,month:"October",pipeline:305700,closedWon:305700},
  {year:2022,month:"November",pipeline:265350,closedWon:265350},
  {year:2022,month:"December",pipeline:221975,closedWon:221975},
  {year:2023,month:"January",pipeline:214100,closedWon:214100},
  {year:2023,month:"February",pipeline:329500,closedWon:329500},
  {year:2023,month:"March",pipeline:476050,closedWon:476050},
  {year:2023,month:"April",pipeline:407725,closedWon:407725},
  {year:2023,month:"May",pipeline:603500,closedWon:538500},
  {year:2023,month:"June",pipeline:528350,closedWon:521600},
  {year:2023,month:"July",pipeline:462500,closedWon:462500},
  {year:2023,month:"August",pipeline:509125,closedWon:494325},
  {year:2023,month:"September",pipeline:566247.5,closedWon:546725},
  {year:2023,month:"October",pipeline:268025,closedWon:269025},
  {year:2023,month:"November",pipeline:218925,closedWon:218925},
  {year:2023,month:"December",pipeline:190400,closedWon:182400},
  {year:2024,month:"January",pipeline:101550,closedWon:99050},
  {year:2024,month:"February",pipeline:313800,closedWon:305100},
  {year:2024,month:"March",pipeline:274275,closedWon:262375},
  {year:2024,month:"April",pipeline:347630,closedWon:340600},
  {year:2024,month:"May",pipeline:397375,closedWon:379275},
  {year:2024,month:"June",pipeline:240274,closedWon:223784},
  {year:2024,month:"July",pipeline:335525,closedWon:330125},
  {year:2024,month:"August",pipeline:298625,closedWon:288625},
  {year:2024,month:"September",pipeline:321150,closedWon:311250},
  {year:2024,month:"October",pipeline:288050,closedWon:245320},
  {year:2024,month:"November",pipeline:245515,closedWon:233550},
  {year:2024,month:"December",pipeline:243870,closedWon:241170},
  {year:2025,month:"January",pipeline:375022,closedWon:373647},
  {year:2025,month:"February",pipeline:235791,closedWon:230751},
  {year:2025,month:"March",pipeline:272698,closedWon:269626},
  {year:2025,month:"April",pipeline:167271,closedWon:147823},
  {year:2025,month:"May",pipeline:175277,closedWon:169473},
  {year:2025,month:"June",pipeline:301650.5,closedWon:240860},
  {year:2025,month:"July",pipeline:285283,closedWon:285283},
  {year:2025,month:"August",pipeline:202637,closedWon:193037},
  {year:2025,month:"September",pipeline:234985,closedWon:208838},
  {year:2025,month:"October",pipeline:401501.2,closedWon:372448},
  {year:2025,month:"November",pipeline:216095.2,closedWon:201849},
  {year:2025,month:"December",pipeline:160351,closedWon:147223},
  {year:2026,month:"January",pipeline:172166,closedWon:170906},
  {year:2026,month:"February",pipeline:184436.5,closedWon:161101},
  {year:2026,month:"March",pipeline:5987.5,closedWon:null},
  {year:2026,month:"April",pipeline:null,closedWon:null},
];

const CRM_MONTH_ORDER = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// Parse uploaded XLSX bytes → array of {year, month, pipeline, closedWon}
async function parseCRMXlsx(arrayBuffer) {
  // Use SheetJS via CDN (loaded dynamically if needed)
  // We'll use a simple binary parser approach via FileReader
  return new Promise((resolve, reject) => {
    try {
      // Try to use XLSX if available globally
      if (typeof XLSX !== "undefined") {
        const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
        // Find header row
        const headerIdx = rows.findIndex(r => r && r[0] && String(r[0]).includes("Year"));
        if (headerIdx === -1) { reject(new Error("Could not find header row")); return; }
        const data = [];
        for (let i = headerIdx + 1; i < rows.length; i++) {
          const r = rows[i];
          if (!r || !r[0] || !r[1] || r[0] === "Total" || typeof r[0] !== "number") continue;
          data.push({
            year: Number(r[0]),
            month: String(r[1]),
            pipeline: r[2] ? Number(r[2]) : null,
            closedWon: r[4] ? Number(r[4]) : null,
          });
        }
        resolve(data);
      } else {
        reject(new Error("XLSX library not available"));
      }
    } catch(e) { reject(e); }
  });
}

function CRMSalesReport({ data }) {
  const [crmData, setCrmData] = useState(CRM_DEFAULT_DATA);
  const [fileName, setFileName] = useState("data_6.xlsx (default)");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [viewFY, setViewFY] = useState("FY26");
  const [unitRegion, setUnitRegion] = useState("QLD");
  const fileInputRef = useCallback(n => n, []);

  const FY_DEFS = {
    FY24: {label:"FY 2023–24", months:[{y:2023,m:"July"},{y:2023,m:"August"},{y:2023,m:"September"},{y:2023,m:"October"},{y:2023,m:"November"},{y:2023,m:"December"},{y:2024,m:"January"},{y:2024,m:"February"},{y:2024,m:"March"},{y:2024,m:"April"},{y:2024,m:"May"},{y:2024,m:"June"}]},
    FY25: {label:"FY 2024–25", months:[{y:2024,m:"July"},{y:2024,m:"August"},{y:2024,m:"September"},{y:2024,m:"October"},{y:2024,m:"November"},{y:2024,m:"December"},{y:2025,m:"January"},{y:2025,m:"February"},{y:2025,m:"March"},{y:2025,m:"April"},{y:2025,m:"May"},{y:2025,m:"June"}]},
    FY26: {label:"FY 2025–26", months:[{y:2025,m:"July"},{y:2025,m:"August"},{y:2025,m:"September"},{y:2025,m:"October"},{y:2025,m:"November"},{y:2025,m:"December"},{y:2026,m:"January"},{y:2026,m:"February"},{y:2026,m:"March"},{y:2026,m:"April"},{y:2026,m:"May"},{y:2026,m:"June"}]},
  };

  // Get avg unit value for selected region from UNIT_ASSUMPTIONS_FY26
  const avgUnitValue = useMemo(() => {
    const EXCL = new Set(["MSL20122","FFS"]);
    const courses = UNIT_ASSUMPTIONS_FY26[unitRegion];
    if (!courses) return 471;
    const prices = Object.entries(courses).filter(([c]) => !EXCL.has(c)).map(([,v]) => v.price);
    return prices.length ? prices.reduce((s,p) => s+p, 0) / prices.length : 471;
  }, [unitRegion]);

  // Build lookup map for CRM data
  const crmLookup = useMemo(() => {
    const m = new Map();
    crmData.forEach(r => m.set(`${r.year}-${r.month}`, r));
    return m;
  }, [crmData]);

  // Build chart/table rows for selected FY
  // Benchmark: model forecast uses 21-unit ramp from Staff Planner
  // month_index within the FY (1-based) determines ramp position
  // But CRM is org-wide revenue, not per-salesperson — so benchmark = total model revenue
  // from Unit Modeler for that FY month
  const fyRows = useMemo(() => {
    const fyDef = FY_DEFS[viewFY];
    if (!fyDef) return [];

    // Get model revenue from data.operationalFinancials for FY months
    const opFin = data.operationalFinancials;
    const regions = data.regions;

    return fyDef.months.map(({y, m}, idx) => {
      const label = m.substring(0,3) + "-" + String(y).slice(2);
      const crm = crmLookup.get(`${y}-${m}`);
      const closedWon = crm?.closedWon ?? null;
      const pipelineForecast = crm?.pipeline ?? null;

      // Model forecast revenue = sum of all regions for this month from unit modeler
      const opMonth = opFin.find(op => op.month === label);
      const modelRevenue = opMonth
        ? regions.reduce((s, r) => {
            const md = r.monthlyData.find(d => d.month === label);
            return s + (md?.revenue || 0);
          }, 0)
        : null;

      // Sales ramp benchmark: 21-unit ramp per salesperson × avg unit value
      // mo = idx (0-based), matching the getSalesUnits formula
      const rampUnits = idx < 3 ? 0 : 21 * (idx - 3 + 1);
      const rampRevenue = rampUnits * avgUnitValue; // per-salesperson benchmark

      // Units conversion from CRM dollars
      const actualUnits = closedWon != null ? Math.round(closedWon / avgUnitValue) : null;
      const pipelineUnits = pipelineForecast != null ? Math.round(pipelineForecast / avgUnitValue) : null;
      const modelUnits = modelRevenue != null ? Math.round(modelRevenue / avgUnitValue) : null;

      // Variance: actual vs model
      const revenueVariance = (closedWon != null && modelRevenue != null) ? closedWon - modelRevenue : null;
      const unitVariance = (actualUnits != null && modelUnits != null) ? actualUnits - modelUnits : null;
      const vsRamp = closedWon != null ? closedWon - rampRevenue : null;

      return {
        label, month: m, year: y, idx,
        closedWon, pipelineForecast, modelRevenue, rampRevenue,
        actualUnits, pipelineUnits, modelUnits, rampUnits,
        revenueVariance, unitVariance, vsRamp,
        hasData: closedWon != null || pipelineForecast != null,
      };
    });
  }, [viewFY, crmLookup, data, avgUnitValue]);

  // Summary stats for selected FY
  const summary = useMemo(() => {
    const withData = fyRows.filter(r => r.closedWon != null);
    const totalActual = withData.reduce((s,r) => s + r.closedWon, 0);
    const totalModel = fyRows.filter(r => r.modelRevenue != null).reduce((s,r) => s + (r.modelRevenue||0), 0);
    const totalPipeline = fyRows.filter(r => r.pipelineForecast != null).reduce((s,r) => s + r.pipelineForecast, 0);
    const totalActualUnits = withData.reduce((s,r) => s + (r.actualUnits||0), 0);
    const totalModelUnits = fyRows.reduce((s,r) => s + (r.modelUnits||0), 0);
    const avgVariancePct = withData.length > 0
      ? withData.reduce((s,r) => s + (r.revenueVariance != null && r.modelRevenue ? r.revenueVariance/r.modelRevenue : 0), 0) / withData.length * 100
      : 0;
    return { totalActual, totalModel, totalPipeline, totalActualUnits, totalModelUnits, avgVariancePct, monthsWithData: withData.length };
  }, [fyRows]);

  // Chart data
  const chartData = useMemo(() => fyRows.map(r => ({
    month: r.label,
    "Closed Won": r.closedWon ? Math.round(r.closedWon) : null,
    "Pipeline": r.pipelineForecast ? Math.round(r.pipelineForecast) : null,
    "Model Forecast": r.modelRevenue ? Math.round(r.modelRevenue) : null,
    "Ramp Benchmark": Math.round(r.rampRevenue),
  })), [fyRows]);

  const unitChartData = useMemo(() => fyRows.map(r => ({
    month: r.label,
    "Actual Units": r.actualUnits,
    "Model Units": r.modelUnits,
    "Ramp Benchmark": r.rampUnits || null,
  })), [fyRows]);

  // Handle file upload
  const processFile = async (file) => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const buf = await file.arrayBuffer();
      const parsed = await parseCRMXlsx(buf);
      if (parsed.length === 0) throw new Error("No data rows found in file");
      setCrmData(parsed);
      setFileName(file.name);
    } catch(e) {
      setUploadError(`Parse error: ${e.message}. Ensure the file matches the CRM export format.`);
    }
    setUploading(false);
  };

  const onFileInput = (e) => { if (e.target.files[0]) processFile(e.target.files[0]); };
  const onDrop = (e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]); };

  const regions = Object.keys(UNIT_ASSUMPTIONS_FY26);

  return (
    <div className="space-y-5">
      {/* Header + upload */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <BarChart2 size={18} className="text-violet-500"/>CRM Sales Report
            </h2>
            <p className="text-xs text-slate-500 mt-1">Actuals vs model forecast — upload your CRM export to refresh</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Region selector for unit conversion */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-500">Unit value region:</label>
              <select value={unitRegion} onChange={e => setUnitRegion(e.target.value)}
                className="border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white focus:ring-2 focus:ring-violet-400 outline-none">
                {regions.map(r => <option key={r}>{r}</option>)}
              </select>
              <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded">
                avg {fmtAUD(avgUnitValue, false)}/unit
              </span>
            </div>
            {/* FY selector */}
            <div className="flex bg-slate-100 rounded-lg p-0.5">
              {Object.entries(FY_DEFS).map(([fy, {label}]) => (
                <button key={fy} onClick={() => setViewFY(fy)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${viewFY===fy?"bg-violet-600 text-white shadow":"text-slate-500 hover:text-slate-700"}`}>
                  {fy}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Upload zone */}
        <div
          onDragOver={e => {e.preventDefault(); setDragOver(true);}}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`mt-4 border-2 border-dashed rounded-xl p-4 flex items-center gap-3 cursor-pointer transition-all ${dragOver?"border-violet-400 bg-violet-50":"border-slate-200 hover:border-violet-300 hover:bg-slate-50"}`}
          onClick={() => document.getElementById("crm-file-input").click()}
        >
          <input id="crm-file-input" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFileInput}/>
          {uploading
            ? <Loader2 size={18} className="text-violet-500 animate-spin shrink-0"/>
            : <Upload size={18} className="text-violet-400 shrink-0"/>
          }
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-700 truncate">{uploading ? "Parsing file…" : fileName}</p>
            <p className="text-[10px] text-slate-400">Drop a new CRM export (.xlsx) here or click to browse · columns: Date-Year, Date-Month, Pipeline Forecast $, _, Closed Won $</p>
          </div>
          {!uploading && <span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-semibold shrink-0">Replace data</span>}
        </div>
        {uploadError && <p className="mt-2 text-xs text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg">{uploadError}</p>}
      </div>

      {/* Summary KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Closed Won Revenue",
            value: fmtAUD(summary.totalActual, false),
            sub: `${summary.monthsWithData} months of actuals`,
            icon: DollarSign, color: "bg-violet-500",
          },
          {
            label: "Model Forecast",
            value: fmtAUD(summary.totalModel, false),
            sub: "From Unit Modeler",
            icon: Target, color: "bg-indigo-500",
          },
          {
            label: "vs Model (Revenue)",
            value: `${summary.totalActual >= summary.totalModel ? "+" : ""}${fmtAUD(summary.totalActual - summary.totalModel, false)}`,
            sub: `Avg ${summary.avgVariancePct >= 0 ? "+" : ""}${summary.avgVariancePct.toFixed(1)}%/month`,
            icon: summary.totalActual >= summary.totalModel ? TrendingUp : TrendingDown,
            color: summary.totalActual >= summary.totalModel ? "bg-emerald-500" : "bg-rose-500",
          },
          {
            label: "Actual Units",
            value: summary.totalActualUnits.toLocaleString(),
            sub: `Model: ${summary.totalModelUnits.toLocaleString()} units`,
            icon: Box, color: "bg-amber-500",
          },
        ].map(({label, value, sub, icon: Icon, color}) => (
          <div key={label} className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex items-start gap-4">
            <div className={`p-3 rounded-xl ${color} text-white shrink-0`}><Icon size={20}/></div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">{label}</p>
              <p className="text-xl font-bold text-slate-800 mt-1">{value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Revenue comparison chart */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-sm font-bold text-slate-800">Revenue: Actuals vs Forecast vs Model — {FY_DEFS[viewFY]?.label}</h3>
          <div className="flex items-center gap-4 text-[10px] flex-wrap">
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-violet-600 inline-block rounded"/>Closed Won</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-400 inline-block rounded border-dashed border border-amber-400"/>Pipeline</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-indigo-500 inline-block rounded"/>Model</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-slate-300 inline-block rounded border-dashed border border-slate-400"/>21-unit Ramp</span>
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{top:4,right:4,bottom:0,left:0}}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/>
              <XAxis dataKey="month" fontSize={10} tickLine={false} axisLine={false}/>
              <YAxis tickFormatter={v=>`$${(v/1000).toFixed(0)}k`} fontSize={10} tickLine={false} axisLine={false}/>
              <Tooltip formatter={(v,n) => [v ? fmtAUD(v,false) : "—", n]} contentStyle={{borderRadius:"8px",border:"none",boxShadow:"0 4px 6px -1px rgb(0 0 0/0.1)"}}/>
              <Legend iconType="circle" wrapperStyle={{paddingTop:"10px"}} iconSize={8}/>
              <Bar dataKey="Closed Won" fill="#7c3aed" opacity={0.85} radius={[3,3,0,0]} barSize={16}/>
              <Line dataKey="Pipeline" stroke="#f59e0b" strokeWidth={2} dot={{r:3}} strokeDasharray="5 3" connectNulls/>
              <Line dataKey="Model Forecast" stroke="#4f46e5" strokeWidth={2.5} dot={false}/>
              <Line dataKey="Ramp Benchmark" stroke="#cbd5e1" strokeWidth={1.5} dot={false} strokeDasharray="4 4"/>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Units comparison chart */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Units: Actuals vs Model vs 21-Unit Ramp Benchmark</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">CRM revenue ÷ {fmtAUD(avgUnitValue, false)} avg unit value ({unitRegion})</p>
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={unitChartData} margin={{top:4,right:4,bottom:0,left:0}}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/>
              <XAxis dataKey="month" fontSize={10} tickLine={false} axisLine={false}/>
              <YAxis fontSize={10} tickLine={false} axisLine={false}/>
              <Tooltip contentStyle={{borderRadius:"8px",border:"none",boxShadow:"0 4px 6px -1px rgb(0 0 0/0.1)"}}/>
              <Legend iconType="circle" wrapperStyle={{paddingTop:"10px"}} iconSize={8}/>
              <Bar dataKey="Actual Units" fill="#7c3aed" opacity={0.85} radius={[3,3,0,0]} barSize={16}/>
              <Line dataKey="Model Units" stroke="#4f46e5" strokeWidth={2.5} dot={false}/>
              <Line dataKey="Ramp Benchmark" stroke="#f59e0b" strokeWidth={2} dot={{r:2}} strokeDasharray="5 3"/>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly breakdown table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">Monthly Breakdown — {FY_DEFS[viewFY]?.label}</h3>
          <span className="text-[10px] text-slate-400">Unit value: {fmtAUD(avgUnitValue, false)} ({unitRegion})</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Month</th>
                <th className="px-4 py-3 text-right font-semibold text-violet-300">Closed Won $</th>
                <th className="px-4 py-3 text-right font-semibold text-violet-300">Actual Units</th>
                <th className="px-4 py-3 text-right font-semibold text-amber-300">Pipeline $</th>
                <th className="px-4 py-3 text-right font-semibold text-indigo-300">Model $</th>
                <th className="px-4 py-3 text-right font-semibold text-indigo-300">Model Units</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-300">Ramp Units</th>
                <th className="px-4 py-3 text-right font-semibold">$ Variance</th>
                <th className="px-4 py-3 text-right font-semibold">Unit Variance</th>
                <th className="px-4 py-3 text-right font-semibold">vs Ramp</th>
              </tr>
            </thead>
            <tbody>
              {fyRows.map((r, i) => {
                const hasActual = r.closedWon != null;
                const revVarPos = r.revenueVariance != null && r.revenueVariance >= 0;
                const unitVarPos = r.unitVariance != null && r.unitVariance >= 0;
                const rampPos = r.vsRamp != null && r.vsRamp >= 0;
                return (
                  <tr key={r.label} className={`border-b border-slate-50 ${!hasActual ? "opacity-50" : "hover:bg-slate-50"}`}>
                    <td className="px-4 py-2.5 font-semibold text-slate-700">{r.label}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-violet-700">
                      {hasActual ? fmtAUD(r.closedWon, false) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-violet-700">
                      {r.actualUnits != null ? r.actualUnits.toLocaleString() : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-amber-600">
                      {r.pipelineForecast ? fmtAUD(r.pipelineForecast, false) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-indigo-600">
                      {r.modelRevenue != null ? fmtAUD(r.modelRevenue, false) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-indigo-500">
                      {r.modelUnits != null ? r.modelUnits.toLocaleString() : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-400">
                      {r.rampUnits > 0 ? r.rampUnits : <span className="text-slate-200">cliff</span>}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-bold font-mono ${r.revenueVariance == null ? "text-slate-200" : revVarPos ? "text-emerald-600" : "text-rose-600"}`}>
                      {r.revenueVariance != null
                        ? `${revVarPos?"+":""}${fmtAUD(r.revenueVariance, false)}`
                        : "—"
                      }
                    </td>
                    <td className={`px-4 py-2.5 text-right font-bold font-mono ${r.unitVariance == null ? "text-slate-200" : unitVarPos ? "text-emerald-600" : "text-rose-600"}`}>
                      {r.unitVariance != null
                        ? `${unitVarPos?"+":""}${r.unitVariance}`
                        : "—"
                      }
                    </td>
                    <td className={`px-4 py-2.5 text-right font-bold font-mono ${r.vsRamp == null ? "text-slate-200" : rampPos ? "text-emerald-600" : "text-rose-600"}`}>
                      {r.vsRamp != null
                        ? `${rampPos?"+":""}${fmtAUD(r.vsRamp, false)}`
                        : "—"
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-bold">
              <tr>
                <td className="px-4 py-3 text-xs font-bold text-slate-700">Total / Avg</td>
                <td className="px-4 py-3 text-right font-mono text-violet-700">{fmtAUD(summary.totalActual,false)}</td>
                <td className="px-4 py-3 text-right font-mono text-violet-700">{summary.totalActualUnits.toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-mono text-amber-600">{fmtAUD(summary.totalPipeline,false)}</td>
                <td className="px-4 py-3 text-right font-mono text-indigo-600">{fmtAUD(summary.totalModel,false)}</td>
                <td className="px-4 py-3 text-right font-mono text-indigo-500">{summary.totalModelUnits.toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-mono text-slate-500">{fyRows.reduce((s,r)=>s+r.rampUnits,0)}</td>
                <td className={`px-4 py-3 text-right font-mono ${summary.totalActual>=summary.totalModel?"text-emerald-600":"text-rose-600"}`}>
                  {`${summary.totalActual>=summary.totalModel?"+":""}${fmtAUD(summary.totalActual-summary.totalModel,false)}`}
                </td>
                <td className={`px-4 py-3 text-right font-mono ${summary.totalActualUnits>=summary.totalModelUnits?"text-emerald-600":"text-rose-600"}`}>
                  {`${summary.totalActualUnits>=summary.totalModelUnits?"+":""}${(summary.totalActualUnits-summary.totalModelUnits).toLocaleString()}`}
                </td>
                <td className="px-4 py-3 text-right font-mono text-slate-500">—</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 flex items-center gap-4 flex-wrap">
          <span><span className="text-violet-600 font-semibold">Closed Won</span> = CRM actual revenue</span>
          <span><span className="text-amber-500 font-semibold">Pipeline</span> = CRM forecast at time of export</span>
          <span><span className="text-indigo-600 font-semibold">Model</span> = Unit Modeler total revenue</span>
          <span><span className="text-slate-500 font-semibold">Ramp</span> = 21-unit/month sales benchmark (per person, QLD avg)</span>
          <span className="ml-auto">Greyed rows = no CRM data for this period</span>
        </div>
      </div>
    </div>
  );
}


// ─── RAW DATA TABLE ───────────────────────────────────────────────────────────
function RawDataTable({data, yearBasis, selectedYear}) {
  const [filterRegion, setFilterRegion] = useState("All");
  const filtered = filterRegion==="All" ? data.units : data.units.filter(u=>u.region===filterRegion);

  const getTotals = u => {
    let rev=0, units=0;
    u.monthlyData.forEach(md=>{
      if(isMonthInPeriod(md.dateObj,yearBasis,selectedYear)){rev+=md.revenue; units+=md.units;}
    });
    return {rev, units};
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl border border-slate-100 flex justify-between items-center">
        <div>
          <h3 className="font-bold text-slate-700 text-sm">Unit Data — {selectedYear==="All"?"All Time":selectedYear}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{filtered.length} unit lines</p>
        </div>
        <select value={filterRegion} onChange={e=>setFilterRegion(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-blue-400 outline-none">
          <option value="All">All Regions</option>
          {data.regions.map(r=><option key={r.region}>{r.region}</option>)}
        </select>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-600 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                {["Region","Course","Price/Unit","Units","Revenue"].map(h=><th key={h} className="px-5 py-3 text-left font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u,i)=>{
                const {rev, units} = getTotals(u);
                return (
                  <tr key={`${u.region}-${u.code}-${i}`} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium">{u.region}</td>
                    <td className="px-5 py-3"><span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-xs font-bold">{u.code}</span></td>
                    <td className="px-5 py-3 font-mono text-slate-500">{fmtAUD(u.price,false)}</td>
                    <td className="px-5 py-3 font-semibold">{Math.round(units).toLocaleString()}</td>
                    <td className="px-5 py-3 font-semibold text-emerald-600">{fmtAUD(rev,false)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


// ─── AUTH SCREENS ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState("login"); // "login" | "forgot"
  const [forgotSent, setForgotSent] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await sbSignIn(email.trim().toLowerCase(), password);
      console.log("LOGIN USER OBJECT:", JSON.stringify(data.user, null, 2));
      const meta = data.user?.user_metadata || data.user?.raw_user_meta_data || {};
      console.log("META:", meta, "must_change_password:", meta.must_change_password);
      const mustChange = meta.must_change_password === true;
      onLogin(data.user, data.access_token, mustChange);
    } catch(err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON, "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() })
      });
      setForgotSent(true);
    } catch {}
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] flex items-center justify-center p-4"
      style={{fontFamily:"'DM Sans', system-ui, sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&display=swap');`}</style>

      {/* Background grid */}
      <div className="absolute inset-0 opacity-[0.03]" style={{backgroundImage:"linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)",backgroundSize:"40px 40px"}}/>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-2xl shadow-blue-500/30 mb-4">
            <span className="text-white font-black text-2xl">E</span>
          </div>
          <h1 className="text-2xl font-black text-white">EduGrowth BI</h1>
          <p className="text-slate-400 text-sm mt-1">Financial Intelligence Platform</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8 shadow-2xl">
          {mode === "login" ? (
            <>
              <h2 className="text-lg font-bold text-white mb-6">Sign in to your account</h2>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Email</label>
                  <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"
                    placeholder="you@abctraining.edu.au"
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"/>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Password</label>
                  <div className="relative">
                    <input type={showPw?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"
                      placeholder="••••••••••••"
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 pr-12 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"/>
                    <button type="button" onClick={()=>setShowPw(s=>!s)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-200 transition-colors">
                      {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
                    <AlertCircle size={14} className="text-rose-400 shrink-0"/>
                    <p className="text-xs text-rose-300">{error}</p>
                  </div>
                )}

                <button type="submit" disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 mt-2">
                  {loading ? <Loader2 size={16} className="animate-spin"/> : <Lock size={16}/>}
                  {loading ? "Signing in…" : "Sign In"}
                </button>
              </form>

              <button onClick={()=>setMode("forgot")} className="w-full text-center text-xs text-slate-500 hover:text-slate-300 mt-5 transition-colors">
                Forgot your password?
              </button>
            </>
          ) : (
            <>
              <button onClick={()=>{setMode("login");setForgotSent(false);}} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-xs mb-5 transition-colors">
                <ArrowRight size={12} className="rotate-180"/>Back to login
              </button>
              <h2 className="text-lg font-bold text-white mb-2">Reset password</h2>
              <p className="text-slate-400 text-xs mb-6">We'll send a reset link to your email address.</p>
              {forgotSent ? (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-4 text-center">
                  <p className="text-sm text-emerald-300 font-semibold">Reset email sent!</p>
                  <p className="text-xs text-slate-400 mt-1">Check your inbox for the reset link.</p>
                </div>
              ) : (
                <form onSubmit={handleForgot} className="space-y-4">
                  <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required
                    placeholder="you@abctraining.edu.au"
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"/>
                  <button type="submit" disabled={loading}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                    {loading ? <Loader2 size={16} className="animate-spin"/> : "Send reset link"}
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        <p className="text-center text-[10px] text-slate-600 mt-6">
          ABC Training · EduGrowth BI v2.0 · Confidential
        </p>
      </div>
    </div>
  );
}

function PasswordChangeScreen({ user, onComplete }) {
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const strength = (pw) => {
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  };
  const s = strength(newPw);
  const strengthLabel = ["","Weak","Fair","Good","Strong"][s];
  const strengthColor = ["","bg-rose-500","bg-amber-400","bg-blue-400","bg-emerald-500"][s];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPw !== confirmPw) { setError("Passwords don't match"); return; }
    if (newPw.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (newPw === "ABCmanagement") { setError("Please choose a new password different from the temporary one"); return; }
    setError(null);
    setLoading(true);
    try {
      await sbUpdatePassword(newPw);
      await sbAudit(user, "UPDATE", "AUTH", "Password changed on first login");
      onComplete();
    } catch(err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "there";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] flex items-center justify-center p-4"
      style={{fontFamily:"'DM Sans', system-ui, sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&display=swap');`}</style>

      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-2xl shadow-amber-500/30 mb-4">
            <KeyRound size={24} className="text-white"/>
          </div>
          <h1 className="text-2xl font-black text-white">Set your password</h1>
          <p className="text-slate-400 text-sm mt-1">Welcome, {firstName}! Please choose a secure password to continue.</p>
        </div>

        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 mb-6">
            <AlertTriangle size={14} className="text-amber-400 shrink-0"/>
            <p className="text-xs text-amber-300">Your temporary password must be changed before you can access the platform.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">New Password</label>
              <div className="relative">
                <input type={showPw?"text":"password"} value={newPw} onChange={e=>setNewPw(e.target.value)} required minLength={8}
                  placeholder="Min. 8 characters"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 pr-12 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"/>
                <button type="button" onClick={()=>setShowPw(s=>!s)} className="absolute right-3 top-3 text-slate-400 hover:text-slate-200">
                  {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
              {newPw && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1,2,3,4].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i<=s ? strengthColor : "bg-white/10"}`}/>
                    ))}
                  </div>
                  <p className={`text-[10px] font-semibold ${["","text-rose-400","text-amber-400","text-blue-400","text-emerald-400"][s]}`}>{strengthLabel}</p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Confirm Password</label>
              <input type={showPw?"text":"password"} value={confirmPw} onChange={e=>setConfirmPw(e.target.value)} required
                placeholder="Repeat new password"
                className={`w-full bg-white/10 border rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${confirmPw && confirmPw!==newPw ? "border-rose-500/50 focus:ring-rose-500" : "border-white/20 focus:ring-amber-500"}`}/>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
                <AlertCircle size={14} className="text-rose-400 shrink-0"/>
                <p className="text-xs text-rose-300">{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading || newPw !== confirmPw || newPw.length < 8}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 mt-2">
              {loading ? <Loader2 size={16} className="animate-spin"/> : <Shield size={16}/>}
              {loading ? "Updating…" : "Set password & continue"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── AUDIT LOG VIEW ────────────────────────────────────────────────────────────
function AuditLogView() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ entity: "all", action: "all", user: "all", search: "" });

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await fetch(
          `${SUPABASE_URL}/rest/v1/audit_log?select=*&order=created_at.desc&limit=500`,
          { headers: getAuthHeaders() }
        );
        const rows = await data.json();
        if (Array.isArray(rows)) setLogs(rows);
      } catch(e) { console.warn("Audit load failed:", e); }
      setLoading(false);
    }
    load();
  }, []);

  const entities = ["all", ...new Set(logs.map(l => l.entity))];
  const actions  = ["all", ...new Set(logs.map(l => l.action))];
  const users    = ["all", ...new Set(logs.map(l => l.user_email))];

  const filtered = logs.filter(l => {
    if (filter.entity !== "all" && l.entity !== filter.entity) return false;
    if (filter.action !== "all" && l.action !== filter.action) return false;
    if (filter.user   !== "all" && l.user_email !== filter.user) return false;
    if (filter.search) {
      const s = filter.search.toLowerCase();
      return (l.detail||"").toLowerCase().includes(s) || (l.user_email||"").toLowerCase().includes(s);
    }
    return true;
  });

  const actionColor = { UPDATE:"bg-blue-100 text-blue-700", CREATE:"bg-emerald-100 text-emerald-700",
    DELETE:"bg-rose-100 text-rose-700", LOGIN:"bg-indigo-100 text-indigo-700",
    LOGOUT:"bg-slate-100 text-slate-600", AUTH:"bg-amber-100 text-amber-700" };

  const entityColor = { COA:"bg-orange-100 text-orange-700", UNIT:"bg-teal-100 text-teal-700",
    HIRE:"bg-violet-100 text-violet-700", AUTH:"bg-slate-100 text-slate-600" };

  const fmtTime = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString("en-AU", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
  };

  const initials = (email) => {
    const name = email?.split("@")[0] || "?";
    return name.split(/[._]/).map(p => p[0]?.toUpperCase()).slice(0,2).join("");
  };

  const avatarColor = (email) => {
    const colors = ["bg-blue-500","bg-violet-500","bg-emerald-500","bg-amber-500","bg-rose-500","bg-indigo-500"];
    let hash = 0;
    for (const c of (email||"")) hash = (hash*31 + c.charCodeAt(0)) & 0xffffffff;
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <ClipboardList size={18} className="text-slate-500"/>Audit Log
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{filtered.length} of {logs.length} records · all changes tracked by user</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <input value={filter.search} onChange={e=>setFilter(f=>({...f,search:e.target.value}))}
              placeholder="Search…"
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-white focus:ring-2 focus:ring-blue-400 outline-none w-40"/>
            {/* Filters */}
            {[["entity",entities],["action",actions],["user",users]].map(([key,opts]) => (
              <select key={key} value={filter[key]} onChange={e=>setFilter(f=>({...f,[key]:e.target.value}))}
                className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:ring-2 focus:ring-blue-400 outline-none capitalize">
                {opts.map(o => <option key={o} value={o}>{o === "all" ? `All ${key}s` : o}</option>)}
              </select>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:"Total Changes", value: logs.filter(l=>l.action!=="LOGIN"&&l.action!=="LOGOUT").length, icon:ClipboardList, color:"bg-blue-500" },
          { label:"Unique Users", value: new Set(logs.map(l=>l.user_email)).size, icon:Users, color:"bg-violet-500" },
          { label:"COA Edits", value: logs.filter(l=>l.entity==="COA").length, icon:CreditCard, color:"bg-orange-500" },
          { label:"Staff Changes", value: logs.filter(l=>l.entity==="HIRE").length, icon:Users, color:"bg-emerald-500" },
        ].map(({label,value,icon:Icon,color})=>(
          <div key={label} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${color} text-white shrink-0`}><Icon size={16}/></div>
            <div>
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-xl font-black text-slate-800">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Log table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
            <Loader2 size={18} className="animate-spin"/><span className="text-sm">Loading audit log…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <ClipboardList size={32} className="mx-auto mb-3 opacity-30"/>
            <p className="text-sm font-medium">No audit records found</p>
            <p className="text-xs mt-1">Changes you make will appear here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-800 text-white">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Timestamp</th>
                  <th className="px-4 py-3 text-left font-semibold">User</th>
                  <th className="px-4 py-3 text-left font-semibold">Action</th>
                  <th className="px-4 py-3 text-left font-semibold">Module</th>
                  <th className="px-4 py-3 text-left font-semibold">Detail</th>
                  <th className="px-4 py-3 text-left font-semibold">Previous</th>
                  <th className="px-4 py-3 text-left font-semibold">New Value</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log, i) => (
                  <tr key={log.id || i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap font-mono">{fmtTime(log.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full ${avatarColor(log.user_email)} flex items-center justify-center text-white text-[9px] font-bold shrink-0`}>
                          {initials(log.user_email)}
                        </span>
                        <div>
                          <p className="font-semibold text-slate-700">{log.user_name}</p>
                          <p className="text-[10px] text-slate-400">{log.user_email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${actionColor[log.action]||"bg-slate-100 text-slate-600"}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${entityColor[log.entity]||"bg-slate-100 text-slate-600"}`}>
                        {log.entity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 max-w-xs truncate" title={log.detail}>{log.detail}</td>
                    <td className="px-4 py-3">
                      {log.old_value ? (
                        <span className="font-mono text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded text-[10px] max-w-[120px] truncate block" title={log.old_value}>
                          {log.old_value}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {log.new_value ? (
                        <span className="font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] max-w-[120px] truncate block" title={log.new_value}>
                          {log.new_value}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > 0 && (
          <div className="px-4 py-2 bg-slate-50 border-t text-[10px] text-slate-400">
            Showing {filtered.length} records · ordered newest first · last 500 entries
          </div>
        )}
      </div>
    </div>
  );
}



// ─── AI FEATURE CONSTANTS ─────────────────────────────────────────────────────
// Route through /api/gemini proxy when running on Vercel (any non-localhost domain)
// Falls back to direct call on localhost/StackBlitz dev environments
const IS_PROD = typeof window !== "undefined" && !window.location.hostname.includes("localhost") && !window.location.hostname.includes("stackblitz") && !window.location.hostname.includes("webcontainer");
const GEMINI_BASE = IS_PROD
  ? "/api/gemini"
  : `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY || ""}`;

async function callGemini(prompt, systemPrompt = "", maxTokens = 4096) {
  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens }
  };
  if (systemPrompt) body.system_instruction = { parts: [{ text: systemPrompt }] };
  const r = await fetch(GEMINI_BASE, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || "Gemini error");
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// ─── 1. ANOMALY DETECTION ENGINE ──────────────────────────────────────────────
function useAnomalyDetection(coaAdjustments) {
  const [anomalies, setAnomalies] = useState([]);
  const [anomalyStatus, setAnomalyStatus] = useState("idle"); // idle|scanning|done|error
  const [lastScanned, setLastScanned] = useState(null);

  const runScan = useCallback(async (force = false) => {
    // Only scan once per session unless forced
    const sessionKey = "anomaly_scan_done";
    if (!force && sessionStorage.getItem(sessionKey)) {
      try {
        const cached = JSON.parse(sessionStorage.getItem("anomaly_results") || "[]");
        setAnomalies(cached);
        setAnomalyStatus("done");
        setLastScanned(new Date(sessionStorage.getItem("anomaly_ts")));
      } catch {}
      return;
    }

    setAnomalyStatus("scanning");

    // Build anomaly data — compare each account's monthly actuals vs forecast
    const anomalyData = [];
    const actualMks = ["Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb"];

    CHART_OF_ACCOUNTS.forEach(ac => {
      const monthlyActuals = actualMks.map(mk => ({
        mk,
        actual: ACTUALS_FY26[ac.account]?.[mk] ?? null,
        forecast: ac.months[mk] || 0,
      })).filter(m => m.actual !== null);

      if (monthlyActuals.length < 2) return;

      const actuals = monthlyActuals.map(m => m.actual);
      const avg = actuals.reduce((s, v) => s + v, 0) / actuals.length;
      const stdDev = Math.sqrt(actuals.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / actuals.length);

      monthlyActuals.forEach(({ mk, actual, forecast }) => {
        // Flag if actual > 2.5× average, or > 2× forecast, or > $10k variance
        const vsAvgRatio = avg > 0 ? actual / avg : 1;
        const vsForecastRatio = forecast > 100 ? actual / forecast : 1;
        const absVariance = actual - forecast;

        if (vsAvgRatio > 2.5 || vsForecastRatio > 2.0 || absVariance > 15000 || absVariance < -10000) {
          anomalyData.push({
            account: ac.account,
            section: ac.section,
            mk,
            actual,
            forecast,
            avg: Math.round(avg),
            vsAvgRatio: Math.round(vsAvgRatio * 10) / 10,
            vsForecastRatio: Math.round(vsForecastRatio * 10) / 10,
            absVariance,
            severity: vsAvgRatio > 3 || Math.abs(absVariance) > 30000 ? "high" : "medium"
          });
        }
      });
    });

    // Sort by severity then absolute variance
    anomalyData.sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === "high" ? -1 : 1;
      return Math.abs(b.absVariance) - Math.abs(a.absVariance);
    });

    if (anomalyData.length === 0) {
      setAnomalies([]);
      setAnomalyStatus("done");
      setLastScanned(new Date());
      sessionStorage.setItem(sessionKey, "1");
      sessionStorage.setItem("anomaly_results", "[]");
      sessionStorage.setItem("anomaly_ts", new Date().toISOString());
      return;
    }

    // Ask Gemini to interpret the top anomalies
    try {
      const prompt = `You are a financial analyst reviewing expense anomalies for ABC Training (educational RTO).

Here are the detected anomalies in FY26 actuals vs forecast:

${anomalyData.slice(0, 12).map((a, i) =>
  `${i+1}. ${a.account} (${a.section}) — ${a.mk}-25/26: Actual $${a.actual.toLocaleString()} vs Forecast $${a.forecast.toLocaleString()} | Variance: ${a.absVariance >= 0 ? "+" : ""}$${a.absVariance.toLocaleString()} | ${a.vsAvgRatio}× monthly average`
).join("\n")}

For each anomaly, provide:
1. A brief one-line plain-English explanation of what likely caused it
2. Whether it's a concern (needs action) or expected (seasonal/one-off)
3. A recommended action if needed

Return ONLY a JSON array with this exact structure, no markdown, no backticks:
[{"account":"Travel - International","mk":"Dec","explanation":"Year-end international conference or executive travel","concern":false,"action":"Monitor — confirm this was planned travel"},...]`;

      const raw = await callGemini(prompt, "", 2048);
      let interpretations = [];
      try {
        const match2 = raw.match(/\[[\s\S]*\]/);
        if (match2) {
          const cleaned2 = match2[0]
            .replace(/'/g, '"')
            .replace(/,\s*([}\]])/g, '$1')
            .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":');
          interpretations = JSON.parse(cleaned2);
        }
      } catch { interpretations = []; }

      // Merge Gemini interpretations into anomaly data
      const enriched = anomalyData.map(a => {
        const interp = interpretations.find(i => i.account === a.account && i.mk === a.mk);
        return { ...a, explanation: interp?.explanation || "Unusual spending pattern detected", concern: interp?.concern ?? true, action: interp?.action || "Review with finance team" };
      });

      setAnomalies(enriched);
      setAnomalyStatus("done");
      setLastScanned(new Date());
      sessionStorage.setItem(sessionKey, "1");
      sessionStorage.setItem("anomaly_results", JSON.stringify(enriched));
      sessionStorage.setItem("anomaly_ts", new Date().toISOString());
    } catch (e) {
      // Fallback: show anomalies without AI interpretation
      const fallback = anomalyData.map(a => ({ ...a, explanation: "Unusual spending pattern detected", concern: true, action: "Review with finance team" }));
      setAnomalies(fallback);
      setAnomalyStatus("done");
      setLastScanned(new Date());
    }
  }, [coaAdjustments]);

  useEffect(() => { runScan(); }, []);

  return { anomalies, anomalyStatus, lastScanned, runScan };
}

// ─── 2. CASHFLOW FORECASTER ────────────────────────────────────────────────────
function CashflowForecastPanel({ data, coaAdjustments }) {
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [paymentTerms, setPaymentTerms] = useState({ receivableDays: 30, payableDays: 30, govFundingLag: 45 });
  const [open, setOpen] = useState(false);

  const fmtM = (iso) => {
    const d = new Date(iso);
    return d.toLocaleString("en-AU", { month: "short", year: "2-digit" });
  };

  const runForecast = async () => {
    setLoading(true);
    try {
      const fcastMonths = ["Mar","Apr","May","Jun","Jul","Aug"];
      const expForecast = fcastMonths.map(mk => ({
        mk,
        expenses: CHART_OF_ACCOUNTS.reduce((s, ac) => {
          const key = `FY26|${ac.account}|${mk}`;
          return s + (coaAdjustments[key] !== undefined ? coaAdjustments[key] : (ac.months[mk] || 0));
        }, 0)
      }));

      const prompt = `You are a CFO cash flow analyst for ABC Training, an Australian RTO.
Current cash: $2,100,000 (Feb 2026)
Payment terms: receivables ${paymentTerms.receivableDays} days, payables ${paymentTerms.payableDays} days, gov funding lag ${paymentTerms.govFundingLag} days
Monthly expenses: ${expForecast.map(m => m.mk + "-26=$" + Math.round(m.expenses).toLocaleString()).join(", ")}
Estimated monthly revenue: ~$850,000. Fixed costs: wages $270k, super $30k, payroll tax $12k, rent $17k.

Produce a 6-month cash flow forecast (Mar-26 to Aug-26).

Reply in EXACTLY this format. Use pipe | as delimiter. No other text before or after.

MONTHS
Mar-26|850000|780000|70000|2170000|low|Normal trading
Apr-26|840000|765000|75000|2245000|low|Steady growth

ALERTS
Jun-26|warning|Review cash if enrolments soften

RECOMMENDATIONS
Accelerate government funding claims to reduce lag
Review discretionary spend quarterly

OUTLOOK
Two to three sentences about the overall 120-day cash outlook.`;

      const raw = await callGemini(prompt, "", 2048);
      const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
      const result = { months: [], alerts: [], recommendations: [], outlook: "" };
      let section = "";

      for (const line of lines) {
        if (line === "MONTHS")          { section = "months"; continue; }
        if (line === "ALERTS")          { section = "alerts"; continue; }
        if (line === "RECOMMENDATIONS") { section = "recs";   continue; }
        if (line === "OUTLOOK")         { section = "outlook";continue; }

        if (section === "months" && line.includes("|")) {
          const p = line.split("|");
          if (p.length >= 7) result.months.push({
            month: p[0], expectedInflows: parseInt(p[1])||0,
            expectedOutflows: parseInt(p[2])||0, netCashflow: parseInt(p[3])||0,
            projectedBalance: parseInt(p[4])||0, riskLevel: p[5]||"low", note: p[6]||""
          });
        } else if (section === "alerts" && line.includes("|")) {
          const p = line.split("|");
          if (p.length >= 3) result.alerts.push({ month: p[0], level: p[1], message: p[2] });
        } else if (section === "recs")    { result.recommendations.push(line); }
        else if (section === "outlook")   { result.outlook += (result.outlook ? " " : "") + line; }
      }

      if (result.months.length === 0) throw new Error("No months parsed from response");
      setForecast(result);
    } catch (e) {
      console.error("Cashflow forecast error:", e);
      setForecast({ months: [], alerts: [], recommendations: ["Unable to generate forecast — please try again"], outlook: "An error occurred. Please click Refresh to retry." });
    }
    setLoading(false);
  };

  const riskColor = { low: "text-emerald-600 bg-emerald-50", medium: "text-amber-600 bg-amber-50", high: "text-rose-600 bg-rose-50", critical: "text-red-700 bg-red-50" };
  const alertColor = { warning: "border-amber-300 bg-amber-50 text-amber-800", critical: "border-red-300 bg-red-50 text-red-800", info: "border-blue-300 bg-blue-50 text-blue-800" };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <Zap size={16} className="text-white"/>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">AI Cash Flow Forecast — 120 Days</h3>
            <p className="text-[10px] text-slate-400">Gemini-powered · accounts for payment timing and funding lags</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setOpen(o => !o)} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
            Payment terms <ChevronRight size={12} className={`transition-transform ${open ? "rotate-90" : ""}`}/>
          </button>
          <button onClick={runForecast} disabled={loading}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
            {loading ? <Loader2 size={12} className="animate-spin"/> : <Zap size={12}/>}
            {loading ? "Forecasting…" : forecast ? "Refresh" : "Run Forecast"}
          </button>
        </div>
      </div>

      {/* Payment terms config */}
      {open && (
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex gap-6 flex-wrap">
          {[
            { key: "receivableDays", label: "Receivables (days)" },
            { key: "payableDays", label: "Payables (days)" },
            { key: "govFundingLag", label: "Gov funding lag (days)" },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <label className="text-xs text-slate-500 font-medium">{label}</label>
              <input type="number" value={paymentTerms[key]}
                onChange={e => setPaymentTerms(p => ({ ...p, [key]: parseInt(e.target.value) || 0 }))}
                className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-xs text-center focus:ring-2 focus:ring-indigo-400 outline-none"/>
            </div>
          ))}
        </div>
      )}

      {!forecast && !loading && (
        <div className="px-6 py-10 text-center text-slate-400">
          <Zap size={28} className="mx-auto mb-3 opacity-30"/>
          <p className="text-sm font-medium">Click "Run Forecast" to generate AI cash flow predictions</p>
          <p className="text-xs mt-1">Analyses next 120 days with payment timing, funding lags, and risk alerts</p>
        </div>
      )}

      {loading && (
        <div className="px-6 py-10 text-center text-slate-400">
          <Loader2 size={28} className="mx-auto mb-3 animate-spin text-indigo-400"/>
          <p className="text-sm font-medium">Gemini is modelling your cash flow…</p>
          <p className="text-xs mt-1">Accounting for payment terms and funding lags</p>
        </div>
      )}

      {forecast && !loading && (
        <div className="p-6 space-y-5">
          {/* Alerts */}
          {forecast.alerts?.length > 0 && (
            <div className="space-y-2">
              {forecast.alerts.map((alert, i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${alertColor[alert.level] || alertColor.info}`}>
                  <AlertTriangle size={14} className="shrink-0 mt-0.5"/>
                  <div>
                    <p className="text-xs font-bold">{alert.month}</p>
                    <p className="text-xs">{alert.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Month table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-800 text-white">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold">Month</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Inflows</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Outflows</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Net</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Balance</th>
                  <th className="px-4 py-2.5 text-center font-semibold">Risk</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Note</th>
                </tr>
              </thead>
              <tbody>
                {forecast.months?.map((m, i) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-semibold text-slate-700">{m.month}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-emerald-600">{fmtAUD(m.expectedInflows, false)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-rose-600">{fmtAUD(m.expectedOutflows, false)}</td>
                    <td className={`px-4 py-2.5 text-right font-mono font-bold ${m.netCashflow >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {m.netCashflow >= 0 ? "+" : ""}{fmtAUD(m.netCashflow, false)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-indigo-700">{fmtAUD(m.projectedBalance, false)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${riskColor[m.riskLevel] || riskColor.low}`}>{m.riskLevel}</span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 max-w-xs text-[10px]">{m.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Recommendations */}
          {forecast.recommendations?.length > 0 && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
              <p className="text-xs font-bold text-indigo-800 mb-2 flex items-center gap-1.5"><Zap size={12}/>AI Recommendations</p>
              <ul className="space-y-1.5">
                {forecast.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-indigo-700">
                    <ChevronRight size={12} className="shrink-0 mt-0.5"/>{rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Outlook */}
          {forecast.outlook && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-bold text-slate-700 mb-1.5">120-Day Outlook</p>
              <p className="text-xs text-slate-600 leading-relaxed">{forecast.outlook}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 3. MONTHLY NARRATIVE GENERATOR ───────────────────────────────────────────
function MonthlyNarrativePanel({ data, coaAdjustments, currentUser }) {
  const [narrative, setNarrative] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState("board"); // board|cfo|operations
  const [copied, setCopied] = useState(false);

  const reportLabels = { board: "Board Pack", cfo: "CFO Commentary", operations: "Operations Summary" };

  const generate = async () => {
    setLoading(true);
    try {
      // Build comprehensive data snapshot
      const ytdActual = ["Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb"].reduce((s, mk) => 
        s + CHART_OF_ACCOUNTS.reduce((ss, ac) => ss + (ACTUALS_FY26[ac.account]?.[mk] ?? ac.months[mk] ?? 0), 0), 0);
      const ytdForecast = ["Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb"].reduce((s, mk) => 
        s + CHART_OF_ACCOUNTS.reduce((ss, ac) => ss + (ac.months[mk] || 0), 0), 0);
      const ytdRevenue = data.regions.reduce((s, r) => s + r.monthlyData.slice(0,8).reduce((ss, m) => ss + (m.revenue||0), 0), 0);
      const annualExpForecast = MONTH_SCHEDULE.filter(m=>m.fy==="FY26").reduce((s,{mk})=>
        s + CHART_OF_ACCOUNTS.reduce((ss, ac)=>ss+(ac.months[mk]||0), 0), 0);
      
      // Top variances
      const topVariances = CHART_OF_ACCOUNTS.map(ac => {
        const ytdA = ["Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb"].reduce((s,mk)=>s+(ACTUALS_FY26[ac.account]?.[mk]??ac.months[mk]??0),0);
        const ytdF = ["Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb"].reduce((s,mk)=>s+(ac.months[mk]||0),0);
        return { account: ac.account, section: ac.section, variance: ytdA - ytdF, ytdA, ytdF };
      }).sort((a,b) => Math.abs(b.variance) - Math.abs(a.variance)).slice(0,8);

      const systemPrompt = `You are a senior CFO writing financial reports for ABC Training's board and management. 
Write in a professional, concise Australian business style. Use AUD currency. Be specific with numbers. 
Today's date: 25 February 2026.`;

      const prompts = {
        board: `Write a Board Pack financial commentary for February 2026 board meeting.

YTD Performance (Jul-25 to Feb-26, 8 months):
- YTD Revenue: $${Math.round(ytdRevenue).toLocaleString()}
- YTD Actual Expenses: $${Math.round(ytdActual).toLocaleString()}
- YTD Forecast Expenses: $${Math.round(ytdForecast).toLocaleString()}
- YTD Expense Variance: ${ytdActual > ytdForecast ? "+" : ""}$${Math.round(ytdActual-ytdForecast).toLocaleString()} (${ytdActual > ytdForecast ? "OVER" : "UNDER"} budget)
- FY26 Annual Expense Budget: $${Math.round(annualExpForecast).toLocaleString()}

Top 8 expense variances YTD:
${topVariances.map(v => `- ${v.account}: Actual $${Math.round(v.ytdA).toLocaleString()} vs Forecast $${Math.round(v.ytdF).toLocaleString()} (${v.variance>=0?"+":""}$${Math.round(v.variance).toLocaleString()})`).join("\n")}

Write a formal board commentary with sections:
1. Executive Summary (2-3 sentences)
2. Financial Performance Overview
3. Key Variances — Explanations and Actions
4. Risks and Opportunities
5. Outlook to June 2026
6. Recommendations

Use professional board-level language. Be direct and actionable.`,

        cfo: `Write a detailed CFO internal commentary for February 2026.

YTD Revenue: $${Math.round(ytdRevenue).toLocaleString()}
YTD Actual Expenses: $${Math.round(ytdActual).toLocaleString()} vs Forecast $${Math.round(ytdForecast).toLocaleString()}
Variance: ${ytdActual > ytdForecast ? "+" : ""}$${Math.round(ytdActual-ytdForecast).toLocaleString()}

Top variances:
${topVariances.map(v => `- ${v.account}: ${v.variance>=0?"+":""}$${Math.round(v.variance).toLocaleString()}`).join("\n")}

Write a detailed CFO commentary covering:
1. Month in Review — February highlights
2. Line-by-line variance analysis for material items (>$5k variance)
3. Cost efficiency metrics and ratios
4. Cash flow observations
5. Actions required before March month-end
6. FY26 full-year forecast re-assessment`,

        operations: `Write an Operations Financial Summary for February 2026 for department heads.

YTD Expenses: $${Math.round(ytdActual).toLocaleString()} vs Budget $${Math.round(ytdForecast).toLocaleString()}

Key operational cost items:
${topVariances.filter(v=>v.section==="Overheads").map(v=>`- ${v.account}: $${Math.round(v.ytdA).toLocaleString()} actual vs $${Math.round(v.ytdF).toLocaleString()} forecast`).join("\n")}

Write an operations-focused summary with:
1. What we spent vs what we planned (plain English)
2. Areas where we need to reduce spending
3. Areas where spending was efficient
4. What department heads need to action this month
5. Key metrics to track`
      };

      const result = await callGemini(prompts[reportType], systemPrompt, 8192);
      setNarrative(result);
    } catch (e) {
      console.error("Narrative error:", e);
      setNarrative("Error generating report. Please try again.");
    }
    setLoading(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(narrative || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Simple markdown renderer
  const renderNarrative = (text) => {
    if (!text) return null;
    return text.split("\n").map((line, i) => {
      if (line.startsWith("# ")) return <h2 key={i} className="text-base font-black text-slate-800 mt-4 mb-2">{line.slice(2)}</h2>;
      if (line.startsWith("## ")) return <h3 key={i} className="text-sm font-bold text-slate-700 mt-3 mb-1.5 border-b border-slate-100 pb-1">{line.slice(3)}</h3>;
      if (line.startsWith("### ")) return <h4 key={i} className="text-xs font-bold text-slate-600 mt-2 mb-1">{line.slice(4)}</h4>;
      if (line.startsWith("- ") || line.startsWith("• ")) return <li key={i} className="text-xs text-slate-600 ml-4 mb-0.5 leading-relaxed">{line.slice(2)}</li>;
      if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="text-xs font-bold text-slate-700 mt-1">{line.slice(2,-2)}</p>;
      if (line === "") return <div key={i} className="h-2"/>;
      // Handle inline bold
      const parts = line.split(/(\*\*.*?\*\*)/g);
      return <p key={i} className="text-xs text-slate-600 leading-relaxed mb-0.5">{parts.map((p, j) => p.startsWith("**") ? <strong key={j}>{p.slice(2,-2)}</strong> : p)}</p>;
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <FileText size={16} className="text-white"/>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">AI Monthly Narrative</h3>
            <p className="text-[10px] text-slate-400">One-click CFO-style report generation · February 2026</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Report type selector */}
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            {Object.entries(reportLabels).map(([k, v]) => (
              <button key={k} onClick={() => setReportType(k)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${reportType===k?"bg-violet-600 text-white shadow":"text-slate-500 hover:text-slate-700"}`}>
                {v}
              </button>
            ))}
          </div>
          {narrative && (
            <button onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs border border-slate-200 hover:bg-slate-50 px-3 py-1.5 rounded-lg text-slate-600 transition-colors">
              {copied ? <><CheckCircle size={12} className="text-emerald-500"/>Copied!</> : <><FileText size={12}/>Copy</>}
            </button>
          )}
          <button onClick={generate} disabled={loading}
            className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
            {loading ? <Loader2 size={12} className="animate-spin"/> : <FileText size={12}/>}
            {loading ? "Generating…" : narrative ? "Regenerate" : `Generate ${reportLabels[reportType]}`}
          </button>
        </div>
      </div>

      {!narrative && !loading && (
        <div className="px-6 py-10 text-center text-slate-400">
          <FileText size={28} className="mx-auto mb-3 opacity-30"/>
          <p className="text-sm font-medium">Select report type and click Generate</p>
          <p className="text-xs mt-1">Produces a full written commentary based on your live actuals and forecast data</p>
        </div>
      )}

      {loading && (
        <div className="px-6 py-10 text-center text-slate-400">
          <Loader2 size={28} className="mx-auto mb-3 animate-spin text-violet-400"/>
          <p className="text-sm font-medium">Writing your {reportLabels[reportType]}…</p>
          <p className="text-xs mt-1">Analysing variances, crafting narrative…</p>
        </div>
      )}

      {narrative && !loading && (
        <div className="px-6 py-5 max-h-[600px] overflow-y-auto">
          <div className="prose-sm max-w-none">
            {renderNarrative(narrative)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ANOMALY BADGE (shown in dashboard header) ────────────────────────────────
function AnomalyBadge({ anomalies, anomalyStatus, onClick }) {
  const highCount = anomalies.filter(a => a.severity === "high").length;
  const total = anomalies.length;
  if (anomalyStatus === "scanning") return (
    <button onClick={onClick} className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1.5 rounded-full text-xs font-semibold animate-pulse">
      <Loader2 size={12} className="animate-spin"/>Scanning for anomalies…
    </button>
  );
  if (total === 0 && anomalyStatus === "done") return (
    <button onClick={onClick} className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-semibold">
      <CheckCircle size={12}/>All clear — no anomalies
    </button>
  );
  if (total > 0) return (
    <button onClick={onClick} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${highCount>0?"bg-rose-50 border-rose-200 text-rose-700":"bg-amber-50 border-amber-200 text-amber-700"}`}>
      <BellRing size={12} className={highCount>0?"animate-pulse":""}/>
      {highCount > 0 ? `${highCount} high-severity alert${highCount>1?"s":""}` : `${total} anomal${total>1?"ies":"y"} detected`}
    </button>
  );
  return null;
}

// ─── ANOMALY PANEL (full list view) ───────────────────────────────────────────
function AnomalyPanel({ anomalies, anomalyStatus, lastScanned, onRescan }) {
  const severityColor = { high: "border-rose-200 bg-rose-50", medium: "border-amber-100 bg-amber-50/50" };
  const severityBadge = { high: "bg-rose-100 text-rose-700", medium: "bg-amber-100 text-amber-700" };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center">
            <BellRing size={16} className="text-white"/>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Anomaly Detection</h3>
            <p className="text-[10px] text-slate-400">
              {anomalyStatus === "scanning" ? "Scanning actuals vs forecast…" :
               lastScanned ? `Last scanned ${lastScanned.toLocaleTimeString("en-AU", {hour:"2-digit",minute:"2-digit"})}` :
               "AI-powered analysis of unusual spending patterns"}
            </p>
          </div>
        </div>
        <button onClick={() => onRescan(true)} disabled={anomalyStatus==="scanning"}
          className="flex items-center gap-1.5 text-xs border border-slate-200 hover:bg-slate-50 px-3 py-1.5 rounded-lg text-slate-600 disabled:opacity-50 transition-colors">
          <RefreshCw size={11} className={anomalyStatus==="scanning"?"animate-spin":""}/>Rescan
        </button>
      </div>

      {anomalyStatus === "scanning" ? (
        <div className="px-6 py-10 text-center text-slate-400">
          <Loader2 size={28} className="mx-auto mb-3 animate-spin text-rose-400"/>
          <p className="text-sm font-medium">Gemini is analysing your spending patterns…</p>
        </div>
      ) : anomalies.length === 0 ? (
        <div className="px-6 py-10 text-center text-slate-400">
          <CheckCircle size={28} className="mx-auto mb-3 text-emerald-400"/>
          <p className="text-sm font-medium text-emerald-600">No anomalies detected</p>
          <p className="text-xs mt-1">All actuals are within expected ranges vs forecast</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-50">
          {anomalies.map((a, i) => (
            <div key={i} className={`px-6 py-4 border-l-4 ${severityColor[a.severity] || severityColor.medium}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${severityBadge[a.severity]}`}>
                      {a.severity.toUpperCase()}
                    </span>
                    <span className="text-xs font-bold text-slate-800">{a.account}</span>
                    <span className="text-[10px] text-slate-400">{a.mk}-26 · {a.section}</span>
                  </div>
                  <p className="text-xs text-slate-600 mb-2">{a.explanation}</p>
                  <div className="flex gap-4 text-[10px] flex-wrap">
                    <span><span className="text-slate-400">Actual:</span> <span className="font-bold text-slate-700">{fmtAUD(a.actual, false)}</span></span>
                    <span><span className="text-slate-400">Forecast:</span> <span className="font-mono text-slate-500">{fmtAUD(a.forecast, false)}</span></span>
                    <span><span className="text-slate-400">Variance:</span> <span className={`font-bold ${a.absVariance > 0 ? "text-rose-600" : "text-emerald-600"}`}>{a.absVariance>=0?"+":""}{fmtAUD(a.absVariance, false)}</span></span>
                    <span><span className="text-slate-400">vs avg:</span> <span className="font-bold text-slate-600">{a.vsAvgRatio}×</span></span>
                  </div>
                </div>
                <div className={`shrink-0 flex items-center gap-1 text-[10px] font-semibold ${a.concern ? "text-rose-600" : "text-emerald-600"}`}>
                  {a.concern ? <XCircle size={12}/> : <CheckCircle size={12}/>}
                  {a.concern ? "Action needed" : "Expected"}
                </div>
              </div>
              {a.action && (
                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-indigo-600 bg-indigo-50 px-2.5 py-1.5 rounded-lg w-fit">
                  <ChevronRight size={10}/>{a.action}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── GEMINI AI ASSISTANT ───────────────────────────────────────────────────────
// GeminiAssistant reuses the same IS_PROD + proxy logic defined above
const GEMINI_URL = IS_PROD
  ? "/api/gemini"
  : `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY || ""}`;

function GeminiAssistant({ data, coaAdjustments, hiringEvents, filledHires, currentUser }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Hi! I'm your EduGrowth AI analyst. I have full access to your financial model, expenses, staffing and CRM data.\n\nTry asking me:\n• *\"What are our top 3 cost saving opportunities?\"*\n• *\"What happens if we hire 2 more salespeople in QLD?\"*\n• *\"Write a board summary of FY26 performance\"*" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [minimised, setMinimised] = useState(false);
  const bottomRef = useRef(null);
  const inputRef2 = useRef(null);

  useEffect(() => {
    if (open && !minimised) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, minimised]);

  useEffect(() => {
    if (open && !minimised) inputRef2.current?.focus();
  }, [open, minimised]);

  // Build rich context from live app data
  const buildContext = () => {
    // Revenue summary
    const totalRev = data?.months?.reduce((s, m) => {
      const d = parseDate(m);
      const fy = getFinancialYear(d);
      if (fy === "FY26") return s + (data.regionTotals?.reduce((ss, r) => {
        const md = r.monthlyData?.find(x => x.month === m);
        return ss + (md?.revenue || 0);
      }, 0) || 0);
      return s;
    }, 0) || 0;

    // Expenses by FY
    const expFY26 = CHART_OF_ACCOUNTS.reduce((s, ac) => {
      const fym = MONTH_SCHEDULE.filter(m => m.fy === "FY26");
      return s + fym.reduce((ss, {mk}) => {
        const key = `FY26|${ac.account}|${mk}`;
        const base = ac.months[mk] || 0;
        return ss + (coaAdjustments[key] !== undefined ? coaAdjustments[key] : base);
      }, 0);
    }, 0);

    // Top expenses
    const topExpenses = CHART_OF_ACCOUNTS.map(ac => {
      const fym = MONTH_SCHEDULE.filter(m => m.fy === "FY26");
      const total = fym.reduce((s, {mk}) => {
        const key = `FY26|${ac.account}|${mk}`;
        return s + (coaAdjustments[key] !== undefined ? coaAdjustments[key] : (ac.months[mk] || 0));
      }, 0);
      return { account: ac.account, section: ac.section, total };
    }).sort((a, b) => b.total - a.total).slice(0, 10);

    // Actuals vs forecast for known months
    const ytdActual = ["Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb"].reduce((s, mk) => {
      return s + CHART_OF_ACCOUNTS.reduce((ss, ac) => {
        return ss + (ACTUALS_FY26[ac.account]?.[mk] ?? ac.months[mk] ?? 0);
      }, 0);
    }, 0);
    const ytdForecast = ["Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb"].reduce((s, mk) => {
      return s + CHART_OF_ACCOUNTS.reduce((ss, ac) => ss + (ac.months[mk] || 0), 0);
    }, 0);

    // Hiring plan
    const hireCount = hiringEvents.filter(e => e.eventType !== "departure").length;
    const departureCount = hiringEvents.filter(e => e.eventType === "departure").length;
    const confirmedHires = filledHires.filter(e => e.eventType !== "departure").length;

    // Regions
    const regions = data?.regions?.map(r => ({
      region: r.region,
      revenue: r.monthlyData?.reduce((s, m) => s + (m.revenue || 0), 0) || 0,
      units: r.monthlyData?.reduce((s, m) => s + (m.units || 0), 0) || 0
    })) || [];

    return `You are an expert financial analyst AI for EduGrowth BI, the financial intelligence platform for ABC Training.
You have access to the following LIVE financial data as of February 2026:

## COMPANY OVERVIEW
- Company: Alan Bartlett Consulting Pty Ltd (trading as ABC Training)
- Platform: EduGrowth BI — 3-year financial model (FY26-FY28)
- Current user: ${currentUser?.email || "unknown"}

## FY26 REVENUE (Jul 2025 - Jun 2026)
- Projected total FY26 revenue: ${fmtAUD(data?.summary?.totalRevenue || 0)}
- Regions: ${regions.map(r => `${r.region}: ${fmtAUD(r.revenue)} (${r.units} units)`).join(", ")}
- Queensland is the dominant revenue region

## FY26 EXPENSES
- Total forecast expenses: ${fmtAUD(expFY26)}
- YTD actual spend (Jul-Feb, 8 months): ${fmtAUD(ytdActual)}
- YTD forecast spend (Jul-Feb, 8 months): ${fmtAUD(ytdForecast)}
- YTD variance: ${fmtAUD(ytdActual - ytdForecast)} (${ytdActual > ytdForecast ? "OVER budget" : "UNDER budget"})

## TOP 10 EXPENSE ACCOUNTS (FY26 Annual Forecast)
${topExpenses.map((e, i) => `${i+1}. ${e.account} (${e.section}): ${fmtAUD(e.total)}`).join("\n")}

## COST INFLATION ASSUMPTIONS
- FY26: baseline (0% inflation)
- FY27: +${((COST_INFLATION.FY27-1)*100).toFixed(0)}% cost inflation applied to all overhead accounts
- FY28: +${((COST_INFLATION.FY28-1)*100).toFixed(0)}% cost inflation applied to all overhead accounts

## STAFFING
- Hiring plan events: ${hireCount} hires planned, ${departureCount} departures planned
- Confirmed/filled hires: ${confirmedHires}
- Key roles include: Sales Consultants, Training Coordinators, Operations, Management

## REVENUE MODEL
- Revenue driven by course unit enrolments across 7 regions (QLD, NSW, VIC, SA, WA, TAS, NT/ACT)
- Key qualifications: MSL20122, MSL30122, MSL40122, MSL50122, HLT37215
- Sales model: linear ramp — 21 units/month from month 4, targeting $100k/month per salesperson by month 13
- Average unit value varies by region (~$471/unit in QLD)

## ACTUALS vs FORECAST CONTEXT
- Xero P&L actuals loaded for Nov-25, Dec-25, Jan-26, Feb-26
- Jul-Oct values back-calculated from YTD totals
- Notable: December 2025 had very high Travel - International ($72,871) and Wages ($387,202)
- Entertainment spending has declined significantly in recent months

You can:
1. Answer questions about the financial data above
2. Run what-if scenarios (e.g. "what if we cut IT costs 10%?") — calculate and explain the impact
3. Suggest specific cost saving opportunities based on the actual vs forecast variances
4. Generate narrative board reports, executive summaries, or FY performance reviews
5. Analyse trends and flag risks or opportunities

Always be specific with dollar amounts. Format numbers as AUD. Be concise but thorough.`;
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const userMsg = { role: "user", text };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      // Build conversation history for Gemini
      const systemContext = buildContext();
      const history = messages.slice(1).map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.text }]
      }));

      const response = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemContext }] },
          contents: [
            ...history,
            { role: "user", parts: [{ text }] }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
          }
        })
      });

      const result = await response.json();
      console.log("Gemini response:", JSON.stringify(result).slice(0, 300));
      const reply = result.candidates?.[0]?.content?.parts?.[0]?.text 
        || result.error?.message 
        || "Sorry, I couldn't generate a response. Please try again.";
      setMessages(prev => [...prev, { role: "assistant", text: reply }]);
    } catch (e) {
      console.error("Gemini error:", e);
      setMessages(prev => [...prev, { role: "assistant", text: `Connection error: ${e.message}. Please try again.` }]);
    }
    setLoading(false);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // Render markdown-lite (bold, italic, bullet points, line breaks)
  const renderText = (text) => {
    const lines = text.split("\n");
    return lines.map((line, i) => {
      // Bold
      line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Italic / bullet asterisk
      if (line.startsWith("• ") || line.startsWith("* ") || line.startsWith("- ")) {
        return <li key={i} className="ml-3 text-xs" dangerouslySetInnerHTML={{__html: line.slice(2)}}/>;
      }
      if (line.startsWith("## ")) {
        return <p key={i} className="font-bold text-xs mt-2 mb-0.5 text-slate-200" dangerouslySetInnerHTML={{__html: line.slice(3)}}/>;
      }
      if (line.startsWith("# ")) {
        return <p key={i} className="font-black text-sm mt-2 mb-1 text-white" dangerouslySetInnerHTML={{__html: line.slice(2)}}/>;
      }
      if (line === "") return <div key={i} className="h-1.5"/>;
      return <p key={i} className="text-xs leading-relaxed" dangerouslySetInnerHTML={{__html: line}}/>;
    });
  };

  const quickPrompts = [
    "Top 3 cost saving opportunities",
    "Write a board summary of FY26",
    "What if we hire 2 more QLD salespeople?",
    "Which expenses are over forecast?",
  ];

  return (
    <>
      {/* Floating bubble */}
      {!open && (
        <button onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 to-indigo-700 shadow-2xl shadow-violet-500/40 flex items-center justify-center hover:scale-110 transition-transform group"
          title="AI Financial Analyst">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" fill="currentColor" opacity="0"/>
            <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="1.5" fill="none"/>
            <path d="M8 12h8M12 8v8" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0"/>
            <text x="12" y="16" textAnchor="middle" fontSize="14" fill="white" fontWeight="bold">AI</text>
          </svg>
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-pulse"/>
        </button>
      )}

      {/* Chat window */}
      {open && (
        <div className={`fixed bottom-6 right-6 z-50 w-96 bg-[#0f172a] rounded-2xl shadow-2xl shadow-black/50 border border-white/10 flex flex-col transition-all ${minimised ? "h-14" : "h-[580px]"}`}
          style={{fontFamily:"'DM Sans', system-ui, sans-serif"}}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xs font-black shrink-0">AI</div>
              <div>
                <p className="text-xs font-bold text-white">EduGrowth Analyst</p>
                <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full inline-block"/>
                  Powered by Gemini · live data connected
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setMessages([messages[0]])} title="Clear chat"
                className="text-slate-500 hover:text-slate-300 p-1.5 rounded-lg hover:bg-white/5 transition-colors text-[10px]">
                ↺
              </button>
              <button onClick={() => setMinimised(m => !m)}
                className="text-slate-500 hover:text-slate-300 p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                <span className="text-sm font-bold">{minimised ? "▲" : "▼"}</span>
              </button>
              <button onClick={() => setOpen(false)}
                className="text-slate-500 hover:text-slate-300 p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                <X size={14}/>
              </button>
            </div>
          </div>

          {!minimised && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "assistant" && (
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-[9px] font-black shrink-0 mr-2 mt-0.5">AI</div>
                    )}
                    <div className={`max-w-[85%] px-3 py-2.5 rounded-2xl text-xs leading-relaxed ${
                      msg.role === "user"
                        ? "bg-indigo-600 text-white rounded-br-sm"
                        : "bg-white/8 text-slate-200 rounded-bl-sm border border-white/5"
                    }`}>
                      {msg.role === "assistant" ? renderText(msg.text) : <p className="text-xs">{msg.text}</p>}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-[9px] font-black shrink-0 mr-2 mt-0.5">AI</div>
                    <div className="bg-white/8 border border-white/5 px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1.5">
                      {[0,1,2].map(i => (
                        <div key={i} className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{animationDelay:`${i*150}ms`}}/>
                      ))}
                    </div>
                  </div>
                )}
                <div ref={bottomRef}/>
              </div>

              {/* Quick prompts */}
              {messages.length <= 1 && (
                <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                  {quickPrompts.map((p, i) => (
                    <button key={i} onClick={() => { setInput(p); inputRef2.current?.focus(); }}
                      className="text-[10px] bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 px-2.5 py-1.5 rounded-lg transition-colors text-left">
                      {p}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="px-4 pb-4 pt-2 border-t border-white/5 shrink-0">
                <div className="flex items-end gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 focus-within:border-violet-500/50 transition-colors">
                  <textarea
                    ref={inputRef2}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Ask about your finances, run scenarios…"
                    rows={1}
                    className="flex-1 bg-transparent outline-none text-xs text-white placeholder-slate-500 resize-none max-h-20"
                    style={{minHeight:"20px"}}
                  />
                  <button onClick={sendMessage} disabled={!input.trim() || loading}
                    className="w-7 h-7 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center shrink-0 transition-colors">
                    <ArrowRight size={12} className="text-white"/>
                  </button>
                </div>
                <p className="text-[9px] text-slate-600 mt-1.5 text-center">Gemini 2.0 Flash · connected to live model data</p>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
// ─── LAYOUT ───────────────────────────────────────────────────────────────────
const NAV = [
  {id:"dashboard", label:"Overview",      icon:LayoutDashboard, group:"Analytics"},
  {id:"regions",   label:"Regions",       icon:PieChart,        group:"Analytics"},
  {id:"expenses",  label:"Expenses",      icon:CreditCard,      group:"Analytics"},
  {id:"modeler",   label:"Unit Modeler",  icon:Edit,            group:"Planning"},
  {id:"staff",     label:"Staff Planner", icon:Users,           group:"Planning"},
  {id:"crm",       label:"CRM Report",    icon:BarChart2,       group:"Analytics"},
  {id:"data",      label:"Raw Data",      icon:Table,           group:"Source"},
  {id:"audit",     label:"Audit Log",     icon:ClipboardList,   group:"Admin"},
  {id:"aianalytics",label:"AI Analytics",  icon:Zap,             group:"Admin"},
];

const GROUP_COLORS = {Analytics:"bg-blue-600", Planning:"bg-emerald-600", Source:"bg-slate-600"};

function Layout({children, activeTab, onTabChange, yearBasis, setYearBasis, selectedYear, setSelectedYear, availableYears, onReset, supaStatus, currentUser, onLogout}) {
  const groups = [...new Set(NAV.map(n=>n.group))];
  const activeItem = NAV.find(n=>n.id===activeTab);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden" style={{fontFamily:"'DM Sans', system-ui, sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&display=swap');`}</style>
      
      <aside className="w-60 bg-[#0f172a] text-white hidden md:flex flex-col">
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center gap-2.5 mb-0.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-sm">E</div>
            <div>
              <h1 className="text-sm font-bold text-white">EduGrowth BI</h1>
              <p className="text-[10px] text-slate-500">Financial Intelligence</p>
            </div>
          </div>
          <div className={`mt-3 text-[10px] px-2 py-1 rounded-full inline-flex items-center gap-1 ${supaStatus==="connected"?"bg-emerald-500/20 text-emerald-400":"supaStatus==='error'?'bg-red-500/20 text-red-400':'bg-amber-500/20 text-amber-400'"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${supaStatus==="connected"?"bg-emerald-400":"supaStatus==='error'?'bg-red-400':'bg-amber-400'"}`}/>
            {supaStatus==="connected"?"Supabase Connected":supaStatus==="error"?"Connection Error":"Connecting..."}
          </div>
        </div>
        
        <nav className="flex-1 py-4 px-3 overflow-y-auto">
          {groups.map(group => (
            <div key={group} className="mb-4">
              <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">{group}</p>
              {NAV.filter(n=>n.group===group).map(({id, label, icon:Icon}) => (
                <button key={id} onClick={()=>onTabChange(id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all mb-0.5 ${activeTab===id?`${GROUP_COLORS[group]||"bg-blue-600"} text-white shadow-lg shadow-blue-900/20`:"text-slate-400 hover:text-white hover:bg-white/5"}`}>
                  <Icon size={16}/><span className="font-medium">{label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5 space-y-3">
          {/* User card */}
          {currentUser && (() => {
            const email = currentUser.email || "";
            const name = currentUser.user_metadata?.full_name || email.split("@")[0];
            const initials = name.split(/[._\s]/).map(p=>p[0]?.toUpperCase()).slice(0,2).join("");
            const colors = ["bg-blue-500","bg-violet-500","bg-emerald-500","bg-amber-500","bg-rose-500"];
            let h=0; for(const c of email) h=(h*31+c.charCodeAt(0))&0xffffffff;
            const color = colors[Math.abs(h)%colors.length];
            return (
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>{initials}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{name}</p>
                  <p className="text-[10px] text-slate-500 truncate">{email}</p>
                </div>
              </div>
            );
          })()}
          <div className="flex gap-2">
            <button onClick={onReset} className="flex-1 text-[10px] text-slate-500 hover:text-rose-400 font-medium py-1.5 rounded-lg hover:bg-white/5 transition-colors">
              Reset Data
            </button>
            <button onClick={onLogout} className="flex items-center gap-1.5 text-[10px] text-slate-500 hover:text-white font-medium py-1.5 px-3 rounded-lg hover:bg-white/5 transition-colors">
              <LogOut size={11}/>Sign out
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="bg-white h-14 border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-10">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-800">{activeItem?.label}</h2>
            <span className="text-xs text-slate-400">FY 2025–2028</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              {["financial","calendar"].map(b=>(
                <button key={b} onClick={()=>setYearBasis(b)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${yearBasis===b?"bg-white text-blue-600 shadow-sm":"text-slate-500 hover:text-slate-700"}`}>
                  {b==="financial"?"FY":"CY"}
                </button>
              ))}
            </div>
            <div className="relative">
              <Calendar size={12} className="absolute left-2.5 top-2 text-slate-400"/>
              <select value={selectedYear} onChange={e=>setSelectedYear(e.target.value)}
                className="pl-7 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-400 outline-none text-slate-700">
                <option value="All">All Time</option>
                {availableYears.map(y=><option key={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </main>
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  // ── Auth state ──────────────────────────────────────────────────────────────
  const [authState, setAuthState] = useState("checking"); // "checking"|"login"|"change-password"|"app"
  const [currentUser, setCurrentUser] = useState(null);

  // ── App state ───────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("dashboard");
  const [yearBasis, setYearBasis] = useState("financial");
  const [showAnomalyPanel, setShowAnomalyPanel] = useState(false);
  const [selectedYear, setSelectedYear] = useState("All");
  const [unitAdjustments, setUnitAdjustments] = useState({});
  const [coaAdjustments, setCoaAdjustments] = useState({});
  const [hiringEvents, setHiringEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [supaStatus, setSupaStatus] = useState("connecting");

  // ── On mount: restore session ────────────────────────────────────────────────
  useEffect(() => {
    async function checkSession() {
      const session = await sbGetSession();
      if (session?.user) {
        setCurrentUser(session.user);
        const meta = session.user.user_metadata || session.user.raw_user_meta_data || {};
        const mustChange = meta.must_change_password === true;
        setAuthState(mustChange ? "change-password" : "app");
      } else {
        setAuthState("login");
      }
    }
    checkSession();
  }, []);

  // ── Load app data once authenticated ────────────────────────────────────────
  useEffect(() => {
    if (authState !== "app") return;
    async function loadData() {
      try {
        const adjData = await sbGet("unit_adjustments");
        if (adjData && Array.isArray(adjData) && adjData.length > 0) {
          const adj = {};
          adjData.forEach(row => { if(row.key && row.value!==null) adj[row.key] = row.value; });
          setUnitAdjustments(adj);
          console.log(`✓ Loaded ${adjData.length} unit adjustments from Supabase`);
        } else {
          // Fallback to localStorage if Supabase table empty or missing
          const saved = localStorage.getItem("unit_model_adjustments");
          if (saved) { setUnitAdjustments(JSON.parse(saved)); console.log("✓ Unit adjustments loaded from localStorage fallback"); }
        }

        const hireData = await sbGet("hiring_plan");
        if (hireData && Array.isArray(hireData) && hireData.length > 0) {
          setHiringEvents(hireData.map(r => ({id:r.id||Math.random().toString(36).slice(2), roleId:r.role_id, count:r.count, startMonth:r.start_month, region:r.region, filled:!!r.filled, eventType:r.event_type||"hire"})));
        } else {
          const savedHires = localStorage.getItem("staff_hiring_plan");
          if (savedHires) setHiringEvents(JSON.parse(savedHires));
        }

        const coaData = await sbGet("coa_adjustments");
        if (coaData && Array.isArray(coaData) && coaData.length > 0) {
          const coa = {};
          coaData.forEach(row => { if(row.key && row.value!==null) coa[row.key] = row.value; });
          setCoaAdjustments(coa);
          console.log(`✓ Loaded ${coaData.length} COA adjustments from Supabase`);
        } else {
          const savedCoa = localStorage.getItem("coa_adjustments");
          if (savedCoa) setCoaAdjustments(JSON.parse(savedCoa));
        }
        setSupaStatus("connected");
      } catch(e) {
        console.warn("Supabase load failed, using localStorage fallback:", e);
        setSupaStatus("error");
        try {
          const saved = localStorage.getItem("unit_model_adjustments");
          if(saved) setUnitAdjustments(JSON.parse(saved));
          const savedHires = localStorage.getItem("staff_hiring_plan");
          if(savedHires) setHiringEvents(JSON.parse(savedHires));
          const savedCoa = localStorage.getItem("coa_adjustments");
          if(savedCoa) setCoaAdjustments(JSON.parse(savedCoa));
        } catch {}
      }
      setLoading(false);
    }
    loadData();
  }, [authState]);

  // Filled hires are treated as committed — they feed into the true cost/revenue position
  const filledHires = useMemo(() => hiringEvents.filter(ev => ev.filled), [hiringEvents]);
  const data = useMemo(() => buildBaselineData(unitAdjustments, filledHires, coaAdjustments), [unitAdjustments, filledHires, coaAdjustments]);

  const availableYears = useMemo(() => {
    const s = new Set();
    data.months.forEach(m => {
      const d = parseDate(m);
      s.add(yearBasis==="calendar" ? getCalendarYear(d) : getFinancialYear(d));
    });
    return [...s].sort();
  }, [data.months, yearBasis]);

  // ── Auth handlers ──────────────────────────────────────────────────────────
  const handleLogin = async (user, token, mustChange) => {
    setCurrentUser(user);
    await sbAudit(user, "LOGIN", "AUTH", `Signed in from ${navigator.userAgent.slice(0,60)}`);
    setAuthState(mustChange ? "change-password" : "app");
  };

  const handlePasswordChanged = () => {
    setAuthState("app");
  };

  const handleLogout = async () => {
    await sbAudit(currentUser, "LOGOUT", "AUTH", "Signed out");
    await sbSignOut();
    setCurrentUser(null);
    setAuthState("login");
    // Clear state
    setUnitAdjustments({});
    setHiringEvents([]);
    setCoaAdjustments({});
    setLoading(true);
  };

  // ── Data handlers (all audit-logged) ───────────────────────────────────────
  const handleUpdateUnits = (region, code, month, newUnits) => {
    setUnitAdjustments(prev => {
      const key = `${region}|${code}|${month}`;
      const oldVal = prev[key];
      const next = {...prev, [key]: newUnits};
      localStorage.setItem("unit_model_adjustments", JSON.stringify(next));
      sbAudit(currentUser, "UPDATE", "UNIT", `${region} · ${code} · ${month}`, oldVal ?? null, newUnits);
      return next;
    });
  };

  const handleUpdateCoa = (fy, account, mk, value) => {
    setCoaAdjustments(prev => {
      const key = `${fy}|${account}|${mk}`;
      const oldVal = prev[key];
      let next;
      if (value === -1) {
        const { [key]: _removed, ...rest } = prev;
        next = rest;
        sbAudit(currentUser, "DELETE", "COA", `Reset ${account} · ${mk} (${fy})`, oldVal ?? null, null);
      } else {
        next = { ...prev, [key]: value };
        sbAudit(currentUser, "UPDATE", "COA", `${account} · ${mk} (${fy})`, oldVal ?? null, value);
      }
      localStorage.setItem("coa_adjustments", JSON.stringify(next));
      return next;
    });
  };

  const handleSaveCoa = async () => {
    setSaving(true);
    try {
      const rows = Object.entries(coaAdjustments).map(([key, value]) => ({ key, value }));
      // Always save localStorage first
      localStorage.setItem("coa_adjustments", JSON.stringify(coaAdjustments));
      if (rows.length > 0) {
        const ok = await sbUpsert("coa_adjustments", rows);
        if (!ok) throw new Error("Supabase upsert returned not-ok");
        console.log("COA saved to Supabase:", rows.length, "rows");
      }
      await sbAudit(currentUser, "UPDATE", "COA", "Saved COA to database (" + rows.length + " overrides)");
    } catch(e) {
      console.error("COA Supabase save failed, localStorage fallback used:", e);
    }
    setSaving(false);
  };

  const handleSaveAdjustments = async () => {
    setSaving(true);
    try {
      const rows = Object.entries(unitAdjustments).map(([key, value]) => ({key, value}));
      // Always save to localStorage first as reliable fallback
      localStorage.setItem("unit_model_adjustments", JSON.stringify(unitAdjustments));
      if (rows.length > 0) {
        const ok = await sbUpsert("unit_adjustments", rows);
        if (!ok) throw new Error("Supabase upsert returned not-ok");
      }
      await sbAudit(currentUser, "UPDATE", "UNIT", `Saved unit adjustments (${rows.length} overrides)`);
      console.log(`✓ Unit adjustments saved: ${rows.length} rows`);
    } catch(e) {
      console.error("Supabase save failed, localStorage used as fallback:", e);
      // localStorage already saved above — data is safe
    }
    setSaving(false);
  };

  const handleSaveHiring = async (events) => {
    setSaving(true);
    try {
      const rows = (events||hiringEvents).map(ev => ({id:ev.id, role_id:ev.roleId, count:ev.count, start_month:ev.startMonth, region:ev.region, filled:!!ev.filled, event_type:ev.eventType||"hire"}));
      if (rows.length > 0) await sbUpsert("hiring_plan", rows);
      localStorage.setItem("staff_hiring_plan", JSON.stringify(events||hiringEvents));
      await sbAudit(currentUser, "UPDATE", "HIRE", `Saved hiring plan (${rows.length} events)`);
    } catch(e) { console.error("Save failed:", e); }
    setSaving(false);
  };

  const handleReset = () => {
    if(confirm("Reset all data? This will clear your adjustments and hiring plan.")) {
      sbAudit(currentUser, "DELETE", "UNIT", "Reset all unit + COA + hiring data");
      setUnitAdjustments({});
      setHiringEvents([]);
      setCoaAdjustments({});
      localStorage.removeItem("unit_model_adjustments");
      localStorage.removeItem("staff_hiring_plan");
      localStorage.removeItem("coa_adjustments");
    }
  };

  // ── Anomaly detection — must be called unconditionally (Rules of Hooks) ──────
  const { anomalies, anomalyStatus, lastScanned, runScan } = useAnomalyDetection(coaAdjustments);

  // ── Auth gate rendering ─────────────────────────────────────────────────────
  if (authState === "checking") return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-[#0f172a] gap-4" style={{fontFamily:"'DM Sans', system-ui, sans-serif"}}>
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-xl">E</div>
      <Loader2 className="animate-spin text-blue-400" size={28}/>
      <p className="text-slate-500 text-sm">Checking session…</p>
    </div>
  );

  if (authState === "login") return <LoginScreen onLogin={handleLogin}/>;

  if (authState === "change-password") return <PasswordChangeScreen user={currentUser} onComplete={handlePasswordChanged}/>;

  if(loading) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 gap-4" style={{fontFamily:"'DM Sans', system-ui, sans-serif"}}>
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-xl">E</div>
      <Loader2 className="animate-spin text-blue-600" size={32}/>
      <p className="text-slate-500 text-sm">Loading EduGrowth BI...</p>
    </div>
  );

  const props = {data, yearBasis, selectedYear};

  return (
    <Layout
      activeTab={activeTab} onTabChange={setActiveTab}
      yearBasis={yearBasis} setYearBasis={setYearBasis}
      selectedYear={selectedYear} setSelectedYear={setSelectedYear}
      availableYears={availableYears}
      onReset={handleReset}
      supaStatus={supaStatus}
      currentUser={currentUser}
      onLogout={handleLogout}
    >
      {activeTab==="dashboard" && <DashboardOverview {...props} hiringEvents={hiringEvents} anomalies={anomalies} anomalyStatus={anomalyStatus} lastScanned={lastScanned} onShowAnomalies={()=>setActiveTab("aianalytics")}/>}
      {activeTab==="regions"   && <RegionalAnalysis {...props}/>}
      {activeTab==="expenses"  && <ExpensesView {...props} coaAdjustments={coaAdjustments} onUpdateCoa={handleUpdateCoa} onSaveCoa={handleSaveCoa} saving={saving} filledHires={filledHires}/>}
      {activeTab==="modeler"   && <UnitModeler {...props} onUpdateUnits={handleUpdateUnits} onSave={handleSaveAdjustments} saving={saving}/>}
      {activeTab==="staff"     && <StaffPlanner {...props} hiringEvents={hiringEvents} setHiringEvents={setHiringEvents} onSaveHiring={handleSaveHiring}/>}
      {activeTab==="crm"       && <CRMSalesReport {...props}/>}
      {activeTab==="data"      && <RawDataTable {...props}/>}
      {activeTab==="audit"     && <AuditLogView/>}
      {activeTab==="aianalytics" && (
        <div className="space-y-5">
          <AnomalyPanel anomalies={anomalies} anomalyStatus={anomalyStatus} lastScanned={lastScanned} onRescan={runScan}/>
          <MonthlyNarrativePanel data={data} coaAdjustments={coaAdjustments} currentUser={currentUser}/>
          <CashflowForecastPanel data={data} coaAdjustments={coaAdjustments}/>
        </div>
      )}
      <GeminiAssistant
        data={data}
        coaAdjustments={coaAdjustments}
        hiringEvents={hiringEvents}
        filledHires={filledHires}
        currentUser={currentUser}
      />
    </Layout>
  );
}
