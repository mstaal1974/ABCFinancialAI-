import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { AreaChart, Area, BarChart, Bar, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, ReferenceLine } from "recharts";

// ─────────────────────────────────────────────────────────────
// SUPABASE CLIENT  (no npm needed — uses the CDN REST API directly)
// ─────────────────────────────────────────────────────────────
const SUPABASE_URL  = "https://juygejpmyujvahsxnrxa.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1eWdlanBteXVqdmFoc3hucnhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NDI4NjAsImV4cCI6MjA4NzQxODg2MH0.OgkqrQ8YHvRHQs-m5Qe58EYtFxRPK29N_ce0kM2tUfw";

const sbHeaders = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_ANON,
  "Authorization": `Bearer ${SUPABASE_ANON}`,
};

async function sbSelect(table, params = "") {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { headers: sbHeaders });
  if (!r.ok) throw new Error(`GET ${table} failed: ${r.status} ${await r.text()}`);
  return r.json();
}

async function sbUpsert(table, rows) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...sbHeaders, "Prefer": "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(Array.isArray(rows) ? rows : [rows]),
  });
  if (!r.ok) throw new Error(`UPSERT ${table} failed: ${r.status} ${await r.text()}`);
  return r.json();
}

async function sbDelete(table, match) {
  const params = Object.entries(match).map(([k,v]) => `${k}=eq.${encodeURIComponent(v)}`).join("&");
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    method: "DELETE", headers: sbHeaders,
  });
  if (!r.ok) throw new Error(`DELETE ${table} failed: ${r.status} ${await r.text()}`);
  return true;
}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const REGIONS = ["QLD","NSW","VIC","WA","SA","NT","TAS","ACT"];
const COURSE_NAMES = {MSL20122:"Cert II Lab Skills",MSL30122:"Cert III Lab Skills",MSL40122:"Cert IV Lab Skills",MSL50122:"Dip Lab Tech",HLT37215:"Cert III Pathology",FFS:"Fee for Service"};
const REGION_COLORS = {QLD:"#f97316",NSW:"#0ea5e9",VIC:"#8b5cf6",WA:"#14b8a6",SA:"#22c55e",NT:"#ef4444",TAS:"#f59e0b",ACT:"#ec4899"};
const MONTHS = ["Jul-24","Aug-24","Sep-24","Oct-24","Nov-24","Dec-24","Jan-25","Feb-25","Mar-25","Apr-25","May-25","Jun-25","Jul-25","Aug-25","Sep-25","Oct-25","Nov-25","Dec-25","Jan-26","Feb-26","Mar-26","Apr-26","May-26","Jun-26"];
const SEASONAL = [0.7,0.8,0.9,1.0,1.1,0.6,0.7,0.9,1.0,1.1,1.2,0.8,0.7,0.8,0.9,1.0,1.1,0.6,0.7,0.9,1.0,1.1,1.2,0.8];

const SEED_PAYMENTS = [{"month":"Jul-24","payments":402642.62,"opening_balance":1200000},{"month":"Aug-24","payments":433771.88,"opening_balance":0},{"month":"Sep-24","payments":414660.76,"opening_balance":0},{"month":"Oct-24","payments":416004.53,"opening_balance":0},{"month":"Nov-24","payments":420136.3,"opening_balance":0},{"month":"Dec-24","payments":398274.07,"opening_balance":0},{"month":"Jan-25","payments":381207.81,"opening_balance":0},{"month":"Feb-25","payments":443177.27,"opening_balance":0},{"month":"Mar-25","payments":461086.07,"opening_balance":0},{"month":"Apr-25","payments":557251.57,"opening_balance":0},{"month":"May-25","payments":554619.37,"opening_balance":0},{"month":"Jun-25","payments":554914.57,"opening_balance":0},{"month":"Jul-25","payments":491027.59,"opening_balance":0},{"month":"Aug-25","payments":528990.1,"opening_balance":0},{"month":"Sep-25","payments":505683.85,"opening_balance":0},{"month":"Oct-25","payments":507322.6,"opening_balance":0},{"month":"Nov-25","payments":512361.34,"opening_balance":0},{"month":"Dec-25","payments":485700.09,"opening_balance":0},{"month":"Jan-26","payments":464887.57,"opening_balance":0},{"month":"Feb-26","payments":540460.09,"opening_balance":0},{"month":"Mar-26","payments":562300.09,"opening_balance":0},{"month":"Apr-26","payments":679575.09,"opening_balance":0},{"month":"May-26","payments":676365.09,"opening_balance":0},{"month":"Jun-26","payments":676725.09,"opening_balance":0}];

const _U1 = [{"region":"QLD","code":"MSL20122","name":"Cert II Laboratory Skills","price":338.75,"month":"Jul-24","units":1528,"revenue":517610.0,"budget":491729.5},{"region":"QLD","code":"MSL20122","name":"Cert II Laboratory Skills","price":338.75,"month":"Aug-24","units":312,"revenue":105690.0,"budget":100405.5},{"region":"QLD","code":"MSL20122","name":"Cert II Laboratory Skills","price":338.75,"month":"Sep-24","units":128,"revenue":43360.0,"budget":41192.0},{"region":"QLD","code":"MSL20122","name":"Cert II Laboratory Skills","price":338.75,"month":"Oct-24","units":144,"revenue":48780.0,"budget":46341.0},{"region":"QLD","code":"MSL20122","name":"Cert II Laboratory Skills","price":338.75,"month":"Nov-24","units":240,"revenue":81300.0,"budget":77235.0},{"region":"QLD","code":"MSL20122","name":"Cert II Laboratory Skills","price":338.75,"month":"Dec-24","units":100,"revenue":33875.0,"budget":32181.25},{"region":"QLD","code":"MSL20122","name":"Cert II Laboratory Skills","price":338.75,"month":"Jan-25","units":20,"revenue":6775.0,"budget":6436.25},{"region":"QLD","code":"MSL20122","name":"Cert II Laboratory Skills","price":338.75,"month":"Feb-25","units":30,"revenue":10162.5,"budget":9654.38},{"region":"QLD","code":"MSL20122","name":"Cert II Laboratory Skills","price":338.75,"month":"Mar-25","units":80,"revenue":27100.0,"budget":25745.0},{"region":"QLD","code":"MSL20122","name":"Cert II Laboratory Skills","price":338.75,"month":"Apr-25","units":320,"revenue":108400.0,"budget":102980.0},{"region":"QLD","code":"MSL20122","name":"Cert II Laboratory Skills","price":338.75,"month":"May-25","units":410,"revenue":138887.5,"budget":131943.12},{"region":"QLD","code":"MSL20122","name":"Cert II Laboratory Skills","price":338.75,"month":"Jun-25","units":3830,"revenue":1297412.5,"budget":1232541.88},{"region":"QLD","code":"MSL20122","name":"Cert II Laboratory Skills","price":338.75,"month":"Jul-25","units":1604,"revenue":543355.0,"budget":516187.25},{"region":"QLD","code":"MSL20122","name":"Cert II Laboratory Skills","price":338.75,"month":"Aug-25","units":328,"revenue":111110.0,"budget":105554.5},{"region":"QLD","code":"MSL20122","name":"Cert II Laboratory Skills","price":338.75,"month":"Sep-25","units":134,"revenue":45392.5,"budget":43122.88},{"region":"QLD","code":"MSL20122","name":"Cert II Laboratory Skills","price":338.75,"month":"Oct-25","units":151,"revenue":51151.25,"budget":48593.69},{"region":"QLD","code":"MSL20122","name":"Cert II Laboratory Skills","price":338.75,"month":"Nov-25","units":252,"revenue":85365.0,"budget":81096.75},{"region":"QLD","code":"MSL20122","name":"Cert II Laboratory Skills","price":338.75,"month":"Dec-25","units":136,"revenue":46070.0,"budget":43766.5},{"region":"QLD","code":"MSL20122","name":"Cert II Laboratory Skills","price":338.75,"month":"Jan-26","units":480,"revenue":162600.0,"budget":154470.0},{"region":"QLD","code":"MSL20122","name":"Cert II Laboratory Skills","price":338.75,"month":"Feb-26","units":80,"revenue":27100.0,"budget":25745.0},{"region":"QLD","code":"MSL20122","name":"Cert II Laboratory Skills","price":338.75,"month":"Mar-26","units":100,"revenue":33875.0,"budget":32181.25},{"region":"QLD","code":"MSL20122","name":"Cert II Laboratory Skills","price":338.75,"month":"Apr-26","units":240,"revenue":81300.0,"budget":77235.0},{"region":"QLD","code":"MSL20122","name":"Cert II Laboratory Skills","price":338.75,"month":"May-26","units":416,"revenue":140920.0,"budget":133874.0},{"region":"QLD","code":"MSL20122","name":"Cert II Laboratory Skills","price":338.75,"month":"Jun-26","units":4213,"revenue":1427153.75,"budget":1355796.06},{"region":"QLD","code":"MSL30122","name":"Cert III Laboratory Skills","price":391.69,"month":"Jul-24","units":20,"revenue":7833.85,"budget":7442.16},{"region":"QLD","code":"MSL30122","name":"Cert III Laboratory Skills","price":391.69,"month":"Aug-24","units":20,"revenue":7833.85,"budget":7442.16},{"region":"QLD","code":"MSL30122","name":"Cert III Laboratory Skills","price":391.69,"month":"Sep-24","units":20,"revenue":7833.85,"budget":7442.16},{"region":"QLD","code":"MSL30122","name":"Cert III Laboratory Skills","price":391.69,"month":"Oct-24","units":20,"revenue":7833.85,"budget":7442.16},{"region":"QLD","code":"MSL30122","name":"Cert III Laboratory Skills","price":391.69,"month":"Nov-24","units":20,"revenue":7833.85,"budget":7442.16},{"region":"QLD","code":"MSL30122","name":"Cert III Laboratory Skills","price":391.69,"month":"Dec-24","units":10,"revenue":3916.92,"budget":3721.07},{"region":"QLD","code":"MSL30122","name":"Cert III Laboratory Skills","price":391.69,"month":"Jan-25","units":10,"revenue":3916.92,"budget":3721.07},{"region":"QLD","code":"MSL30122","name":"Cert III Laboratory Skills","price":391.69,"month":"Feb-25","units":20,"revenue":7833.85,"budget":7442.16},{"region":"QLD","code":"MSL30122","name":"Cert III Laboratory Skills","price":391.69,"month":"Mar-25","units":22,"revenue":8617.23,"budget":8186.37},{"region":"QLD","code":"MSL30122","name":"Cert III Laboratory Skills","price":391.69,"month":"Apr-25","units":22,"revenue":8617.23,"budget":8186.37},{"region":"QLD","code":"MSL30122","name":"Cert III Laboratory Skills","price":391.69,"month":"May-25","units":22,"revenue":8617.23,"budget":8186.37},{"region":"QLD","code":"MSL30122","name":"Cert III Laboratory Skills","price":391.69,"month":"Jun-25","units":22,"revenue":8617.23,"budget":8186.37},{"region":"QLD","code":"MSL30122","name":"Cert III Laboratory Skills","price":391.69,"month":"Jul-25","units":22,"revenue":8617.23,"budget":8186.37},{"region":"QLD","code":"MSL30122","name":"Cert III Laboratory Skills","price":391.69,"month":"Aug-25","units":22,"revenue":8617.23,"budget":8186.37},{"region":"QLD","code":"MSL30122","name":"Cert III Laboratory Skills","price":391.69,"month":"Sep-25","units":22,"revenue":8617.23,"budget":8186.37},{"region":"QLD","code":"MSL30122","name":"Cert III Laboratory Skills","price":391.69,"month":"Oct-25","units":22,"revenue":8617.23,"budget":8186.37},{"region":"QLD","code":"MSL30122","name":"Cert III Laboratory Skills","price":391.69,"month":"Nov-25","units":22,"revenue":8617.23,"budget":8186.37},{"region":"QLD","code":"MSL30122","name":"Cert III Laboratory Skills","price":391.69,"month":"Dec-25","units":15,"revenue":5875.38,"budget":5581.61},{"region":"QLD","code":"MSL30122","name":"Cert III Laboratory Skills","price":391.69,"month":"Jan-26","units":15,"revenue":5875.38,"budget":5581.61},{"region":"QLD","code":"MSL30122","name":"Cert III Laboratory Skills","price":391.69,"month":"Feb-26","units":22,"revenue":8617.23,"budget":8186.37},{"region":"QLD","code":"MSL30122","name":"Cert III Laboratory Skills","price":391.69,"month":"Mar-26","units":24,"revenue":9400.62,"budget":8930.59},{"region":"QLD","code":"MSL30122","name":"Cert III Laboratory Skills","price":391.69,"month":"Apr-26","units":24,"revenue":9400.62,"budget":8930.59},{"region":"QLD","code":"MSL30122","name":"Cert III Laboratory Skills","price":391.69,"month":"May-26","units":24,"revenue":9400.62,"budget":8930.59},{"region":"QLD","code":"MSL30122","name":"Cert III Laboratory Skills","price":391.69,"month":"Jun-26","units":24,"revenue":9400.62,"budget":8930.59},{"region":"QLD","code":"MSL40122","name":"Cert IV Laboratory Skills","price":770.0,"month":"Jul-24","units":80,"revenue":61600.0,"budget":58520.0},{"region":"QLD","code":"MSL40122","name":"Cert IV Laboratory Skills","price":770.0,"month":"Aug-24","units":80,"revenue":61600.0,"budget":58520.0},{"region":"QLD","code":"MSL40122","name":"Cert IV Laboratory Skills","price":770.0,"month":"Sep-24","units":80,"revenue":61600.0,"budget":58520.0},{"region":"QLD","code":"MSL40122","name":"Cert IV Laboratory Skills","price":770.0,"month":"Oct-24","units":80,"revenue":61600.0,"budget":58520.0},{"region":"QLD","code":"MSL40122","name":"Cert IV Laboratory Skills","price":770.0,"month":"Nov-24","units":80,"revenue":61600.0,"budget":58520.0},{"region":"QLD","code":"MSL40122","name":"Cert IV Laboratory Skills","price":770.0,"month":"Dec-24","units":60,"revenue":46200.0,"budget":43890.0},{"region":"QLD","code":"MSL40122","name":"Cert IV Laboratory Skills","price":770.0,"month":"Jan-25","units":60,"revenue":46200.0,"budget":43890.0},{"region":"QLD","code":"MSL40122","name":"Cert IV Laboratory Skills","price":770.0,"month":"Feb-25","units":80,"revenue":61600.0,"budget":58520.0},{"region":"QLD","code":"MSL40122","name":"Cert IV Laboratory Skills","price":770.0,"month":"Mar-25","units":88,"revenue":67760.0,"budget":64372.0},{"region":"QLD","code":"MSL40122","name":"Cert IV Laboratory Skills","price":770.0,"month":"Apr-25","units":88,"revenue":67760.0,"budget":64372.0},{"region":"QLD","code":"MSL40122","name":"Cert IV Laboratory Skills","price":770.0,"month":"May-25","units":88,"revenue":67760.0,"budget":64372.0},{"region":"QLD","code":"MSL40122","name":"Cert IV Laboratory Skills","price":770.0,"month":"Jun-25","units":97,"revenue":74690.0,"budget":70955.5}];

const _U2 = [{"region":"QLD","code":"MSL40122","name":"Cert IV Laboratory Skills","price":770.0,"month":"Jul-25","units":97,"revenue":74690.0,"budget":70955.5},{"region":"QLD","code":"MSL40122","name":"Cert IV Laboratory Skills","price":770.0,"month":"Aug-25","units":97,"revenue":74690.0,"budget":70955.5},{"region":"QLD","code":"MSL40122","name":"Cert IV Laboratory Skills","price":770.0,"month":"Sep-25","units":97,"revenue":74690.0,"budget":70955.5},{"region":"QLD","code":"MSL40122","name":"Cert IV Laboratory Skills","price":770.0,"month":"Oct-25","units":97,"revenue":74690.0,"budget":70955.5},{"region":"QLD","code":"MSL40122","name":"Cert IV Laboratory Skills","price":770.0,"month":"Nov-25","units":97,"revenue":74690.0,"budget":70955.5},{"region":"QLD","code":"MSL40122","name":"Cert IV Laboratory Skills","price":770.0,"month":"Dec-25","units":48,"revenue":36960.0,"budget":35112.0},{"region":"QLD","code":"MSL40122","name":"Cert IV Laboratory Skills","price":770.0,"month":"Jan-26","units":48,"revenue":36960.0,"budget":35112.0},{"region":"QLD","code":"MSL40122","name":"Cert IV Laboratory Skills","price":770.0,"month":"Feb-26","units":97,"revenue":74690.0,"budget":70955.5},{"region":"QLD","code":"MSL40122","name":"Cert IV Laboratory Skills","price":770.0,"month":"Mar-26","units":116,"revenue":89320.0,"budget":84854.0},{"region":"QLD","code":"MSL40122","name":"Cert IV Laboratory Skills","price":770.0,"month":"Apr-26","units":139,"revenue":107030.0,"budget":101678.5},{"region":"QLD","code":"MSL40122","name":"Cert IV Laboratory Skills","price":770.0,"month":"May-26","units":167,"revenue":128590.0,"budget":122160.5},{"region":"QLD","code":"MSL40122","name":"Cert IV Laboratory Skills","price":770.0,"month":"Jun-26","units":201,"revenue":154770.0,"budget":147031.5},{"region":"QLD","code":"MSL50122","name":"Diploma Laboratory Technology","price":265.56,"month":"Jul-24","units":15,"revenue":3983.33,"budget":3784.16},{"region":"QLD","code":"MSL50122","name":"Diploma Laboratory Technology","price":265.56,"month":"Aug-24","units":20,"revenue":5311.11,"budget":5045.55},{"region":"QLD","code":"MSL50122","name":"Diploma Laboratory Technology","price":265.56,"month":"Sep-24","units":20,"revenue":5311.11,"budget":5045.55},{"region":"QLD","code":"MSL50122","name":"Diploma Laboratory Technology","price":265.56,"month":"Oct-24","units":20,"revenue":5311.11,"budget":5045.55},{"region":"QLD","code":"MSL50122","name":"Diploma Laboratory Technology","price":265.56,"month":"Nov-24","units":20,"revenue":5311.11,"budget":5045.55},{"region":"QLD","code":"MSL50122","name":"Diploma Laboratory Technology","price":265.56,"month":"Dec-24","units":10,"revenue":2655.56,"budget":2522.78},{"region":"QLD","code":"MSL50122","name":"Diploma Laboratory Technology","price":265.56,"month":"Jan-25","units":10,"revenue":2655.56,"budget":2522.78},{"region":"QLD","code":"MSL50122","name":"Diploma Laboratory Technology","price":265.56,"month":"Feb-25","units":22,"revenue":5842.22,"budget":5550.11},{"region":"QLD","code":"MSL50122","name":"Diploma Laboratory Technology","price":265.56,"month":"Mar-25","units":22,"revenue":5842.22,"budget":5550.11},{"region":"QLD","code":"MSL50122","name":"Diploma Laboratory Technology","price":265.56,"month":"Apr-25","units":22,"revenue":5842.22,"budget":5550.11},{"region":"QLD","code":"MSL50122","name":"Diploma Laboratory Technology","price":265.56,"month":"May-25","units":22,"revenue":5842.22,"budget":5550.11},{"region":"QLD","code":"MSL50122","name":"Diploma Laboratory Technology","price":265.56,"month":"Jun-25","units":11,"revenue":2921.11,"budget":2775.05},{"region":"QLD","code":"MSL50122","name":"Diploma Laboratory Technology","price":265.56,"month":"Jul-25","units":11,"revenue":2921.11,"budget":2775.05},{"region":"QLD","code":"MSL50122","name":"Diploma Laboratory Technology","price":265.56,"month":"Aug-25","units":24,"revenue":6373.33,"budget":6054.66},{"region":"QLD","code":"MSL50122","name":"Diploma Laboratory Technology","price":265.56,"month":"Sep-25","units":24,"revenue":6373.33,"budget":6054.66},{"region":"QLD","code":"MSL50122","name":"Diploma Laboratory Technology","price":265.56,"month":"Oct-25","units":24,"revenue":6373.33,"budget":6054.66},{"region":"QLD","code":"MSL50122","name":"Diploma Laboratory Technology","price":265.56,"month":"Nov-25","units":24,"revenue":6373.33,"budget":6054.66},{"region":"QLD","code":"MSL50122","name":"Diploma Laboratory Technology","price":265.56,"month":"Dec-25","units":12,"revenue":3186.67,"budget":3027.34},{"region":"QLD","code":"MSL50122","name":"Diploma Laboratory Technology","price":265.56,"month":"Jan-26","units":12,"revenue":3186.67,"budget":3027.34},{"region":"QLD","code":"MSL50122","name":"Diploma Laboratory Technology","price":265.56,"month":"Feb-26","units":27,"revenue":7170.0,"budget":6811.5},{"region":"QLD","code":"MSL50122","name":"Diploma Laboratory Technology","price":265.56,"month":"Mar-26","units":27,"revenue":7170.0,"budget":6811.5},{"region":"QLD","code":"MSL50122","name":"Diploma Laboratory Technology","price":265.56,"month":"Apr-26","units":27,"revenue":7170.0,"budget":6811.5},{"region":"QLD","code":"MSL50122","name":"Diploma Laboratory Technology","price":265.56,"month":"May-26","units":27,"revenue":7170.0,"budget":6811.5},{"region":"QLD","code":"MSL50122","name":"Diploma Laboratory Technology","price":265.56,"month":"Jun-26","units":13,"revenue":3452.22,"budget":3279.61},{"region":"QLD","code":"HLT37215","name":"Cert III Pathology","price":450.71,"month":"Jul-24","units":50,"revenue":22535.71,"budget":21408.92},{"region":"QLD","code":"HLT37215","name":"Cert III Pathology","price":450.71,"month":"Aug-24","units":50,"revenue":22535.71,"budget":21408.92},{"region":"QLD","code":"HLT37215","name":"Cert III Pathology","price":450.71,"month":"Sep-24","units":50,"revenue":22535.71,"budget":21408.92},{"region":"QLD","code":"HLT37215","name":"Cert III Pathology","price":450.71,"month":"Oct-24","units":50,"revenue":22535.71,"budget":21408.92},{"region":"QLD","code":"HLT37215","name":"Cert III Pathology","price":450.71,"month":"Nov-24","units":50,"revenue":22535.71,"budget":21408.92},{"region":"QLD","code":"HLT37215","name":"Cert III Pathology","price":450.71,"month":"Dec-24","units":40,"revenue":18028.57,"budget":17127.14},{"region":"QLD","code":"HLT37215","name":"Cert III Pathology","price":450.71,"month":"Jan-25","units":30,"revenue":13521.43,"budget":12845.36},{"region":"QLD","code":"HLT37215","name":"Cert III Pathology","price":450.71,"month":"Feb-25","units":60,"revenue":27042.86,"budget":25690.72},{"region":"QLD","code":"HLT37215","name":"Cert III Pathology","price":450.71,"month":"Mar-25","units":60,"revenue":27042.86,"budget":25690.72},{"region":"QLD","code":"HLT37215","name":"Cert III Pathology","price":450.71,"month":"Apr-25","units":60,"revenue":27042.86,"budget":25690.72},{"region":"QLD","code":"HLT37215","name":"Cert III Pathology","price":450.71,"month":"May-25","units":60,"revenue":27042.86,"budget":25690.72},{"region":"QLD","code":"HLT37215","name":"Cert III Pathology","price":450.71,"month":"Jun-25","units":60,"revenue":27042.86,"budget":25690.72},{"region":"QLD","code":"HLT37215","name":"Cert III Pathology","price":450.71,"month":"Jul-25","units":60,"revenue":27042.86,"budget":25690.72},{"region":"QLD","code":"HLT37215","name":"Cert III Pathology","price":450.71,"month":"Aug-25","units":60,"revenue":27042.86,"budget":25690.72},{"region":"QLD","code":"HLT37215","name":"Cert III Pathology","price":450.71,"month":"Sep-25","units":60,"revenue":27042.86,"budget":25690.72},{"region":"QLD","code":"HLT37215","name":"Cert III Pathology","price":450.71,"month":"Oct-25","units":60,"revenue":27042.86,"budget":25690.72},{"region":"QLD","code":"HLT37215","name":"Cert III Pathology","price":450.71,"month":"Nov-25","units":60,"revenue":27042.86,"budget":25690.72},{"region":"QLD","code":"HLT37215","name":"Cert III Pathology","price":450.71,"month":"Dec-25","units":30,"revenue":13521.43,"budget":12845.36},{"region":"QLD","code":"HLT37215","name":"Cert III Pathology","price":450.71,"month":"Jan-26","units":30,"revenue":13521.43,"budget":12845.36},{"region":"QLD","code":"HLT37215","name":"Cert III Pathology","price":450.71,"month":"Feb-26","units":50,"revenue":22535.71,"budget":21408.92},{"region":"QLD","code":"HLT37215","name":"Cert III Pathology","price":450.71,"month":"Mar-26","units":140,"revenue":63100.0,"budget":59945.0},{"region":"QLD","code":"HLT37215","name":"Cert III Pathology","price":450.71,"month":"Apr-26","units":170,"revenue":76621.43,"budget":72790.36},{"region":"QLD","code":"HLT37215","name":"Cert III Pathology","price":450.71,"month":"May-26","units":200,"revenue":90142.86,"budget":85635.72},{"region":"QLD","code":"HLT37215","name":"Cert III Pathology","price":450.71,"month":"Jun-26","units":230,"revenue":103664.29,"budget":98481.08}];

const _U3 = [{"region":"QLD","code":"FFS","name":"Fee for Service","price":350.0,"month":"Jul-24","units":15,"revenue":5250.0,"budget":4987.5},{"region":"QLD","code":"FFS","name":"Fee for Service","price":350.0,"month":"Aug-24","units":15,"revenue":5250.0,"budget":4987.5},{"region":"QLD","code":"FFS","name":"Fee for Service","price":350.0,"month":"Sep-24","units":15,"revenue":5250.0,"budget":4987.5},{"region":"QLD","code":"FFS","name":"Fee for Service","price":350.0,"month":"Oct-24","units":15,"revenue":5250.0,"budget":4987.5},{"region":"QLD","code":"FFS","name":"Fee for Service","price":350.0,"month":"Nov-24","units":15,"revenue":5250.0,"budget":4987.5},{"region":"QLD","code":"FFS","name":"Fee for Service","price":350.0,"month":"Dec-24","units":10,"revenue":3500.0,"budget":3325.0},{"region":"QLD","code":"FFS","name":"Fee for Service","price":350.0,"month":"Jan-25","units":10,"revenue":3500.0,"budget":3325.0},{"region":"QLD","code":"FFS","name":"Fee for Service","price":350.0,"month":"Feb-25","units":15,"revenue":5250.0,"budget":4987.5},{"region":"QLD","code":"FFS","name":"Fee for Service","price":350.0,"month":"Mar-25","units":15,"revenue":5250.0,"budget":4987.5},{"region":"QLD","code":"FFS","name":"Fee for Service","price":350.0,"month":"Apr-25","units":15,"revenue":5250.0,"budget":4987.5},{"region":"QLD","code":"FFS","name":"Fee for Service","price":350.0,"month":"May-25","units":16,"revenue":5600.0,"budget":5320.0},{"region":"QLD","code":"FFS","name":"Fee for Service","price":350.0,"month":"Jun-25","units":16,"revenue":5600.0,"budget":5320.0},{"region":"QLD","code":"FFS","name":"Fee for Service","price":350.0,"month":"Jul-25","units":16,"revenue":5600.0,"budget":5320.0},{"region":"QLD","code":"FFS","name":"Fee for Service","price":350.0,"month":"Aug-25","units":16,"revenue":5600.0,"budget":5320.0},{"region":"QLD","code":"FFS","name":"Fee for Service","price":350.0,"month":"Sep-25","units":16,"revenue":5600.0,"budget":5320.0},{"region":"QLD","code":"FFS","name":"Fee for Service","price":350.0,"month":"Oct-25","units":16,"revenue":5600.0,"budget":5320.0},{"region":"QLD","code":"FFS","name":"Fee for Service","price":350.0,"month":"Nov-25","units":11,"revenue":3850.0,"budget":3657.5},{"region":"QLD","code":"FFS","name":"Fee for Service","price":350.0,"month":"Dec-25","units":11,"revenue":3850.0,"budget":3657.5},{"region":"QLD","code":"FFS","name":"Fee for Service","price":350.0,"month":"Jan-26","units":11,"revenue":3850.0,"budget":3657.5},{"region":"QLD","code":"FFS","name":"Fee for Service","price":350.0,"month":"Feb-26","units":16,"revenue":5600.0,"budget":5320.0},{"region":"QLD","code":"FFS","name":"Fee for Service","price":350.0,"month":"Mar-26","units":16,"revenue":5600.0,"budget":5320.0},{"region":"QLD","code":"FFS","name":"Fee for Service","price":350.0,"month":"Apr-26","units":18,"revenue":6300.0,"budget":5985.0},{"region":"QLD","code":"FFS","name":"Fee for Service","price":350.0,"month":"May-26","units":18,"revenue":6300.0,"budget":5985.0},{"region":"QLD","code":"FFS","name":"Fee for Service","price":350.0,"month":"Jun-26","units":18,"revenue":6300.0,"budget":5985.0},{"region":"NSW","code":"MSL30122","name":"Cert III Laboratory Skills","price":594.62,"month":"Jul-24","units":20,"revenue":11892.31,"budget":11297.69},{"region":"NSW","code":"MSL30122","name":"Cert III Laboratory Skills","price":594.62,"month":"Aug-24","units":20,"revenue":11892.31,"budget":11297.69},{"region":"NSW","code":"MSL30122","name":"Cert III Laboratory Skills","price":594.62,"month":"Sep-24","units":20,"revenue":11892.31,"budget":11297.69},{"region":"NSW","code":"MSL30122","name":"Cert III Laboratory Skills","price":594.62,"month":"Oct-24","units":20,"revenue":11892.31,"budget":11297.69},{"region":"NSW","code":"MSL30122","name":"Cert III Laboratory Skills","price":594.62,"month":"Nov-24","units":20,"revenue":11892.31,"budget":11297.69},{"region":"NSW","code":"MSL30122","name":"Cert III Laboratory Skills","price":594.62,"month":"Dec-24","units":10,"revenue":5946.15,"budget":5648.84},{"region":"NSW","code":"MSL30122","name":"Cert III Laboratory Skills","price":594.62,"month":"Jan-25","units":10,"revenue":5946.15,"budget":5648.84},{"region":"NSW","code":"MSL30122","name":"Cert III Laboratory Skills","price":594.62,"month":"Feb-25","units":10,"revenue":5946.15,"budget":5648.84},{"region":"NSW","code":"MSL30122","name":"Cert III Laboratory Skills","price":594.62,"month":"Mar-25","units":10,"revenue":5946.15,"budget":5648.84},{"region":"NSW","code":"MSL30122","name":"Cert III Laboratory Skills","price":594.62,"month":"Apr-25","units":10,"revenue":5946.15,"budget":5648.84},{"region":"NSW","code":"MSL30122","name":"Cert III Laboratory Skills","price":594.62,"month":"May-25","units":10,"revenue":5946.15,"budget":5648.84},{"region":"NSW","code":"MSL30122","name":"Cert III Laboratory Skills","price":594.62,"month":"Jun-25","units":10,"revenue":5946.15,"budget":5648.84},{"region":"NSW","code":"MSL30122","name":"Cert III Laboratory Skills","price":594.62,"month":"Jul-25","units":10,"revenue":5946.15,"budget":5648.84},{"region":"NSW","code":"MSL30122","name":"Cert III Laboratory Skills","price":594.62,"month":"Aug-25","units":10,"revenue":5946.15,"budget":5648.84},{"region":"NSW","code":"MSL30122","name":"Cert III Laboratory Skills","price":594.62,"month":"Sep-25","units":10,"revenue":5946.15,"budget":5648.84},{"region":"NSW","code":"MSL30122","name":"Cert III Laboratory Skills","price":594.62,"month":"Oct-25","units":10,"revenue":5946.15,"budget":5648.84},{"region":"NSW","code":"MSL30122","name":"Cert III Laboratory Skills","price":594.62,"month":"Nov-25","units":10,"revenue":5946.15,"budget":5648.84},{"region":"NSW","code":"MSL30122","name":"Cert III Laboratory Skills","price":594.62,"month":"Dec-25","units":10,"revenue":5946.15,"budget":5648.84},{"region":"NSW","code":"MSL30122","name":"Cert III Laboratory Skills","price":594.62,"month":"Jan-26","units":10,"revenue":5946.15,"budget":5648.84},{"region":"NSW","code":"MSL30122","name":"Cert III Laboratory Skills","price":594.62,"month":"Feb-26","units":15,"revenue":8919.23,"budget":8473.27},{"region":"NSW","code":"MSL30122","name":"Cert III Laboratory Skills","price":594.62,"month":"Mar-26","units":18,"revenue":10703.08,"budget":10167.93},{"region":"NSW","code":"MSL30122","name":"Cert III Laboratory Skills","price":594.62,"month":"Apr-26","units":18,"revenue":10703.08,"budget":10167.93},{"region":"NSW","code":"MSL30122","name":"Cert III Laboratory Skills","price":594.62,"month":"May-26","units":20,"revenue":11892.31,"budget":11297.69},{"region":"NSW","code":"MSL30122","name":"Cert III Laboratory Skills","price":594.62,"month":"Jun-26","units":24,"revenue":14270.77,"budget":13557.23},{"region":"NSW","code":"MSL40122","name":"Cert IV Laboratory Skills","price":782.67,"month":"Jul-24","units":90,"revenue":70440.0,"budget":66918.0},{"region":"NSW","code":"MSL40122","name":"Cert IV Laboratory Skills","price":782.67,"month":"Aug-24","units":90,"revenue":70440.0,"budget":66918.0},{"region":"NSW","code":"MSL40122","name":"Cert IV Laboratory Skills","price":782.67,"month":"Sep-24","units":90,"revenue":70440.0,"budget":66918.0},{"region":"NSW","code":"MSL40122","name":"Cert IV Laboratory Skills","price":782.67,"month":"Oct-24","units":90,"revenue":70440.0,"budget":66918.0},{"region":"NSW","code":"MSL40122","name":"Cert IV Laboratory Skills","price":782.67,"month":"Nov-24","units":90,"revenue":70440.0,"budget":66918.0},{"region":"NSW","code":"MSL40122","name":"Cert IV Laboratory Skills","price":782.67,"month":"Dec-24","units":80,"revenue":62613.33,"budget":59482.66},{"region":"NSW","code":"MSL40122","name":"Cert IV Laboratory Skills","price":782.67,"month":"Jan-25","units":80,"revenue":62613.33,"budget":59482.66},{"region":"NSW","code":"MSL40122","name":"Cert IV Laboratory Skills","price":782.67,"month":"Feb-25","units":80,"revenue":62613.33,"budget":59482.66},{"region":"NSW","code":"MSL40122","name":"Cert IV Laboratory Skills","price":782.67,"month":"Mar-25","units":80,"revenue":62613.33,"budget":59482.66},{"region":"NSW","code":"MSL40122","name":"Cert IV Laboratory Skills","price":782.67,"month":"Apr-25","units":80,"revenue":62613.33,"budget":59482.66},{"region":"NSW","code":"MSL40122","name":"Cert IV Laboratory Skills","price":782.67,"month":"May-25","units":80,"revenue":62613.33,"budget":59482.66},{"region":"NSW","code":"MSL40122","name":"Cert IV Laboratory Skills","price":782.67,"month":"Jun-25","units":80,"revenue":62613.33,"budget":59482.66}];

const _U4 = [{"region":"NSW","code":"MSL40122","name":"Cert IV Laboratory Skills","price":782.67,"month":"Jul-25","units":80,"revenue":62613.33,"budget":59482.66},{"region":"NSW","code":"MSL40122","name":"Cert IV Laboratory Skills","price":782.67,"month":"Aug-25","units":80,"revenue":62613.33,"budget":59482.66},{"region":"NSW","code":"MSL40122","name":"Cert IV Laboratory Skills","price":782.67,"month":"Sep-25","units":80,"revenue":62613.33,"budget":59482.66},{"region":"NSW","code":"MSL40122","name":"Cert IV Laboratory Skills","price":782.67,"month":"Oct-25","units":80,"revenue":62613.33,"budget":59482.66},{"region":"NSW","code":"MSL40122","name":"Cert IV Laboratory Skills","price":782.67,"month":"Nov-25","units":80,"revenue":62613.33,"budget":59482.66},{"region":"NSW","code":"MSL40122","name":"Cert IV Laboratory Skills","price":782.67,"month":"Dec-25","units":50,"revenue":39133.33,"budget":37176.66},{"region":"NSW","code":"MSL40122","name":"Cert IV Laboratory Skills","price":782.67,"month":"Jan-26","units":50,"revenue":39133.33,"budget":37176.66},{"region":"NSW","code":"MSL40122","name":"Cert IV Laboratory Skills","price":782.67,"month":"Feb-26","units":75,"revenue":58700.0,"budget":55765.0},{"region":"NSW","code":"MSL40122","name":"Cert IV Laboratory Skills","price":782.67,"month":"Mar-26","units":94,"revenue":73570.67,"budget":69892.14},{"region":"NSW","code":"MSL40122","name":"Cert IV Laboratory Skills","price":782.67,"month":"Apr-26","units":117,"revenue":91572.0,"budget":86993.4},{"region":"NSW","code":"MSL40122","name":"Cert IV Laboratory Skills","price":782.67,"month":"May-26","units":146,"revenue":114269.33,"budget":108555.86},{"region":"NSW","code":"MSL40122","name":"Cert IV Laboratory Skills","price":782.67,"month":"Jun-26","units":161,"revenue":126009.33,"budget":119708.86},{"region":"NSW","code":"MSL50122","name":"Diploma Laboratory Technology","price":815.56,"month":"Jul-24","units":15,"revenue":12233.33,"budget":11621.66},{"region":"NSW","code":"MSL50122","name":"Diploma Laboratory Technology","price":815.56,"month":"Aug-24","units":15,"revenue":12233.33,"budget":11621.66},{"region":"NSW","code":"MSL50122","name":"Diploma Laboratory Technology","price":815.56,"month":"Sep-24","units":15,"revenue":12233.33,"budget":11621.66},{"region":"NSW","code":"MSL50122","name":"Diploma Laboratory Technology","price":815.56,"month":"Oct-24","units":20,"revenue":16311.11,"budget":15495.55},{"region":"NSW","code":"MSL50122","name":"Diploma Laboratory Technology","price":815.56,"month":"Nov-24","units":20,"revenue":16311.11,"budget":15495.55},{"region":"NSW","code":"MSL50122","name":"Diploma Laboratory Technology","price":815.56,"month":"Dec-24","units":10,"revenue":8155.56,"budget":7747.78},{"region":"NSW","code":"MSL50122","name":"Diploma Laboratory Technology","price":815.56,"month":"Jan-25","units":10,"revenue":8155.56,"budget":7747.78},{"region":"NSW","code":"MSL50122","name":"Diploma Laboratory Technology","price":815.56,"month":"Feb-25","units":10,"revenue":8155.56,"budget":7747.78},{"region":"NSW","code":"MSL50122","name":"Diploma Laboratory Technology","price":815.56,"month":"Mar-25","units":10,"revenue":8155.56,"budget":7747.78},{"region":"NSW","code":"MSL50122","name":"Diploma Laboratory Technology","price":815.56,"month":"Apr-25","units":10,"revenue":8155.56,"budget":7747.78},{"region":"NSW","code":"MSL50122","name":"Diploma Laboratory Technology","price":815.56,"month":"May-25","units":10,"revenue":8155.56,"budget":7747.78},{"region":"NSW","code":"MSL50122","name":"Diploma Laboratory Technology","price":815.56,"month":"Jun-25","units":10,"revenue":8155.56,"budget":7747.78},{"region":"NSW","code":"MSL50122","name":"Diploma Laboratory Technology","price":815.56,"month":"Jul-25","units":10,"revenue":8155.56,"budget":7747.78},{"region":"NSW","code":"MSL50122","name":"Diploma Laboratory Technology","price":815.56,"month":"Aug-25","units":10,"revenue":8155.56,"budget":7747.78},{"region":"NSW","code":"MSL50122","name":"Diploma Laboratory Technology","price":815.56,"month":"Sep-25","units":10,"revenue":8155.56,"budget":7747.78},{"region":"NSW","code":"MSL50122","name":"Diploma Laboratory Technology","price":815.56,"month":"Oct-25","units":10,"revenue":8155.56,"budget":7747.78},{"region":"NSW","code":"MSL50122","name":"Diploma Laboratory Technology","price":815.56,"month":"Nov-25","units":10,"revenue":8155.56,"budget":7747.78},{"region":"NSW","code":"MSL50122","name":"Diploma Laboratory Technology","price":815.56,"month":"Dec-25","units":5,"revenue":4077.78,"budget":3873.89},{"region":"NSW","code":"MSL50122","name":"Diploma Laboratory Technology","price":815.56,"month":"Jan-26","units":5,"revenue":4077.78,"budget":3873.89},{"region":"NSW","code":"MSL50122","name":"Diploma Laboratory Technology","price":815.56,"month":"Feb-26","units":10,"revenue":8155.56,"budget":7747.78},{"region":"NSW","code":"MSL50122","name":"Diploma Laboratory Technology","price":815.56,"month":"Mar-26","units":16,"revenue":13048.89,"budget":12396.45},{"region":"NSW","code":"MSL50122","name":"Diploma Laboratory Technology","price":815.56,"month":"Apr-26","units":22,"revenue":17942.22,"budget":17045.11},{"region":"NSW","code":"MSL50122","name":"Diploma Laboratory Technology","price":815.56,"month":"May-26","units":28,"revenue":22835.56,"budget":21693.78},{"region":"NSW","code":"MSL50122","name":"Diploma Laboratory Technology","price":815.56,"month":"Jun-26","units":28,"revenue":22835.56,"budget":21693.78},{"region":"NSW","code":"HLT37215","name":"Cert III Pathology","price":552.14,"month":"Jul-24","units":70,"revenue":38650.0,"budget":36717.5},{"region":"NSW","code":"HLT37215","name":"Cert III Pathology","price":552.14,"month":"Aug-24","units":70,"revenue":38650.0,"budget":36717.5},{"region":"NSW","code":"HLT37215","name":"Cert III Pathology","price":552.14,"month":"Sep-24","units":70,"revenue":38650.0,"budget":36717.5},{"region":"NSW","code":"HLT37215","name":"Cert III Pathology","price":552.14,"month":"Oct-24","units":70,"revenue":38650.0,"budget":36717.5},{"region":"NSW","code":"HLT37215","name":"Cert III Pathology","price":552.14,"month":"Nov-24","units":70,"revenue":38650.0,"budget":36717.5},{"region":"NSW","code":"HLT37215","name":"Cert III Pathology","price":552.14,"month":"Dec-24","units":70,"revenue":38650.0,"budget":36717.5},{"region":"NSW","code":"HLT37215","name":"Cert III Pathology","price":552.14,"month":"Jan-25","units":50,"revenue":27607.14,"budget":26226.78},{"region":"NSW","code":"HLT37215","name":"Cert III Pathology","price":552.14,"month":"Feb-25","units":90,"revenue":49692.86,"budget":47208.22},{"region":"NSW","code":"HLT37215","name":"Cert III Pathology","price":552.14,"month":"Mar-25","units":90,"revenue":49692.86,"budget":47208.22},{"region":"NSW","code":"HLT37215","name":"Cert III Pathology","price":552.14,"month":"Apr-25","units":90,"revenue":49692.86,"budget":47208.22},{"region":"NSW","code":"HLT37215","name":"Cert III Pathology","price":552.14,"month":"May-25","units":90,"revenue":49692.86,"budget":47208.22},{"region":"NSW","code":"HLT37215","name":"Cert III Pathology","price":552.14,"month":"Jun-25","units":90,"revenue":49692.86,"budget":47208.22},{"region":"NSW","code":"HLT37215","name":"Cert III Pathology","price":552.14,"month":"Jul-25","units":40,"revenue":22085.71,"budget":20981.42},{"region":"NSW","code":"HLT37215","name":"Cert III Pathology","price":552.14,"month":"Aug-25","units":40,"revenue":22085.71,"budget":20981.42},{"region":"NSW","code":"HLT37215","name":"Cert III Pathology","price":552.14,"month":"Sep-25","units":40,"revenue":22085.71,"budget":20981.42},{"region":"NSW","code":"HLT37215","name":"Cert III Pathology","price":552.14,"month":"Oct-25","units":50,"revenue":27607.14,"budget":26226.78},{"region":"NSW","code":"HLT37215","name":"Cert III Pathology","price":552.14,"month":"Nov-25","units":50,"revenue":27607.14,"budget":26226.78},{"region":"NSW","code":"HLT37215","name":"Cert III Pathology","price":552.14,"month":"Dec-25","units":40,"revenue":22085.71,"budget":20981.42},{"region":"NSW","code":"HLT37215","name":"Cert III Pathology","price":552.14,"month":"Jan-26","units":40,"revenue":22085.71,"budget":20981.42},{"region":"NSW","code":"HLT37215","name":"Cert III Pathology","price":552.14,"month":"Feb-26","units":50,"revenue":27607.14,"budget":26226.78},{"region":"NSW","code":"HLT37215","name":"Cert III Pathology","price":552.14,"month":"Mar-26","units":95,"revenue":52453.57,"budget":49830.89},{"region":"NSW","code":"HLT37215","name":"Cert III Pathology","price":552.14,"month":"Apr-26","units":125,"revenue":69017.86,"budget":65566.97},{"region":"NSW","code":"HLT37215","name":"Cert III Pathology","price":552.14,"month":"May-26","units":155,"revenue":85582.14,"budget":81303.03},{"region":"NSW","code":"HLT37215","name":"Cert III Pathology","price":552.14,"month":"Jun-26","units":185,"revenue":102146.43,"budget":97039.11}];

const _U5 = [{"region":"NSW","code":"FFS","name":"Fee for Service","price":350.0,"month":"Jul-24","units":15,"revenue":5250.0,"budget":4987.5},{"region":"NSW","code":"FFS","name":"Fee for Service","price":350.0,"month":"Aug-24","units":17,"revenue":5950.0,"budget":5652.5},{"region":"NSW","code":"FFS","name":"Fee for Service","price":350.0,"month":"Sep-24","units":17,"revenue":5950.0,"budget":5652.5},{"region":"NSW","code":"FFS","name":"Fee for Service","price":350.0,"month":"Oct-24","units":17,"revenue":5950.0,"budget":5652.5},{"region":"NSW","code":"FFS","name":"Fee for Service","price":350.0,"month":"Nov-24","units":17,"revenue":5950.0,"budget":5652.5},{"region":"NSW","code":"FFS","name":"Fee for Service","price":350.0,"month":"Dec-24","units":10,"revenue":3500.0,"budget":3325.0},{"region":"NSW","code":"FFS","name":"Fee for Service","price":350.0,"month":"Jan-25","units":10,"revenue":3500.0,"budget":3325.0},{"region":"NSW","code":"FFS","name":"Fee for Service","price":350.0,"month":"Feb-25","units":15,"revenue":5250.0,"budget":4987.5},{"region":"NSW","code":"FFS","name":"Fee for Service","price":350.0,"month":"Mar-25","units":17,"revenue":5950.0,"budget":5652.5},{"region":"NSW","code":"FFS","name":"Fee for Service","price":350.0,"month":"Apr-25","units":16,"revenue":5600.0,"budget":5320.0},{"region":"NSW","code":"FFS","name":"Fee for Service","price":350.0,"month":"May-25","units":16,"revenue":5600.0,"budget":5320.0},{"region":"NSW","code":"FFS","name":"Fee for Service","price":350.0,"month":"Jun-25","units":16,"revenue":5600.0,"budget":5320.0},{"region":"NSW","code":"FFS","name":"Fee for Service","price":350.0,"month":"Jul-25","units":16,"revenue":5600.0,"budget":5320.0},{"region":"NSW","code":"FFS","name":"Fee for Service","price":350.0,"month":"Aug-25","units":19,"revenue":6650.0,"budget":6317.5},{"region":"NSW","code":"FFS","name":"Fee for Service","price":350.0,"month":"Sep-25","units":19,"revenue":6650.0,"budget":6317.5},{"region":"NSW","code":"FFS","name":"Fee for Service","price":350.0,"month":"Oct-25","units":19,"revenue":6650.0,"budget":6317.5},{"region":"NSW","code":"FFS","name":"Fee for Service","price":350.0,"month":"Nov-25","units":19,"revenue":6650.0,"budget":6317.5},{"region":"NSW","code":"FFS","name":"Fee for Service","price":350.0,"month":"Dec-25","units":11,"revenue":3850.0,"budget":3657.5},{"region":"NSW","code":"FFS","name":"Fee for Service","price":350.0,"month":"Jan-26","units":11,"revenue":3850.0,"budget":3657.5},{"region":"NSW","code":"FFS","name":"Fee for Service","price":350.0,"month":"Feb-26","units":16,"revenue":5600.0,"budget":5320.0},{"region":"NSW","code":"FFS","name":"Fee for Service","price":350.0,"month":"Mar-26","units":19,"revenue":6650.0,"budget":6317.5},{"region":"NSW","code":"FFS","name":"Fee for Service","price":350.0,"month":"Apr-26","units":18,"revenue":6300.0,"budget":5985.0},{"region":"NSW","code":"FFS","name":"Fee for Service","price":350.0,"month":"May-26","units":18,"revenue":6300.0,"budget":5985.0},{"region":"NSW","code":"FFS","name":"Fee for Service","price":350.0,"month":"Jun-26","units":18,"revenue":6300.0,"budget":5985.0},{"region":"NT","code":"MSL30122","name":"Cert III Laboratory Skills","price":358.4,"month":"Jul-24","units":4,"revenue":1433.6,"budget":1361.92},{"region":"NT","code":"MSL30122","name":"Cert III Laboratory Skills","price":358.4,"month":"Aug-24","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"MSL30122","name":"Cert III Laboratory Skills","price":358.4,"month":"Sep-24","units":4,"revenue":1433.6,"budget":1361.92},{"region":"NT","code":"MSL30122","name":"Cert III Laboratory Skills","price":358.4,"month":"Oct-24","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"MSL30122","name":"Cert III Laboratory Skills","price":358.4,"month":"Nov-24","units":4,"revenue":1433.6,"budget":1361.92},{"region":"NT","code":"MSL30122","name":"Cert III Laboratory Skills","price":358.4,"month":"Dec-24","units":2,"revenue":716.8,"budget":680.96},{"region":"NT","code":"MSL30122","name":"Cert III Laboratory Skills","price":358.4,"month":"Jan-25","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"MSL30122","name":"Cert III Laboratory Skills","price":358.4,"month":"Feb-25","units":2,"revenue":716.8,"budget":680.96},{"region":"NT","code":"MSL30122","name":"Cert III Laboratory Skills","price":358.4,"month":"Mar-25","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"MSL30122","name":"Cert III Laboratory Skills","price":358.4,"month":"Apr-25","units":4,"revenue":1433.6,"budget":1361.92},{"region":"NT","code":"MSL30122","name":"Cert III Laboratory Skills","price":358.4,"month":"May-25","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"MSL30122","name":"Cert III Laboratory Skills","price":358.4,"month":"Jun-25","units":4,"revenue":1433.6,"budget":1361.92},{"region":"NT","code":"MSL30122","name":"Cert III Laboratory Skills","price":358.4,"month":"Jul-25","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"MSL30122","name":"Cert III Laboratory Skills","price":358.4,"month":"Aug-25","units":4,"revenue":1433.6,"budget":1361.92},{"region":"NT","code":"MSL30122","name":"Cert III Laboratory Skills","price":358.4,"month":"Sep-25","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"MSL30122","name":"Cert III Laboratory Skills","price":358.4,"month":"Oct-25","units":4,"revenue":1433.6,"budget":1361.92},{"region":"NT","code":"MSL30122","name":"Cert III Laboratory Skills","price":358.4,"month":"Nov-25","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"MSL30122","name":"Cert III Laboratory Skills","price":358.4,"month":"Dec-25","units":2,"revenue":716.8,"budget":680.96},{"region":"NT","code":"MSL30122","name":"Cert III Laboratory Skills","price":358.4,"month":"Jan-26","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"MSL30122","name":"Cert III Laboratory Skills","price":358.4,"month":"Feb-26","units":4,"revenue":1433.6,"budget":1361.92},{"region":"NT","code":"MSL30122","name":"Cert III Laboratory Skills","price":358.4,"month":"Mar-26","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"MSL30122","name":"Cert III Laboratory Skills","price":358.4,"month":"Apr-26","units":8,"revenue":2867.2,"budget":2723.84},{"region":"NT","code":"MSL30122","name":"Cert III Laboratory Skills","price":358.4,"month":"May-26","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"MSL30122","name":"Cert III Laboratory Skills","price":358.4,"month":"Jun-26","units":12,"revenue":4300.8,"budget":4085.76},{"region":"NT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":481.6,"month":"Jul-24","units":18,"revenue":8668.8,"budget":8235.36},{"region":"NT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":481.6,"month":"Aug-24","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":481.6,"month":"Sep-24","units":20,"revenue":9632.0,"budget":9150.4},{"region":"NT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":481.6,"month":"Oct-24","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":481.6,"month":"Nov-24","units":20,"revenue":9632.0,"budget":9150.4},{"region":"NT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":481.6,"month":"Dec-24","units":12,"revenue":5779.2,"budget":5490.24},{"region":"NT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":481.6,"month":"Jan-25","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":481.6,"month":"Feb-25","units":10,"revenue":4816.0,"budget":4575.2},{"region":"NT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":481.6,"month":"Mar-25","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":481.6,"month":"Apr-25","units":18,"revenue":8668.8,"budget":8235.36},{"region":"NT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":481.6,"month":"May-25","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":481.6,"month":"Jun-25","units":22,"revenue":10595.2,"budget":10065.44}];

const _U6 = [{"region":"NT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":481.6,"month":"Jul-25","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":481.6,"month":"Aug-25","units":22,"revenue":10595.2,"budget":10065.44},{"region":"NT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":481.6,"month":"Sep-25","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":481.6,"month":"Oct-25","units":22,"revenue":10595.2,"budget":10065.44},{"region":"NT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":481.6,"month":"Nov-25","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":481.6,"month":"Dec-25","units":12,"revenue":5779.2,"budget":5490.24},{"region":"NT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":481.6,"month":"Jan-26","units":2,"revenue":963.2,"budget":915.04},{"region":"NT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":481.6,"month":"Feb-26","units":12,"revenue":5779.2,"budget":5490.24},{"region":"NT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":481.6,"month":"Mar-26","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":481.6,"month":"Apr-26","units":22,"revenue":10595.2,"budget":10065.44},{"region":"NT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":481.6,"month":"May-26","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":481.6,"month":"Jun-26","units":22,"revenue":10595.2,"budget":10065.44},{"region":"NT","code":"MSL50122","name":"Diploma Laboratory Technology","price":733.6,"month":"Jul-24","units":4,"revenue":2934.4,"budget":2787.68},{"region":"NT","code":"MSL50122","name":"Diploma Laboratory Technology","price":733.6,"month":"Aug-24","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"MSL50122","name":"Diploma Laboratory Technology","price":733.6,"month":"Sep-24","units":8,"revenue":5868.8,"budget":5575.36},{"region":"NT","code":"MSL50122","name":"Diploma Laboratory Technology","price":733.6,"month":"Oct-24","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"MSL50122","name":"Diploma Laboratory Technology","price":733.6,"month":"Nov-24","units":8,"revenue":5868.8,"budget":5575.36},{"region":"NT","code":"MSL50122","name":"Diploma Laboratory Technology","price":733.6,"month":"Dec-24","units":4,"revenue":2934.4,"budget":2787.68},{"region":"NT","code":"MSL50122","name":"Diploma Laboratory Technology","price":733.6,"month":"Jan-25","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"MSL50122","name":"Diploma Laboratory Technology","price":733.6,"month":"Feb-25","units":4,"revenue":2934.4,"budget":2787.68},{"region":"NT","code":"MSL50122","name":"Diploma Laboratory Technology","price":733.6,"month":"Mar-25","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"MSL50122","name":"Diploma Laboratory Technology","price":733.6,"month":"Apr-25","units":4,"revenue":2934.4,"budget":2787.68},{"region":"NT","code":"MSL50122","name":"Diploma Laboratory Technology","price":733.6,"month":"May-25","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"MSL50122","name":"Diploma Laboratory Technology","price":733.6,"month":"Jun-25","units":5,"revenue":3668.0,"budget":3484.6},{"region":"NT","code":"MSL50122","name":"Diploma Laboratory Technology","price":733.6,"month":"Jul-25","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"MSL50122","name":"Diploma Laboratory Technology","price":733.6,"month":"Aug-25","units":5,"revenue":3668.0,"budget":3484.6},{"region":"NT","code":"MSL50122","name":"Diploma Laboratory Technology","price":733.6,"month":"Sep-25","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"MSL50122","name":"Diploma Laboratory Technology","price":733.6,"month":"Oct-25","units":6,"revenue":4401.6,"budget":4181.52},{"region":"NT","code":"MSL50122","name":"Diploma Laboratory Technology","price":733.6,"month":"Nov-25","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"MSL50122","name":"Diploma Laboratory Technology","price":733.6,"month":"Dec-25","units":3,"revenue":2200.8,"budget":2090.76},{"region":"NT","code":"MSL50122","name":"Diploma Laboratory Technology","price":733.6,"month":"Jan-26","units":2,"revenue":1467.2,"budget":1393.84},{"region":"NT","code":"MSL50122","name":"Diploma Laboratory Technology","price":733.6,"month":"Feb-26","units":7,"revenue":5135.2,"budget":4878.44},{"region":"NT","code":"MSL50122","name":"Diploma Laboratory Technology","price":733.6,"month":"Mar-26","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"MSL50122","name":"Diploma Laboratory Technology","price":733.6,"month":"Apr-26","units":7,"revenue":5135.2,"budget":4878.44},{"region":"NT","code":"MSL50122","name":"Diploma Laboratory Technology","price":733.6,"month":"May-26","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"MSL50122","name":"Diploma Laboratory Technology","price":733.6,"month":"Jun-26","units":8,"revenue":5868.8,"budget":5575.36},{"region":"NT","code":"HLT37215","name":"Cert III Pathology","price":432.14,"month":"Jul-24","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"HLT37215","name":"Cert III Pathology","price":432.14,"month":"Aug-24","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"HLT37215","name":"Cert III Pathology","price":432.14,"month":"Sep-24","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"HLT37215","name":"Cert III Pathology","price":432.14,"month":"Oct-24","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"HLT37215","name":"Cert III Pathology","price":432.14,"month":"Nov-24","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"HLT37215","name":"Cert III Pathology","price":432.14,"month":"Dec-24","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"HLT37215","name":"Cert III Pathology","price":432.14,"month":"Jan-25","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"HLT37215","name":"Cert III Pathology","price":432.14,"month":"Feb-25","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"HLT37215","name":"Cert III Pathology","price":432.14,"month":"Mar-25","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"HLT37215","name":"Cert III Pathology","price":432.14,"month":"Apr-25","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"HLT37215","name":"Cert III Pathology","price":432.14,"month":"May-25","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"HLT37215","name":"Cert III Pathology","price":432.14,"month":"Jun-25","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"HLT37215","name":"Cert III Pathology","price":432.14,"month":"Jul-25","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"HLT37215","name":"Cert III Pathology","price":432.14,"month":"Aug-25","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"HLT37215","name":"Cert III Pathology","price":432.14,"month":"Sep-25","units":4,"revenue":1728.57,"budget":1642.14},{"region":"NT","code":"HLT37215","name":"Cert III Pathology","price":432.14,"month":"Oct-25","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"HLT37215","name":"Cert III Pathology","price":432.14,"month":"Nov-25","units":4,"revenue":1728.57,"budget":1642.14},{"region":"NT","code":"HLT37215","name":"Cert III Pathology","price":432.14,"month":"Dec-25","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"HLT37215","name":"Cert III Pathology","price":432.14,"month":"Jan-26","units":4,"revenue":1728.57,"budget":1642.14},{"region":"NT","code":"HLT37215","name":"Cert III Pathology","price":432.14,"month":"Feb-26","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"HLT37215","name":"Cert III Pathology","price":432.14,"month":"Mar-26","units":4,"revenue":1728.57,"budget":1642.14},{"region":"NT","code":"HLT37215","name":"Cert III Pathology","price":432.14,"month":"Apr-26","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"HLT37215","name":"Cert III Pathology","price":432.14,"month":"May-26","units":12,"revenue":5185.71,"budget":4926.42},{"region":"NT","code":"HLT37215","name":"Cert III Pathology","price":432.14,"month":"Jun-26","units":0,"revenue":0.0,"budget":0.0}];

const _U7 = [{"region":"NT","code":"FFS","name":"Fee for Service","price":350.0,"month":"Jul-24","units":2,"revenue":700.0,"budget":665.0},{"region":"NT","code":"FFS","name":"Fee for Service","price":350.0,"month":"Aug-24","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"FFS","name":"Fee for Service","price":350.0,"month":"Sep-24","units":2,"revenue":700.0,"budget":665.0},{"region":"NT","code":"FFS","name":"Fee for Service","price":350.0,"month":"Oct-24","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"FFS","name":"Fee for Service","price":350.0,"month":"Nov-24","units":2,"revenue":700.0,"budget":665.0},{"region":"NT","code":"FFS","name":"Fee for Service","price":350.0,"month":"Dec-24","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"FFS","name":"Fee for Service","price":350.0,"month":"Jan-25","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"FFS","name":"Fee for Service","price":350.0,"month":"Feb-25","units":2,"revenue":700.0,"budget":665.0},{"region":"NT","code":"FFS","name":"Fee for Service","price":350.0,"month":"Mar-25","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"FFS","name":"Fee for Service","price":350.0,"month":"Apr-25","units":2,"revenue":700.0,"budget":665.0},{"region":"NT","code":"FFS","name":"Fee for Service","price":350.0,"month":"May-25","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"FFS","name":"Fee for Service","price":350.0,"month":"Jun-25","units":1,"revenue":350.0,"budget":332.5},{"region":"NT","code":"FFS","name":"Fee for Service","price":350.0,"month":"Jul-25","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"FFS","name":"Fee for Service","price":350.0,"month":"Aug-25","units":1,"revenue":350.0,"budget":332.5},{"region":"NT","code":"FFS","name":"Fee for Service","price":350.0,"month":"Sep-25","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"FFS","name":"Fee for Service","price":350.0,"month":"Oct-25","units":1,"revenue":350.0,"budget":332.5},{"region":"NT","code":"FFS","name":"Fee for Service","price":350.0,"month":"Nov-25","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"FFS","name":"Fee for Service","price":350.0,"month":"Dec-25","units":1,"revenue":350.0,"budget":332.5},{"region":"NT","code":"FFS","name":"Fee for Service","price":350.0,"month":"Jan-26","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"FFS","name":"Fee for Service","price":350.0,"month":"Feb-26","units":1,"revenue":350.0,"budget":332.5},{"region":"NT","code":"FFS","name":"Fee for Service","price":350.0,"month":"Mar-26","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"FFS","name":"Fee for Service","price":350.0,"month":"Apr-26","units":1,"revenue":350.0,"budget":332.5},{"region":"NT","code":"FFS","name":"Fee for Service","price":350.0,"month":"May-26","units":0,"revenue":0.0,"budget":0.0},{"region":"NT","code":"FFS","name":"Fee for Service","price":350.0,"month":"Jun-26","units":1,"revenue":350.0,"budget":332.5},{"region":"TAS","code":"MSL30122","name":"Cert III Laboratory Skills","price":384.69,"month":"Jul-24","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"MSL30122","name":"Cert III Laboratory Skills","price":384.69,"month":"Aug-24","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"MSL30122","name":"Cert III Laboratory Skills","price":384.69,"month":"Sep-24","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"MSL30122","name":"Cert III Laboratory Skills","price":384.69,"month":"Oct-24","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"MSL30122","name":"Cert III Laboratory Skills","price":384.69,"month":"Nov-24","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"MSL30122","name":"Cert III Laboratory Skills","price":384.69,"month":"Dec-24","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"MSL30122","name":"Cert III Laboratory Skills","price":384.69,"month":"Jan-25","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"MSL30122","name":"Cert III Laboratory Skills","price":384.69,"month":"Feb-25","units":4,"revenue":1538.77,"budget":1461.83},{"region":"TAS","code":"MSL30122","name":"Cert III Laboratory Skills","price":384.69,"month":"Mar-25","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"MSL30122","name":"Cert III Laboratory Skills","price":384.69,"month":"Apr-25","units":4,"revenue":1538.77,"budget":1461.83},{"region":"TAS","code":"MSL30122","name":"Cert III Laboratory Skills","price":384.69,"month":"May-25","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"MSL30122","name":"Cert III Laboratory Skills","price":384.69,"month":"Jun-25","units":4,"revenue":1538.77,"budget":1461.83},{"region":"TAS","code":"MSL30122","name":"Cert III Laboratory Skills","price":384.69,"month":"Jul-25","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"MSL30122","name":"Cert III Laboratory Skills","price":384.69,"month":"Aug-25","units":4,"revenue":1538.77,"budget":1461.83},{"region":"TAS","code":"MSL30122","name":"Cert III Laboratory Skills","price":384.69,"month":"Sep-25","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"MSL30122","name":"Cert III Laboratory Skills","price":384.69,"month":"Oct-25","units":4,"revenue":1538.77,"budget":1461.83},{"region":"TAS","code":"MSL30122","name":"Cert III Laboratory Skills","price":384.69,"month":"Nov-25","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"MSL30122","name":"Cert III Laboratory Skills","price":384.69,"month":"Dec-25","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"MSL30122","name":"Cert III Laboratory Skills","price":384.69,"month":"Jan-26","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"MSL30122","name":"Cert III Laboratory Skills","price":384.69,"month":"Feb-26","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"MSL30122","name":"Cert III Laboratory Skills","price":384.69,"month":"Mar-26","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"MSL30122","name":"Cert III Laboratory Skills","price":384.69,"month":"Apr-26","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"MSL30122","name":"Cert III Laboratory Skills","price":384.69,"month":"May-26","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"MSL30122","name":"Cert III Laboratory Skills","price":384.69,"month":"Jun-26","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"MSL40122","name":"Cert IV Laboratory Skills","price":616.07,"month":"Jul-24","units":15,"revenue":9241.0,"budget":8778.95},{"region":"TAS","code":"MSL40122","name":"Cert IV Laboratory Skills","price":616.07,"month":"Aug-24","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"MSL40122","name":"Cert IV Laboratory Skills","price":616.07,"month":"Sep-24","units":15,"revenue":9241.0,"budget":8778.95},{"region":"TAS","code":"MSL40122","name":"Cert IV Laboratory Skills","price":616.07,"month":"Oct-24","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"MSL40122","name":"Cert IV Laboratory Skills","price":616.07,"month":"Nov-24","units":15,"revenue":9241.0,"budget":8778.95},{"region":"TAS","code":"MSL40122","name":"Cert IV Laboratory Skills","price":616.07,"month":"Dec-24","units":5,"revenue":3080.33,"budget":2926.31},{"region":"TAS","code":"MSL40122","name":"Cert IV Laboratory Skills","price":616.07,"month":"Jan-25","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"MSL40122","name":"Cert IV Laboratory Skills","price":616.07,"month":"Feb-25","units":10,"revenue":6160.67,"budget":5852.64},{"region":"TAS","code":"MSL40122","name":"Cert IV Laboratory Skills","price":616.07,"month":"Mar-25","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"MSL40122","name":"Cert IV Laboratory Skills","price":616.07,"month":"Apr-25","units":18,"revenue":11089.2,"budget":10534.74},{"region":"TAS","code":"MSL40122","name":"Cert IV Laboratory Skills","price":616.07,"month":"May-25","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"MSL40122","name":"Cert IV Laboratory Skills","price":616.07,"month":"Jun-25","units":18,"revenue":11089.2,"budget":10534.74}];

const _U8 = [{"region":"TAS","code":"MSL40122","name":"Cert IV Laboratory Skills","price":616.07,"month":"Jul-25","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"MSL40122","name":"Cert IV Laboratory Skills","price":616.07,"month":"Aug-25","units":18,"revenue":11089.2,"budget":10534.74},{"region":"TAS","code":"MSL40122","name":"Cert IV Laboratory Skills","price":616.07,"month":"Sep-25","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"MSL40122","name":"Cert IV Laboratory Skills","price":616.07,"month":"Oct-25","units":18,"revenue":11089.2,"budget":10534.74},{"region":"TAS","code":"MSL40122","name":"Cert IV Laboratory Skills","price":616.07,"month":"Nov-25","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"MSL40122","name":"Cert IV Laboratory Skills","price":616.07,"month":"Dec-25","units":6,"revenue":3696.4,"budget":3511.58},{"region":"TAS","code":"MSL40122","name":"Cert IV Laboratory Skills","price":616.07,"month":"Jan-26","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"MSL40122","name":"Cert IV Laboratory Skills","price":616.07,"month":"Feb-26","units":20,"revenue":12321.33,"budget":11705.26},{"region":"TAS","code":"MSL40122","name":"Cert IV Laboratory Skills","price":616.07,"month":"Mar-26","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"MSL40122","name":"Cert IV Laboratory Skills","price":616.07,"month":"Apr-26","units":25,"revenue":15401.67,"budget":14631.59},{"region":"TAS","code":"MSL40122","name":"Cert IV Laboratory Skills","price":616.07,"month":"May-26","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"MSL40122","name":"Cert IV Laboratory Skills","price":616.07,"month":"Jun-26","units":31,"revenue":19098.07,"budget":18143.17},{"region":"TAS","code":"MSL50122","name":"Diploma Laboratory Technology","price":450.0,"month":"Jul-24","units":3,"revenue":1350.0,"budget":1282.5},{"region":"TAS","code":"MSL50122","name":"Diploma Laboratory Technology","price":450.0,"month":"Aug-24","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"MSL50122","name":"Diploma Laboratory Technology","price":450.0,"month":"Sep-24","units":3,"revenue":1350.0,"budget":1282.5},{"region":"TAS","code":"MSL50122","name":"Diploma Laboratory Technology","price":450.0,"month":"Oct-24","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"MSL50122","name":"Diploma Laboratory Technology","price":450.0,"month":"Nov-24","units":3,"revenue":1350.0,"budget":1282.5},{"region":"TAS","code":"MSL50122","name":"Diploma Laboratory Technology","price":450.0,"month":"Dec-24","units":2,"revenue":900.0,"budget":855.0},{"region":"TAS","code":"MSL50122","name":"Diploma Laboratory Technology","price":450.0,"month":"Jan-25","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"MSL50122","name":"Diploma Laboratory Technology","price":450.0,"month":"Feb-25","units":2,"revenue":900.0,"budget":855.0},{"region":"TAS","code":"MSL50122","name":"Diploma Laboratory Technology","price":450.0,"month":"Mar-25","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"MSL50122","name":"Diploma Laboratory Technology","price":450.0,"month":"Apr-25","units":4,"revenue":1800.0,"budget":1710.0},{"region":"TAS","code":"MSL50122","name":"Diploma Laboratory Technology","price":450.0,"month":"May-25","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"MSL50122","name":"Diploma Laboratory Technology","price":450.0,"month":"Jun-25","units":6,"revenue":2700.0,"budget":2565.0},{"region":"TAS","code":"MSL50122","name":"Diploma Laboratory Technology","price":450.0,"month":"Jul-25","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"MSL50122","name":"Diploma Laboratory Technology","price":450.0,"month":"Aug-25","units":6,"revenue":2700.0,"budget":2565.0},{"region":"TAS","code":"MSL50122","name":"Diploma Laboratory Technology","price":450.0,"month":"Sep-25","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"MSL50122","name":"Diploma Laboratory Technology","price":450.0,"month":"Oct-25","units":12,"revenue":5400.0,"budget":5130.0},{"region":"TAS","code":"MSL50122","name":"Diploma Laboratory Technology","price":450.0,"month":"Nov-25","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"MSL50122","name":"Diploma Laboratory Technology","price":450.0,"month":"Dec-25","units":4,"revenue":1800.0,"budget":1710.0},{"region":"TAS","code":"MSL50122","name":"Diploma Laboratory Technology","price":450.0,"month":"Jan-26","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"MSL50122","name":"Diploma Laboratory Technology","price":450.0,"month":"Feb-26","units":2,"revenue":900.0,"budget":855.0},{"region":"TAS","code":"MSL50122","name":"Diploma Laboratory Technology","price":450.0,"month":"Mar-26","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"MSL50122","name":"Diploma Laboratory Technology","price":450.0,"month":"Apr-26","units":12,"revenue":5400.0,"budget":5130.0},{"region":"TAS","code":"MSL50122","name":"Diploma Laboratory Technology","price":450.0,"month":"May-26","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"MSL50122","name":"Diploma Laboratory Technology","price":450.0,"month":"Jun-26","units":12,"revenue":5400.0,"budget":5130.0},{"region":"TAS","code":"HLT37215","name":"Cert III Pathology","price":322.64,"month":"Jul-24","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"HLT37215","name":"Cert III Pathology","price":322.64,"month":"Aug-24","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"HLT37215","name":"Cert III Pathology","price":322.64,"month":"Sep-24","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"HLT37215","name":"Cert III Pathology","price":322.64,"month":"Oct-24","units":6,"revenue":1935.86,"budget":1839.07},{"region":"TAS","code":"HLT37215","name":"Cert III Pathology","price":322.64,"month":"Nov-24","units":12,"revenue":3871.71,"budget":3678.12},{"region":"TAS","code":"HLT37215","name":"Cert III Pathology","price":322.64,"month":"Dec-24","units":4,"revenue":1290.57,"budget":1226.04},{"region":"TAS","code":"HLT37215","name":"Cert III Pathology","price":322.64,"month":"Jan-25","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"HLT37215","name":"Cert III Pathology","price":322.64,"month":"Feb-25","units":12,"revenue":3871.71,"budget":3678.12},{"region":"TAS","code":"HLT37215","name":"Cert III Pathology","price":322.64,"month":"Mar-25","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"HLT37215","name":"Cert III Pathology","price":322.64,"month":"Apr-25","units":12,"revenue":3871.71,"budget":3678.12},{"region":"TAS","code":"HLT37215","name":"Cert III Pathology","price":322.64,"month":"May-25","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"HLT37215","name":"Cert III Pathology","price":322.64,"month":"Jun-25","units":12,"revenue":3871.71,"budget":3678.12},{"region":"TAS","code":"HLT37215","name":"Cert III Pathology","price":322.64,"month":"Jul-25","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"HLT37215","name":"Cert III Pathology","price":322.64,"month":"Aug-25","units":12,"revenue":3871.71,"budget":3678.12},{"region":"TAS","code":"HLT37215","name":"Cert III Pathology","price":322.64,"month":"Sep-25","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"HLT37215","name":"Cert III Pathology","price":322.64,"month":"Oct-25","units":12,"revenue":3871.71,"budget":3678.12},{"region":"TAS","code":"HLT37215","name":"Cert III Pathology","price":322.64,"month":"Nov-25","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"HLT37215","name":"Cert III Pathology","price":322.64,"month":"Dec-25","units":8,"revenue":2581.14,"budget":2452.08},{"region":"TAS","code":"HLT37215","name":"Cert III Pathology","price":322.64,"month":"Jan-26","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"HLT37215","name":"Cert III Pathology","price":322.64,"month":"Feb-26","units":12,"revenue":3871.71,"budget":3678.12},{"region":"TAS","code":"HLT37215","name":"Cert III Pathology","price":322.64,"month":"Mar-26","units":16,"revenue":5162.29,"budget":4904.18},{"region":"TAS","code":"HLT37215","name":"Cert III Pathology","price":322.64,"month":"Apr-26","units":20,"revenue":6452.86,"budget":6130.22},{"region":"TAS","code":"HLT37215","name":"Cert III Pathology","price":322.64,"month":"May-26","units":28,"revenue":9034.0,"budget":8582.3},{"region":"TAS","code":"HLT37215","name":"Cert III Pathology","price":322.64,"month":"Jun-26","units":36,"revenue":11615.14,"budget":11034.38}];

const _U9 = [{"region":"TAS","code":"FFS","name":"Fee for Service","price":350.0,"month":"Jul-24","units":4,"revenue":1400.0,"budget":1330.0},{"region":"TAS","code":"FFS","name":"Fee for Service","price":350.0,"month":"Aug-24","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"FFS","name":"Fee for Service","price":350.0,"month":"Sep-24","units":4,"revenue":1400.0,"budget":1330.0},{"region":"TAS","code":"FFS","name":"Fee for Service","price":350.0,"month":"Oct-24","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"FFS","name":"Fee for Service","price":350.0,"month":"Nov-24","units":4,"revenue":1400.0,"budget":1330.0},{"region":"TAS","code":"FFS","name":"Fee for Service","price":350.0,"month":"Dec-24","units":2,"revenue":700.0,"budget":665.0},{"region":"TAS","code":"FFS","name":"Fee for Service","price":350.0,"month":"Jan-25","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"FFS","name":"Fee for Service","price":350.0,"month":"Feb-25","units":4,"revenue":1400.0,"budget":1330.0},{"region":"TAS","code":"FFS","name":"Fee for Service","price":350.0,"month":"Mar-25","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"FFS","name":"Fee for Service","price":350.0,"month":"Apr-25","units":8,"revenue":2800.0,"budget":2660.0},{"region":"TAS","code":"FFS","name":"Fee for Service","price":350.0,"month":"May-25","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"FFS","name":"Fee for Service","price":350.0,"month":"Jun-25","units":8,"revenue":2800.0,"budget":2660.0},{"region":"TAS","code":"FFS","name":"Fee for Service","price":350.0,"month":"Jul-25","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"FFS","name":"Fee for Service","price":350.0,"month":"Aug-25","units":8,"revenue":2800.0,"budget":2660.0},{"region":"TAS","code":"FFS","name":"Fee for Service","price":350.0,"month":"Sep-25","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"FFS","name":"Fee for Service","price":350.0,"month":"Oct-25","units":8,"revenue":2800.0,"budget":2660.0},{"region":"TAS","code":"FFS","name":"Fee for Service","price":350.0,"month":"Nov-25","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"FFS","name":"Fee for Service","price":350.0,"month":"Dec-25","units":4,"revenue":1400.0,"budget":1330.0},{"region":"TAS","code":"FFS","name":"Fee for Service","price":350.0,"month":"Jan-26","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"FFS","name":"Fee for Service","price":350.0,"month":"Feb-26","units":4,"revenue":1400.0,"budget":1330.0},{"region":"TAS","code":"FFS","name":"Fee for Service","price":350.0,"month":"Mar-26","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"FFS","name":"Fee for Service","price":350.0,"month":"Apr-26","units":2,"revenue":700.0,"budget":665.0},{"region":"TAS","code":"FFS","name":"Fee for Service","price":350.0,"month":"May-26","units":0,"revenue":0.0,"budget":0.0},{"region":"TAS","code":"FFS","name":"Fee for Service","price":350.0,"month":"Jun-26","units":2,"revenue":700.0,"budget":665.0},{"region":"ACT","code":"MSL30122","name":"Cert III Laboratory Skills","price":319.23,"month":"Jul-24","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"MSL30122","name":"Cert III Laboratory Skills","price":319.23,"month":"Aug-24","units":4,"revenue":1276.92,"budget":1213.07},{"region":"ACT","code":"MSL30122","name":"Cert III Laboratory Skills","price":319.23,"month":"Sep-24","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"MSL30122","name":"Cert III Laboratory Skills","price":319.23,"month":"Oct-24","units":4,"revenue":1276.92,"budget":1213.07},{"region":"ACT","code":"MSL30122","name":"Cert III Laboratory Skills","price":319.23,"month":"Nov-24","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"MSL30122","name":"Cert III Laboratory Skills","price":319.23,"month":"Dec-24","units":4,"revenue":1276.92,"budget":1213.07},{"region":"ACT","code":"MSL30122","name":"Cert III Laboratory Skills","price":319.23,"month":"Jan-25","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"MSL30122","name":"Cert III Laboratory Skills","price":319.23,"month":"Feb-25","units":2,"revenue":638.46,"budget":606.54},{"region":"ACT","code":"MSL30122","name":"Cert III Laboratory Skills","price":319.23,"month":"Mar-25","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"MSL30122","name":"Cert III Laboratory Skills","price":319.23,"month":"Apr-25","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"MSL30122","name":"Cert III Laboratory Skills","price":319.23,"month":"May-25","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"MSL30122","name":"Cert III Laboratory Skills","price":319.23,"month":"Jun-25","units":4,"revenue":1276.92,"budget":1213.07},{"region":"ACT","code":"MSL30122","name":"Cert III Laboratory Skills","price":319.23,"month":"Jul-25","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"MSL30122","name":"Cert III Laboratory Skills","price":319.23,"month":"Aug-25","units":4,"revenue":1276.92,"budget":1213.07},{"region":"ACT","code":"MSL30122","name":"Cert III Laboratory Skills","price":319.23,"month":"Sep-25","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"MSL30122","name":"Cert III Laboratory Skills","price":319.23,"month":"Oct-25","units":4,"revenue":1276.92,"budget":1213.07},{"region":"ACT","code":"MSL30122","name":"Cert III Laboratory Skills","price":319.23,"month":"Nov-25","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"MSL30122","name":"Cert III Laboratory Skills","price":319.23,"month":"Dec-25","units":4,"revenue":1276.92,"budget":1213.07},{"region":"ACT","code":"MSL30122","name":"Cert III Laboratory Skills","price":319.23,"month":"Jan-26","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"MSL30122","name":"Cert III Laboratory Skills","price":319.23,"month":"Feb-26","units":2,"revenue":638.46,"budget":606.54},{"region":"ACT","code":"MSL30122","name":"Cert III Laboratory Skills","price":319.23,"month":"Mar-26","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"MSL30122","name":"Cert III Laboratory Skills","price":319.23,"month":"Apr-26","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"MSL30122","name":"Cert III Laboratory Skills","price":319.23,"month":"May-26","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"MSL30122","name":"Cert III Laboratory Skills","price":319.23,"month":"Jun-26","units":4,"revenue":1276.92,"budget":1213.07},{"region":"ACT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":657.33,"month":"Jul-24","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":657.33,"month":"Aug-24","units":6,"revenue":3944.0,"budget":3746.8},{"region":"ACT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":657.33,"month":"Sep-24","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":657.33,"month":"Oct-24","units":6,"revenue":3944.0,"budget":3746.8},{"region":"ACT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":657.33,"month":"Nov-24","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":657.33,"month":"Dec-24","units":6,"revenue":3944.0,"budget":3746.8},{"region":"ACT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":657.33,"month":"Jan-25","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":657.33,"month":"Feb-25","units":4,"revenue":2629.33,"budget":2497.86},{"region":"ACT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":657.33,"month":"Mar-25","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":657.33,"month":"Apr-25","units":7,"revenue":4601.33,"budget":4371.26},{"region":"ACT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":657.33,"month":"May-25","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":657.33,"month":"Jun-25","units":7,"revenue":4601.33,"budget":4371.26}];

const _U10 = [{"region":"ACT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":657.33,"month":"Jul-25","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":657.33,"month":"Aug-25","units":7,"revenue":4601.33,"budget":4371.26},{"region":"ACT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":657.33,"month":"Sep-25","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":657.33,"month":"Oct-25","units":7,"revenue":4601.33,"budget":4371.26},{"region":"ACT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":657.33,"month":"Nov-25","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":657.33,"month":"Dec-25","units":7,"revenue":4601.33,"budget":4371.26},{"region":"ACT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":657.33,"month":"Jan-26","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":657.33,"month":"Feb-26","units":7,"revenue":4601.33,"budget":4371.26},{"region":"ACT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":657.33,"month":"Mar-26","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":657.33,"month":"Apr-26","units":7,"revenue":4601.33,"budget":4371.26},{"region":"ACT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":657.33,"month":"May-26","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"MSL40122","name":"Cert IV Laboratory Skills","price":657.33,"month":"Jun-26","units":7,"revenue":4601.33,"budget":4371.26},{"region":"ACT","code":"MSL50122","name":"Diploma Laboratory Technology","price":492.78,"month":"Jul-24","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"MSL50122","name":"Diploma Laboratory Technology","price":492.78,"month":"Aug-24","units":6,"revenue":2956.67,"budget":2808.84},{"region":"ACT","code":"MSL50122","name":"Diploma Laboratory Technology","price":492.78,"month":"Sep-24","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"MSL50122","name":"Diploma Laboratory Technology","price":492.78,"month":"Oct-24","units":6,"revenue":2956.67,"budget":2808.84},{"region":"ACT","code":"MSL50122","name":"Diploma Laboratory Technology","price":492.78,"month":"Nov-24","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"MSL50122","name":"Diploma Laboratory Technology","price":492.78,"month":"Dec-24","units":6,"revenue":2956.67,"budget":2808.84},{"region":"ACT","code":"MSL50122","name":"Diploma Laboratory Technology","price":492.78,"month":"Jan-25","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"MSL50122","name":"Diploma Laboratory Technology","price":492.78,"month":"Feb-25","units":3,"revenue":1478.33,"budget":1404.41},{"region":"ACT","code":"MSL50122","name":"Diploma Laboratory Technology","price":492.78,"month":"Mar-25","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"MSL50122","name":"Diploma Laboratory Technology","price":492.78,"month":"Apr-25","units":2,"revenue":985.56,"budget":936.28},{"region":"ACT","code":"MSL50122","name":"Diploma Laboratory Technology","price":492.78,"month":"May-25","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"MSL50122","name":"Diploma Laboratory Technology","price":492.78,"month":"Jun-25","units":7,"revenue":3449.44,"budget":3276.97},{"region":"ACT","code":"MSL50122","name":"Diploma Laboratory Technology","price":492.78,"month":"Jul-25","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"MSL50122","name":"Diploma Laboratory Technology","price":492.78,"month":"Aug-25","units":7,"revenue":3449.44,"budget":3276.97},{"region":"ACT","code":"MSL50122","name":"Diploma Laboratory Technology","price":492.78,"month":"Sep-25","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"MSL50122","name":"Diploma Laboratory Technology","price":492.78,"month":"Oct-25","units":7,"revenue":3449.44,"budget":3276.97},{"region":"ACT","code":"MSL50122","name":"Diploma Laboratory Technology","price":492.78,"month":"Nov-25","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"MSL50122","name":"Diploma Laboratory Technology","price":492.78,"month":"Dec-25","units":7,"revenue":3449.44,"budget":3276.97},{"region":"ACT","code":"MSL50122","name":"Diploma Laboratory Technology","price":492.78,"month":"Jan-26","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"MSL50122","name":"Diploma Laboratory Technology","price":492.78,"month":"Feb-26","units":3,"revenue":1478.33,"budget":1404.41},{"region":"ACT","code":"MSL50122","name":"Diploma Laboratory Technology","price":492.78,"month":"Mar-26","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"MSL50122","name":"Diploma Laboratory Technology","price":492.78,"month":"Apr-26","units":2,"revenue":985.56,"budget":936.28},{"region":"ACT","code":"MSL50122","name":"Diploma Laboratory Technology","price":492.78,"month":"May-26","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"MSL50122","name":"Diploma Laboratory Technology","price":492.78,"month":"Jun-26","units":6,"revenue":2956.67,"budget":2808.84},{"region":"ACT","code":"HLT37215","name":"Cert III Pathology","price":350.71,"month":"Jul-24","units":8,"revenue":2805.71,"budget":2665.42},{"region":"ACT","code":"HLT37215","name":"Cert III Pathology","price":350.71,"month":"Aug-24","units":16,"revenue":5611.43,"budget":5330.86},{"region":"ACT","code":"HLT37215","name":"Cert III Pathology","price":350.71,"month":"Sep-24","units":16,"revenue":5611.43,"budget":5330.86},{"region":"ACT","code":"HLT37215","name":"Cert III Pathology","price":350.71,"month":"Oct-24","units":16,"revenue":5611.43,"budget":5330.86},{"region":"ACT","code":"HLT37215","name":"Cert III Pathology","price":350.71,"month":"Nov-24","units":16,"revenue":5611.43,"budget":5330.86},{"region":"ACT","code":"HLT37215","name":"Cert III Pathology","price":350.71,"month":"Dec-24","units":8,"revenue":2805.71,"budget":2665.42},{"region":"ACT","code":"HLT37215","name":"Cert III Pathology","price":350.71,"month":"Jan-25","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"HLT37215","name":"Cert III Pathology","price":350.71,"month":"Feb-25","units":8,"revenue":2805.71,"budget":2665.42},{"region":"ACT","code":"HLT37215","name":"Cert III Pathology","price":350.71,"month":"Mar-25","units":16,"revenue":5611.43,"budget":5330.86},{"region":"ACT","code":"HLT37215","name":"Cert III Pathology","price":350.71,"month":"Apr-25","units":4,"revenue":1402.86,"budget":1332.72},{"region":"ACT","code":"HLT37215","name":"Cert III Pathology","price":350.71,"month":"May-25","units":4,"revenue":1402.86,"budget":1332.72},{"region":"ACT","code":"HLT37215","name":"Cert III Pathology","price":350.71,"month":"Jun-25","units":9,"revenue":3156.43,"budget":2998.61},{"region":"ACT","code":"HLT37215","name":"Cert III Pathology","price":350.71,"month":"Jul-25","units":9,"revenue":3156.43,"budget":2998.61},{"region":"ACT","code":"HLT37215","name":"Cert III Pathology","price":350.71,"month":"Aug-25","units":10,"revenue":3507.14,"budget":3331.78},{"region":"ACT","code":"HLT37215","name":"Cert III Pathology","price":350.71,"month":"Sep-25","units":10,"revenue":3507.14,"budget":3331.78},{"region":"ACT","code":"HLT37215","name":"Cert III Pathology","price":350.71,"month":"Oct-25","units":18,"revenue":6312.86,"budget":5997.22},{"region":"ACT","code":"HLT37215","name":"Cert III Pathology","price":350.71,"month":"Nov-25","units":30,"revenue":10521.43,"budget":9995.36},{"region":"ACT","code":"HLT37215","name":"Cert III Pathology","price":350.71,"month":"Dec-25","units":30,"revenue":10521.43,"budget":9995.36},{"region":"ACT","code":"HLT37215","name":"Cert III Pathology","price":350.71,"month":"Jan-26","units":15,"revenue":5260.71,"budget":4997.67},{"region":"ACT","code":"HLT37215","name":"Cert III Pathology","price":350.71,"month":"Feb-26","units":35,"revenue":12275.0,"budget":11661.25},{"region":"ACT","code":"HLT37215","name":"Cert III Pathology","price":350.71,"month":"Mar-26","units":48,"revenue":16834.29,"budget":15992.58},{"region":"ACT","code":"HLT37215","name":"Cert III Pathology","price":350.71,"month":"Apr-26","units":70,"revenue":24550.0,"budget":23322.5},{"region":"ACT","code":"HLT37215","name":"Cert III Pathology","price":350.71,"month":"May-26","units":90,"revenue":31564.29,"budget":29986.08},{"region":"ACT","code":"HLT37215","name":"Cert III Pathology","price":350.71,"month":"Jun-26","units":120,"revenue":42085.71,"budget":39981.42}];

const _U11 = [{"region":"ACT","code":"FFS","name":"Fee for Service","price":350.0,"month":"Jul-24","units":2,"revenue":700.0,"budget":665.0},{"region":"ACT","code":"FFS","name":"Fee for Service","price":350.0,"month":"Aug-24","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"FFS","name":"Fee for Service","price":350.0,"month":"Sep-24","units":2,"revenue":700.0,"budget":665.0},{"region":"ACT","code":"FFS","name":"Fee for Service","price":350.0,"month":"Oct-24","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"FFS","name":"Fee for Service","price":350.0,"month":"Nov-24","units":2,"revenue":700.0,"budget":665.0},{"region":"ACT","code":"FFS","name":"Fee for Service","price":350.0,"month":"Dec-24","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"FFS","name":"Fee for Service","price":350.0,"month":"Jan-25","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"FFS","name":"Fee for Service","price":350.0,"month":"Feb-25","units":2,"revenue":700.0,"budget":665.0},{"region":"ACT","code":"FFS","name":"Fee for Service","price":350.0,"month":"Mar-25","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"FFS","name":"Fee for Service","price":350.0,"month":"Apr-25","units":2,"revenue":700.0,"budget":665.0},{"region":"ACT","code":"FFS","name":"Fee for Service","price":350.0,"month":"May-25","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"FFS","name":"Fee for Service","price":350.0,"month":"Jun-25","units":2,"revenue":700.0,"budget":665.0},{"region":"ACT","code":"FFS","name":"Fee for Service","price":350.0,"month":"Jul-25","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"FFS","name":"Fee for Service","price":350.0,"month":"Aug-25","units":2,"revenue":700.0,"budget":665.0},{"region":"ACT","code":"FFS","name":"Fee for Service","price":350.0,"month":"Sep-25","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"FFS","name":"Fee for Service","price":350.0,"month":"Oct-25","units":2,"revenue":700.0,"budget":665.0},{"region":"ACT","code":"FFS","name":"Fee for Service","price":350.0,"month":"Nov-25","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"FFS","name":"Fee for Service","price":350.0,"month":"Dec-25","units":2,"revenue":700.0,"budget":665.0},{"region":"ACT","code":"FFS","name":"Fee for Service","price":350.0,"month":"Jan-26","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"FFS","name":"Fee for Service","price":350.0,"month":"Feb-26","units":2,"revenue":700.0,"budget":665.0},{"region":"ACT","code":"FFS","name":"Fee for Service","price":350.0,"month":"Mar-26","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"FFS","name":"Fee for Service","price":350.0,"month":"Apr-26","units":2,"revenue":700.0,"budget":665.0},{"region":"ACT","code":"FFS","name":"Fee for Service","price":350.0,"month":"May-26","units":0,"revenue":0.0,"budget":0.0},{"region":"ACT","code":"FFS","name":"Fee for Service","price":350.0,"month":"Jun-26","units":2,"revenue":700.0,"budget":665.0},{"region":"VIC","code":"MSL20122","name":"Cert II Laboratory Skills","price":300.0,"month":"Jul-24","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL20122","name":"Cert II Laboratory Skills","price":300.0,"month":"Aug-24","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL20122","name":"Cert II Laboratory Skills","price":300.0,"month":"Sep-24","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL20122","name":"Cert II Laboratory Skills","price":300.0,"month":"Oct-24","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL20122","name":"Cert II Laboratory Skills","price":300.0,"month":"Nov-24","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL20122","name":"Cert II Laboratory Skills","price":300.0,"month":"Dec-24","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL20122","name":"Cert II Laboratory Skills","price":300.0,"month":"Jan-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL20122","name":"Cert II Laboratory Skills","price":300.0,"month":"Feb-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL20122","name":"Cert II Laboratory Skills","price":300.0,"month":"Mar-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL20122","name":"Cert II Laboratory Skills","price":300.0,"month":"Apr-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL20122","name":"Cert II Laboratory Skills","price":300.0,"month":"May-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL20122","name":"Cert II Laboratory Skills","price":300.0,"month":"Jun-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL20122","name":"Cert II Laboratory Skills","price":300.0,"month":"Jul-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL20122","name":"Cert II Laboratory Skills","price":300.0,"month":"Aug-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL20122","name":"Cert II Laboratory Skills","price":300.0,"month":"Sep-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL20122","name":"Cert II Laboratory Skills","price":300.0,"month":"Oct-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL20122","name":"Cert II Laboratory Skills","price":300.0,"month":"Nov-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL20122","name":"Cert II Laboratory Skills","price":300.0,"month":"Dec-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL20122","name":"Cert II Laboratory Skills","price":300.0,"month":"Jan-26","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL20122","name":"Cert II Laboratory Skills","price":300.0,"month":"Feb-26","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL20122","name":"Cert II Laboratory Skills","price":300.0,"month":"Mar-26","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL20122","name":"Cert II Laboratory Skills","price":300.0,"month":"Apr-26","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL20122","name":"Cert II Laboratory Skills","price":300.0,"month":"May-26","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL20122","name":"Cert II Laboratory Skills","price":300.0,"month":"Jun-26","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL30122","name":"Cert III Laboratory Skills","price":581.54,"month":"Jul-24","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL30122","name":"Cert III Laboratory Skills","price":581.54,"month":"Aug-24","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL30122","name":"Cert III Laboratory Skills","price":581.54,"month":"Sep-24","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL30122","name":"Cert III Laboratory Skills","price":581.54,"month":"Oct-24","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL30122","name":"Cert III Laboratory Skills","price":581.54,"month":"Nov-24","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL30122","name":"Cert III Laboratory Skills","price":581.54,"month":"Dec-24","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL30122","name":"Cert III Laboratory Skills","price":581.54,"month":"Jan-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL30122","name":"Cert III Laboratory Skills","price":581.54,"month":"Feb-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL30122","name":"Cert III Laboratory Skills","price":581.54,"month":"Mar-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL30122","name":"Cert III Laboratory Skills","price":581.54,"month":"Apr-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL30122","name":"Cert III Laboratory Skills","price":581.54,"month":"May-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL30122","name":"Cert III Laboratory Skills","price":581.54,"month":"Jun-25","units":0,"revenue":0.0,"budget":0.0}];

const _U12 = [{"region":"VIC","code":"MSL30122","name":"Cert III Laboratory Skills","price":581.54,"month":"Jul-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL30122","name":"Cert III Laboratory Skills","price":581.54,"month":"Aug-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL30122","name":"Cert III Laboratory Skills","price":581.54,"month":"Sep-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL30122","name":"Cert III Laboratory Skills","price":581.54,"month":"Oct-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL30122","name":"Cert III Laboratory Skills","price":581.54,"month":"Nov-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL30122","name":"Cert III Laboratory Skills","price":581.54,"month":"Dec-25","units":5,"revenue":2907.69,"budget":2762.31},{"region":"VIC","code":"MSL30122","name":"Cert III Laboratory Skills","price":581.54,"month":"Jan-26","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL30122","name":"Cert III Laboratory Skills","price":581.54,"month":"Feb-26","units":5,"revenue":2907.69,"budget":2762.31},{"region":"VIC","code":"MSL30122","name":"Cert III Laboratory Skills","price":581.54,"month":"Mar-26","units":5,"revenue":2907.69,"budget":2762.31},{"region":"VIC","code":"MSL30122","name":"Cert III Laboratory Skills","price":581.54,"month":"Apr-26","units":10,"revenue":5815.38,"budget":5524.61},{"region":"VIC","code":"MSL30122","name":"Cert III Laboratory Skills","price":581.54,"month":"May-26","units":15,"revenue":8723.08,"budget":8286.93},{"region":"VIC","code":"MSL30122","name":"Cert III Laboratory Skills","price":581.54,"month":"Jun-26","units":25,"revenue":14538.46,"budget":13811.54},{"region":"VIC","code":"MSL40122","name":"Cert IV Laboratory Skills","price":931.0,"month":"Jul-24","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL40122","name":"Cert IV Laboratory Skills","price":931.0,"month":"Aug-24","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL40122","name":"Cert IV Laboratory Skills","price":931.0,"month":"Sep-24","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL40122","name":"Cert IV Laboratory Skills","price":931.0,"month":"Oct-24","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL40122","name":"Cert IV Laboratory Skills","price":931.0,"month":"Nov-24","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL40122","name":"Cert IV Laboratory Skills","price":931.0,"month":"Dec-24","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL40122","name":"Cert IV Laboratory Skills","price":931.0,"month":"Jan-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL40122","name":"Cert IV Laboratory Skills","price":931.0,"month":"Feb-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL40122","name":"Cert IV Laboratory Skills","price":931.0,"month":"Mar-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL40122","name":"Cert IV Laboratory Skills","price":931.0,"month":"Apr-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL40122","name":"Cert IV Laboratory Skills","price":931.0,"month":"May-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL40122","name":"Cert IV Laboratory Skills","price":931.0,"month":"Jun-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL40122","name":"Cert IV Laboratory Skills","price":931.0,"month":"Jul-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL40122","name":"Cert IV Laboratory Skills","price":931.0,"month":"Aug-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL40122","name":"Cert IV Laboratory Skills","price":931.0,"month":"Sep-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL40122","name":"Cert IV Laboratory Skills","price":931.0,"month":"Oct-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL40122","name":"Cert IV Laboratory Skills","price":931.0,"month":"Nov-25","units":8,"revenue":7448.0,"budget":7075.6},{"region":"VIC","code":"MSL40122","name":"Cert IV Laboratory Skills","price":931.0,"month":"Dec-25","units":4,"revenue":3724.0,"budget":3537.8},{"region":"VIC","code":"MSL40122","name":"Cert IV Laboratory Skills","price":931.0,"month":"Jan-26","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL40122","name":"Cert IV Laboratory Skills","price":931.0,"month":"Feb-26","units":8,"revenue":7448.0,"budget":7075.6},{"region":"VIC","code":"MSL40122","name":"Cert IV Laboratory Skills","price":931.0,"month":"Mar-26","units":8,"revenue":7448.0,"budget":7075.6},{"region":"VIC","code":"MSL40122","name":"Cert IV Laboratory Skills","price":931.0,"month":"Apr-26","units":32,"revenue":29792.0,"budget":28302.4},{"region":"VIC","code":"MSL40122","name":"Cert IV Laboratory Skills","price":931.0,"month":"May-26","units":48,"revenue":44688.0,"budget":42453.6},{"region":"VIC","code":"MSL40122","name":"Cert IV Laboratory Skills","price":931.0,"month":"Jun-26","units":60,"revenue":55860.0,"budget":53067.0},{"region":"VIC","code":"MSL50122","name":"Diploma Laboratory Technology","price":556.11,"month":"Jul-24","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL50122","name":"Diploma Laboratory Technology","price":556.11,"month":"Aug-24","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL50122","name":"Diploma Laboratory Technology","price":556.11,"month":"Sep-24","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL50122","name":"Diploma Laboratory Technology","price":556.11,"month":"Oct-24","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL50122","name":"Diploma Laboratory Technology","price":556.11,"month":"Nov-24","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL50122","name":"Diploma Laboratory Technology","price":556.11,"month":"Dec-24","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL50122","name":"Diploma Laboratory Technology","price":556.11,"month":"Jan-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL50122","name":"Diploma Laboratory Technology","price":556.11,"month":"Feb-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL50122","name":"Diploma Laboratory Technology","price":556.11,"month":"Mar-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL50122","name":"Diploma Laboratory Technology","price":556.11,"month":"Apr-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL50122","name":"Diploma Laboratory Technology","price":556.11,"month":"May-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL50122","name":"Diploma Laboratory Technology","price":556.11,"month":"Jun-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL50122","name":"Diploma Laboratory Technology","price":556.11,"month":"Jul-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL50122","name":"Diploma Laboratory Technology","price":556.11,"month":"Aug-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL50122","name":"Diploma Laboratory Technology","price":556.11,"month":"Sep-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL50122","name":"Diploma Laboratory Technology","price":556.11,"month":"Oct-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL50122","name":"Diploma Laboratory Technology","price":556.11,"month":"Nov-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL50122","name":"Diploma Laboratory Technology","price":556.11,"month":"Dec-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL50122","name":"Diploma Laboratory Technology","price":556.11,"month":"Jan-26","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL50122","name":"Diploma Laboratory Technology","price":556.11,"month":"Feb-26","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL50122","name":"Diploma Laboratory Technology","price":556.11,"month":"Mar-26","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"MSL50122","name":"Diploma Laboratory Technology","price":556.11,"month":"Apr-26","units":6,"revenue":3336.67,"budget":3169.84},{"region":"VIC","code":"MSL50122","name":"Diploma Laboratory Technology","price":556.11,"month":"May-26","units":6,"revenue":3336.67,"budget":3169.84},{"region":"VIC","code":"MSL50122","name":"Diploma Laboratory Technology","price":556.11,"month":"Jun-26","units":9,"revenue":5005.0,"budget":4754.75}];

const _U13 = [{"region":"VIC","code":"HLT37215","name":"Cert III Pathology","price":417.86,"month":"Jul-24","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"HLT37215","name":"Cert III Pathology","price":417.86,"month":"Aug-24","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"HLT37215","name":"Cert III Pathology","price":417.86,"month":"Sep-24","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"HLT37215","name":"Cert III Pathology","price":417.86,"month":"Oct-24","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"HLT37215","name":"Cert III Pathology","price":417.86,"month":"Nov-24","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"HLT37215","name":"Cert III Pathology","price":417.86,"month":"Dec-24","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"HLT37215","name":"Cert III Pathology","price":417.86,"month":"Jan-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"HLT37215","name":"Cert III Pathology","price":417.86,"month":"Feb-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"HLT37215","name":"Cert III Pathology","price":417.86,"month":"Mar-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"HLT37215","name":"Cert III Pathology","price":417.86,"month":"Apr-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"HLT37215","name":"Cert III Pathology","price":417.86,"month":"May-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"HLT37215","name":"Cert III Pathology","price":417.86,"month":"Jun-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"HLT37215","name":"Cert III Pathology","price":417.86,"month":"Jul-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"HLT37215","name":"Cert III Pathology","price":417.86,"month":"Aug-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"HLT37215","name":"Cert III Pathology","price":417.86,"month":"Sep-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"HLT37215","name":"Cert III Pathology","price":417.86,"month":"Oct-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"HLT37215","name":"Cert III Pathology","price":417.86,"month":"Nov-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"HLT37215","name":"Cert III Pathology","price":417.86,"month":"Dec-25","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"HLT37215","name":"Cert III Pathology","price":417.86,"month":"Jan-26","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"HLT37215","name":"Cert III Pathology","price":417.86,"month":"Feb-26","units":0,"revenue":0.0,"budget":0.0},{"region":"VIC","code":"HLT37215","name":"Cert III Pathology","price":417.86,"month":"Mar-26","units":30,"revenue":12535.71,"budget":11908.92},{"region":"VIC","code":"HLT37215","name":"Cert III Pathology","price":417.86,"month":"Apr-26","units":60,"revenue":25071.43,"budget":23817.86},{"region":"VIC","code":"HLT37215","name":"Cert III Pathology","price":417.86,"month":"May-26","units":90,"revenue":37607.14,"budget":35726.78},{"region":"VIC","code":"HLT37215","name":"Cert III Pathology","price":417.86,"month":"Jun-26","units":120,"revenue":50142.86,"budget":47635.72},{"region":"WA","code":"MSL20122","name":"Cert II Laboratory Skills","price":977.4,"month":"Jul-24","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL20122","name":"Cert II Laboratory Skills","price":977.4,"month":"Aug-24","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL20122","name":"Cert II Laboratory Skills","price":977.4,"month":"Sep-24","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL20122","name":"Cert II Laboratory Skills","price":977.4,"month":"Oct-24","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL20122","name":"Cert II Laboratory Skills","price":977.4,"month":"Nov-24","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL20122","name":"Cert II Laboratory Skills","price":977.4,"month":"Dec-24","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL20122","name":"Cert II Laboratory Skills","price":977.4,"month":"Jan-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL20122","name":"Cert II Laboratory Skills","price":977.4,"month":"Feb-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL20122","name":"Cert II Laboratory Skills","price":977.4,"month":"Mar-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL20122","name":"Cert II Laboratory Skills","price":977.4,"month":"Apr-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL20122","name":"Cert II Laboratory Skills","price":977.4,"month":"May-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL20122","name":"Cert II Laboratory Skills","price":977.4,"month":"Jun-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL20122","name":"Cert II Laboratory Skills","price":977.4,"month":"Jul-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL20122","name":"Cert II Laboratory Skills","price":977.4,"month":"Aug-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL20122","name":"Cert II Laboratory Skills","price":977.4,"month":"Sep-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL20122","name":"Cert II Laboratory Skills","price":977.4,"month":"Oct-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL20122","name":"Cert II Laboratory Skills","price":977.4,"month":"Nov-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL20122","name":"Cert II Laboratory Skills","price":977.4,"month":"Dec-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL20122","name":"Cert II Laboratory Skills","price":977.4,"month":"Jan-26","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL20122","name":"Cert II Laboratory Skills","price":977.4,"month":"Feb-26","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL20122","name":"Cert II Laboratory Skills","price":977.4,"month":"Mar-26","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL20122","name":"Cert II Laboratory Skills","price":977.4,"month":"Apr-26","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL20122","name":"Cert II Laboratory Skills","price":977.4,"month":"May-26","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL20122","name":"Cert II Laboratory Skills","price":977.4,"month":"Jun-26","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL30122","name":"Cert III Laboratory Skills","price":601.48,"month":"Jul-24","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL30122","name":"Cert III Laboratory Skills","price":601.48,"month":"Aug-24","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL30122","name":"Cert III Laboratory Skills","price":601.48,"month":"Sep-24","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL30122","name":"Cert III Laboratory Skills","price":601.48,"month":"Oct-24","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL30122","name":"Cert III Laboratory Skills","price":601.48,"month":"Nov-24","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL30122","name":"Cert III Laboratory Skills","price":601.48,"month":"Dec-24","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL30122","name":"Cert III Laboratory Skills","price":601.48,"month":"Jan-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL30122","name":"Cert III Laboratory Skills","price":601.48,"month":"Feb-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL30122","name":"Cert III Laboratory Skills","price":601.48,"month":"Mar-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL30122","name":"Cert III Laboratory Skills","price":601.48,"month":"Apr-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL30122","name":"Cert III Laboratory Skills","price":601.48,"month":"May-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL30122","name":"Cert III Laboratory Skills","price":601.48,"month":"Jun-25","units":0,"revenue":0.0,"budget":0.0}];

const _U14 = [{"region":"WA","code":"MSL30122","name":"Cert III Laboratory Skills","price":601.48,"month":"Jul-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL30122","name":"Cert III Laboratory Skills","price":601.48,"month":"Aug-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL30122","name":"Cert III Laboratory Skills","price":601.48,"month":"Sep-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL30122","name":"Cert III Laboratory Skills","price":601.48,"month":"Oct-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL30122","name":"Cert III Laboratory Skills","price":601.48,"month":"Nov-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL30122","name":"Cert III Laboratory Skills","price":601.48,"month":"Dec-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL30122","name":"Cert III Laboratory Skills","price":601.48,"month":"Jan-26","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL30122","name":"Cert III Laboratory Skills","price":601.48,"month":"Feb-26","units":3,"revenue":1804.43,"budget":1714.21},{"region":"WA","code":"MSL30122","name":"Cert III Laboratory Skills","price":601.48,"month":"Mar-26","units":4,"revenue":2405.91,"budget":2285.61},{"region":"WA","code":"MSL30122","name":"Cert III Laboratory Skills","price":601.48,"month":"Apr-26","units":4,"revenue":2405.91,"budget":2285.61},{"region":"WA","code":"MSL30122","name":"Cert III Laboratory Skills","price":601.48,"month":"May-26","units":8,"revenue":4811.82,"budget":4571.23},{"region":"WA","code":"MSL30122","name":"Cert III Laboratory Skills","price":601.48,"month":"Jun-26","units":10,"revenue":6014.77,"budget":5714.03},{"region":"WA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":1051.59,"month":"Jul-24","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":1051.59,"month":"Aug-24","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":1051.59,"month":"Sep-24","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":1051.59,"month":"Oct-24","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":1051.59,"month":"Nov-24","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":1051.59,"month":"Dec-24","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":1051.59,"month":"Jan-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":1051.59,"month":"Feb-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":1051.59,"month":"Mar-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":1051.59,"month":"Apr-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":1051.59,"month":"May-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":1051.59,"month":"Jun-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":1051.59,"month":"Jul-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":1051.59,"month":"Aug-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":1051.59,"month":"Sep-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":1051.59,"month":"Oct-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":1051.59,"month":"Nov-25","units":10,"revenue":10515.87,"budget":9990.08},{"region":"WA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":1051.59,"month":"Dec-25","units":10,"revenue":10515.87,"budget":9990.08},{"region":"WA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":1051.59,"month":"Jan-26","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":1051.59,"month":"Feb-26","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":1051.59,"month":"Mar-26","units":25,"revenue":26289.67,"budget":24975.19},{"region":"WA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":1051.59,"month":"Apr-26","units":40,"revenue":42063.47,"budget":39960.3},{"region":"WA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":1051.59,"month":"May-26","units":46,"revenue":48372.99,"budget":45954.34},{"region":"WA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":1051.59,"month":"Jun-26","units":53,"revenue":55734.09,"budget":52947.39},{"region":"WA","code":"MSL50122","name":"Diploma Laboratory Technology","price":654.66,"month":"Jul-24","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL50122","name":"Diploma Laboratory Technology","price":654.66,"month":"Aug-24","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL50122","name":"Diploma Laboratory Technology","price":654.66,"month":"Sep-24","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL50122","name":"Diploma Laboratory Technology","price":654.66,"month":"Oct-24","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL50122","name":"Diploma Laboratory Technology","price":654.66,"month":"Nov-24","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL50122","name":"Diploma Laboratory Technology","price":654.66,"month":"Dec-24","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL50122","name":"Diploma Laboratory Technology","price":654.66,"month":"Jan-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL50122","name":"Diploma Laboratory Technology","price":654.66,"month":"Feb-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL50122","name":"Diploma Laboratory Technology","price":654.66,"month":"Mar-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL50122","name":"Diploma Laboratory Technology","price":654.66,"month":"Apr-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL50122","name":"Diploma Laboratory Technology","price":654.66,"month":"May-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL50122","name":"Diploma Laboratory Technology","price":654.66,"month":"Jun-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL50122","name":"Diploma Laboratory Technology","price":654.66,"month":"Jul-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL50122","name":"Diploma Laboratory Technology","price":654.66,"month":"Aug-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL50122","name":"Diploma Laboratory Technology","price":654.66,"month":"Sep-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL50122","name":"Diploma Laboratory Technology","price":654.66,"month":"Oct-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL50122","name":"Diploma Laboratory Technology","price":654.66,"month":"Nov-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL50122","name":"Diploma Laboratory Technology","price":654.66,"month":"Dec-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL50122","name":"Diploma Laboratory Technology","price":654.66,"month":"Jan-26","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"MSL50122","name":"Diploma Laboratory Technology","price":654.66,"month":"Feb-26","units":2,"revenue":1309.31,"budget":1243.84},{"region":"WA","code":"MSL50122","name":"Diploma Laboratory Technology","price":654.66,"month":"Mar-26","units":2,"revenue":1309.31,"budget":1243.84},{"region":"WA","code":"MSL50122","name":"Diploma Laboratory Technology","price":654.66,"month":"Apr-26","units":2,"revenue":1309.31,"budget":1243.84},{"region":"WA","code":"MSL50122","name":"Diploma Laboratory Technology","price":654.66,"month":"May-26","units":2,"revenue":1309.31,"budget":1243.84},{"region":"WA","code":"MSL50122","name":"Diploma Laboratory Technology","price":654.66,"month":"Jun-26","units":2,"revenue":1309.31,"budget":1243.84}];

const _U15 = [{"region":"WA","code":"HLT37215","name":"Cert III Pathology","price":558.51,"month":"Jul-24","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"HLT37215","name":"Cert III Pathology","price":558.51,"month":"Aug-24","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"HLT37215","name":"Cert III Pathology","price":558.51,"month":"Sep-24","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"HLT37215","name":"Cert III Pathology","price":558.51,"month":"Oct-24","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"HLT37215","name":"Cert III Pathology","price":558.51,"month":"Nov-24","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"HLT37215","name":"Cert III Pathology","price":558.51,"month":"Dec-24","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"HLT37215","name":"Cert III Pathology","price":558.51,"month":"Jan-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"HLT37215","name":"Cert III Pathology","price":558.51,"month":"Feb-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"HLT37215","name":"Cert III Pathology","price":558.51,"month":"Mar-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"HLT37215","name":"Cert III Pathology","price":558.51,"month":"Apr-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"HLT37215","name":"Cert III Pathology","price":558.51,"month":"May-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"HLT37215","name":"Cert III Pathology","price":558.51,"month":"Jun-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"HLT37215","name":"Cert III Pathology","price":558.51,"month":"Jul-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"HLT37215","name":"Cert III Pathology","price":558.51,"month":"Aug-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"HLT37215","name":"Cert III Pathology","price":558.51,"month":"Sep-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"HLT37215","name":"Cert III Pathology","price":558.51,"month":"Oct-25","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"HLT37215","name":"Cert III Pathology","price":558.51,"month":"Nov-25","units":5,"revenue":2792.57,"budget":2652.94},{"region":"WA","code":"HLT37215","name":"Cert III Pathology","price":558.51,"month":"Dec-25","units":5,"revenue":2792.57,"budget":2652.94},{"region":"WA","code":"HLT37215","name":"Cert III Pathology","price":558.51,"month":"Jan-26","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"HLT37215","name":"Cert III Pathology","price":558.51,"month":"Feb-26","units":0,"revenue":0.0,"budget":0.0},{"region":"WA","code":"HLT37215","name":"Cert III Pathology","price":558.51,"month":"Mar-26","units":20,"revenue":11170.29,"budget":10611.78},{"region":"WA","code":"HLT37215","name":"Cert III Pathology","price":558.51,"month":"Apr-26","units":40,"revenue":22340.57,"budget":21223.54},{"region":"WA","code":"HLT37215","name":"Cert III Pathology","price":558.51,"month":"May-26","units":60,"revenue":33510.86,"budget":31835.32},{"region":"WA","code":"HLT37215","name":"Cert III Pathology","price":558.51,"month":"Jun-26","units":80,"revenue":44681.14,"budget":42447.08},{"region":"SA","code":"MSL30122","name":"Cert III Laboratory Skills","price":321.23,"month":"Jul-24","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"MSL30122","name":"Cert III Laboratory Skills","price":321.23,"month":"Aug-24","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"MSL30122","name":"Cert III Laboratory Skills","price":321.23,"month":"Sep-24","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"MSL30122","name":"Cert III Laboratory Skills","price":321.23,"month":"Oct-24","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"MSL30122","name":"Cert III Laboratory Skills","price":321.23,"month":"Nov-24","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"MSL30122","name":"Cert III Laboratory Skills","price":321.23,"month":"Dec-24","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"MSL30122","name":"Cert III Laboratory Skills","price":321.23,"month":"Jan-25","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"MSL30122","name":"Cert III Laboratory Skills","price":321.23,"month":"Feb-25","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"MSL30122","name":"Cert III Laboratory Skills","price":321.23,"month":"Mar-25","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"MSL30122","name":"Cert III Laboratory Skills","price":321.23,"month":"Apr-25","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"MSL30122","name":"Cert III Laboratory Skills","price":321.23,"month":"May-25","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"MSL30122","name":"Cert III Laboratory Skills","price":321.23,"month":"Jun-25","units":2,"revenue":642.46,"budget":610.34},{"region":"SA","code":"MSL30122","name":"Cert III Laboratory Skills","price":321.23,"month":"Jul-25","units":2,"revenue":642.46,"budget":610.34},{"region":"SA","code":"MSL30122","name":"Cert III Laboratory Skills","price":321.23,"month":"Aug-25","units":4,"revenue":1284.92,"budget":1220.67},{"region":"SA","code":"MSL30122","name":"Cert III Laboratory Skills","price":321.23,"month":"Sep-25","units":6,"revenue":1927.38,"budget":1831.01},{"region":"SA","code":"MSL30122","name":"Cert III Laboratory Skills","price":321.23,"month":"Oct-25","units":6,"revenue":1927.38,"budget":1831.01},{"region":"SA","code":"MSL30122","name":"Cert III Laboratory Skills","price":321.23,"month":"Nov-25","units":8,"revenue":2569.84,"budget":2441.35},{"region":"SA","code":"MSL30122","name":"Cert III Laboratory Skills","price":321.23,"month":"Dec-25","units":4,"revenue":1284.92,"budget":1220.67},{"region":"SA","code":"MSL30122","name":"Cert III Laboratory Skills","price":321.23,"month":"Jan-26","units":5,"revenue":1606.15,"budget":1525.84},{"region":"SA","code":"MSL30122","name":"Cert III Laboratory Skills","price":321.23,"month":"Feb-26","units":12,"revenue":3854.76,"budget":3662.02},{"region":"SA","code":"MSL30122","name":"Cert III Laboratory Skills","price":321.23,"month":"Mar-26","units":12,"revenue":3854.76,"budget":3662.02},{"region":"SA","code":"MSL30122","name":"Cert III Laboratory Skills","price":321.23,"month":"Apr-26","units":12,"revenue":3854.76,"budget":3662.02},{"region":"SA","code":"MSL30122","name":"Cert III Laboratory Skills","price":321.23,"month":"May-26","units":14,"revenue":4497.22,"budget":4272.36},{"region":"SA","code":"MSL30122","name":"Cert III Laboratory Skills","price":321.23,"month":"Jun-26","units":14,"revenue":4497.22,"budget":4272.36},{"region":"SA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":396.27,"month":"Jul-24","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":396.27,"month":"Aug-24","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":396.27,"month":"Sep-24","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":396.27,"month":"Oct-24","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":396.27,"month":"Nov-24","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":396.27,"month":"Dec-24","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":396.27,"month":"Jan-25","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":396.27,"month":"Feb-25","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":396.27,"month":"Mar-25","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":396.27,"month":"Apr-25","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":396.27,"month":"May-25","units":5,"revenue":1981.35,"budget":1882.28},{"region":"SA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":396.27,"month":"Jun-25","units":5,"revenue":1981.35,"budget":1882.28}];

const _U16 = [{"region":"SA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":396.27,"month":"Jul-25","units":6,"revenue":2377.62,"budget":2258.74},{"region":"SA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":396.27,"month":"Aug-25","units":6,"revenue":2377.62,"budget":2258.74},{"region":"SA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":396.27,"month":"Sep-25","units":6,"revenue":2377.62,"budget":2258.74},{"region":"SA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":396.27,"month":"Oct-25","units":7,"revenue":2773.89,"budget":2635.2},{"region":"SA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":396.27,"month":"Nov-25","units":7,"revenue":2773.89,"budget":2635.2},{"region":"SA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":396.27,"month":"Dec-25","units":4,"revenue":1585.08,"budget":1505.83},{"region":"SA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":396.27,"month":"Jan-26","units":4,"revenue":1585.08,"budget":1505.83},{"region":"SA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":396.27,"month":"Feb-26","units":18,"revenue":7132.86,"budget":6776.22},{"region":"SA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":396.27,"month":"Mar-26","units":22,"revenue":8717.94,"budget":8282.04},{"region":"SA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":396.27,"month":"Apr-26","units":22,"revenue":8717.94,"budget":8282.04},{"region":"SA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":396.27,"month":"May-26","units":24,"revenue":9510.48,"budget":9034.96},{"region":"SA","code":"MSL40122","name":"Cert IV Laboratory Skills","price":396.27,"month":"Jun-26","units":24,"revenue":9510.48,"budget":9034.96},{"region":"SA","code":"MSL50122","name":"Diploma Laboratory Technology","price":324.88,"month":"Jul-24","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"MSL50122","name":"Diploma Laboratory Technology","price":324.88,"month":"Aug-24","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"MSL50122","name":"Diploma Laboratory Technology","price":324.88,"month":"Sep-24","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"MSL50122","name":"Diploma Laboratory Technology","price":324.88,"month":"Oct-24","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"MSL50122","name":"Diploma Laboratory Technology","price":324.88,"month":"Nov-24","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"MSL50122","name":"Diploma Laboratory Technology","price":324.88,"month":"Dec-24","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"MSL50122","name":"Diploma Laboratory Technology","price":324.88,"month":"Jan-25","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"MSL50122","name":"Diploma Laboratory Technology","price":324.88,"month":"Feb-25","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"MSL50122","name":"Diploma Laboratory Technology","price":324.88,"month":"Mar-25","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"MSL50122","name":"Diploma Laboratory Technology","price":324.88,"month":"Apr-25","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"MSL50122","name":"Diploma Laboratory Technology","price":324.88,"month":"May-25","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"MSL50122","name":"Diploma Laboratory Technology","price":324.88,"month":"Jun-25","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"MSL50122","name":"Diploma Laboratory Technology","price":324.88,"month":"Jul-25","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"MSL50122","name":"Diploma Laboratory Technology","price":324.88,"month":"Aug-25","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"MSL50122","name":"Diploma Laboratory Technology","price":324.88,"month":"Sep-25","units":2,"revenue":649.76,"budget":617.27},{"region":"SA","code":"MSL50122","name":"Diploma Laboratory Technology","price":324.88,"month":"Oct-25","units":2,"revenue":649.76,"budget":617.27},{"region":"SA","code":"MSL50122","name":"Diploma Laboratory Technology","price":324.88,"month":"Nov-25","units":2,"revenue":649.76,"budget":617.27},{"region":"SA","code":"MSL50122","name":"Diploma Laboratory Technology","price":324.88,"month":"Dec-25","units":1,"revenue":324.88,"budget":308.64},{"region":"SA","code":"MSL50122","name":"Diploma Laboratory Technology","price":324.88,"month":"Jan-26","units":1,"revenue":324.88,"budget":308.64},{"region":"SA","code":"MSL50122","name":"Diploma Laboratory Technology","price":324.88,"month":"Feb-26","units":2,"revenue":649.76,"budget":617.27},{"region":"SA","code":"MSL50122","name":"Diploma Laboratory Technology","price":324.88,"month":"Mar-26","units":4,"revenue":1299.52,"budget":1234.54},{"region":"SA","code":"MSL50122","name":"Diploma Laboratory Technology","price":324.88,"month":"Apr-26","units":8,"revenue":2599.04,"budget":2469.09},{"region":"SA","code":"MSL50122","name":"Diploma Laboratory Technology","price":324.88,"month":"May-26","units":8,"revenue":2599.04,"budget":2469.09},{"region":"SA","code":"MSL50122","name":"Diploma Laboratory Technology","price":324.88,"month":"Jun-26","units":9,"revenue":2923.92,"budget":2777.72},{"region":"SA","code":"HLT37215","name":"Cert III Pathology","price":278.64,"month":"Jul-24","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"HLT37215","name":"Cert III Pathology","price":278.64,"month":"Aug-24","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"HLT37215","name":"Cert III Pathology","price":278.64,"month":"Sep-24","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"HLT37215","name":"Cert III Pathology","price":278.64,"month":"Oct-24","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"HLT37215","name":"Cert III Pathology","price":278.64,"month":"Nov-24","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"HLT37215","name":"Cert III Pathology","price":278.64,"month":"Dec-24","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"HLT37215","name":"Cert III Pathology","price":278.64,"month":"Jan-25","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"HLT37215","name":"Cert III Pathology","price":278.64,"month":"Feb-25","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"HLT37215","name":"Cert III Pathology","price":278.64,"month":"Mar-25","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"HLT37215","name":"Cert III Pathology","price":278.64,"month":"Apr-25","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"HLT37215","name":"Cert III Pathology","price":278.64,"month":"May-25","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"HLT37215","name":"Cert III Pathology","price":278.64,"month":"Jun-25","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"HLT37215","name":"Cert III Pathology","price":278.64,"month":"Jul-25","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"HLT37215","name":"Cert III Pathology","price":278.64,"month":"Aug-25","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"HLT37215","name":"Cert III Pathology","price":278.64,"month":"Sep-25","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"HLT37215","name":"Cert III Pathology","price":278.64,"month":"Oct-25","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"HLT37215","name":"Cert III Pathology","price":278.64,"month":"Nov-25","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"HLT37215","name":"Cert III Pathology","price":278.64,"month":"Dec-25","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"HLT37215","name":"Cert III Pathology","price":278.64,"month":"Jan-26","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"HLT37215","name":"Cert III Pathology","price":278.64,"month":"Feb-26","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"HLT37215","name":"Cert III Pathology","price":278.64,"month":"Mar-26","units":0,"revenue":0.0,"budget":0.0},{"region":"SA","code":"HLT37215","name":"Cert III Pathology","price":278.64,"month":"Apr-26","units":5,"revenue":1393.2,"budget":1323.54},{"region":"SA","code":"HLT37215","name":"Cert III Pathology","price":278.64,"month":"May-26","units":15,"revenue":4179.6,"budget":3970.62},{"region":"SA","code":"HLT37215","name":"Cert III Pathology","price":278.64,"month":"Jun-26","units":30,"revenue":8359.2,"budget":7941.24}];

const SEED_UNITS = [..._U1,..._U2,..._U3,..._U4,..._U5,..._U6,..._U7,..._U8,..._U9,..._U10,..._U11,..._U12,..._U13,..._U14,..._U15,..._U16];

function seedUnits() { return SEED_UNITS; }
function seedPayments() { return SEED_PAYMENTS; }

function parseMonthDate(m) {
  const months = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
  const [mon, yr] = m.split("-");
  return new Date(2000 + parseInt(yr), months[mon], 1);
}
const getFY = d => { const yr = d.getFullYear(), mo = d.getMonth(); const fy = mo >= 6 ? yr+1 : yr; return `FY${fy.toString().slice(-2)}`; };
const getCY = d => d.getFullYear().toString();
const inPeriod = (month, basis, year) => { if (year === "All") return true; const d = parseMonthDate(month); return (basis === "financial" ? getFY(d) : getCY(d)) === year; };

// ─────────────────────────────────────────────────────────────
// STAFF ROLES  (defined here so recalculate can use getMonthlyCost)
// ─────────────────────────────────────────────────────────────
const STAFF_ROLES = [
  { id:"trainer",     label:"Trainer",        baseWage:85000,  car:12000, phone:1200,  sup:0.12, ptax:0.055 },
  { id:"sales",       label:"Sales Person",   baseWage:100000, car:12000, phone:12000, sup:0.12, ptax:0.055 },
  { id:"admin",       label:"Administration", baseWage:67500,  car:0,     phone:0,     sup:0.12, ptax:0.055 },
  { id:"manager",     label:"Manager",        baseWage:110000, car:0,     phone:0,     sup:0.12, ptax:0.055 },
  { id:"snr_manager", label:"Senior Manager", baseWage:120000, car:0,     phone:0,     sup:0.12, ptax:0.055 },
];
const getMonthlyCost = id => { const r=STAFF_ROLES.find(x=>x.id===id); if(!r)return 0; const a=r.baseWage+r.car+r.phone+r.baseWage*r.sup; return a*(1+r.ptax)/12; };

// ─────────────────────────────────────────────────────────────
// FINANCIAL CALCULATIONS
// ─────────────────────────────────────────────────────────────
function recalculate(units, payments, staffPlan = []) {
  const regionMap = {};
  REGIONS.forEach(r => {
    regionMap[r] = { region: r, totalRevenue:0, totalUnits:0, totalBudget:0,
      monthlyData: MONTHS.map(m => ({ month:m, revenue:0, units:0, budget:0 })) };
  });

  units.forEach(u => {
    if (!regionMap[u.region]) return;
    const idx = MONTHS.indexOf(u.month);
    if (idx < 0) return;
    regionMap[u.region].monthlyData[idx].revenue += u.revenue;
    regionMap[u.region].monthlyData[idx].units   += u.units;
    regionMap[u.region].monthlyData[idx].budget  += u.budget;
  });

  Object.values(regionMap).forEach(r => {
    r.totalRevenue = r.monthlyData.reduce((s,m) => s+m.revenue, 0);
    r.totalUnits   = r.monthlyData.reduce((s,m) => s+m.units,   0);
    r.totalBudget  = r.monthlyData.reduce((s,m) => s+m.budget,  0);
  });

  const revByMonth = {};
  Object.values(regionMap).forEach(r => r.monthlyData.forEach(md => { revByMonth[md.month] = (revByMonth[md.month]||0) + md.revenue; }));

  // Build extra staff cost per month from staffPlan hire events
  const extraStaffByMonth = {};
  MONTHS.forEach(m => { extraStaffByMonth[m] = 0; });
  staffPlan.forEach(e => {
    const startIdx = MONTHS.indexOf(e.start_month);
    if (startIdx < 0) return;
    const monthlyCost = getMonthlyCost(e.role_id) * (e.count || 1);
    MONTHS.forEach((m, i) => { if (i >= startIdx) extraStaffByMonth[m] += monthlyCost; });
  });

  // sort payments by MONTHS order
  const sortedPay = [...payments].sort((a,b) => MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month));
  let balance = sortedPay[0]?.opening_balance || 500000;
  const ops = MONTHS.map((m, i) => {
    const p = sortedPay.find(x => x.month === m) || { payments:0, opening_balance: i===0 ? 500000 : 0 };
    const rev = revByMonth[m] || 0;
    const baseCost = p.payments || 0;
    const staffExtra = extraStaffByMonth[m] || 0;
    const totalCost = baseCost + staffExtra;
    const net = rev - totalCost;
    const open = i === 0 ? p.opening_balance : balance;
    const close = open + net;
    balance = close;
    return { month:m, revenue:rev, payments:totalCost, baseCost, staffExtra, netCashflow:net, openingBalance:open, closingBalance:close };
  });

  const regions = Object.values(regionMap);
  return {
    regions, ops,
    grandRev:    regions.reduce((s,r) => s+r.totalRevenue, 0),
    grandUnits:  regions.reduce((s,r) => s+r.totalUnits,   0),
    grandBudget: regions.reduce((s,r) => s+r.totalBudget,  0),
  };
}

// ─────────────────────────────────────────────────────────────
// FORMATTERS
// ─────────────────────────────────────────────────────────────
const fmt  = v => new Intl.NumberFormat("en-AU",{style:"currency",currency:"AUD",maximumFractionDigits:0}).format(v);
const fmtK = v => { const a=Math.abs(v); if(a>=1e6) return `${v<0?"-":""}$${(a/1e6).toFixed(1)}M`; if(a>=1e3) return `${v<0?"-":""}$${(a/1e3).toFixed(0)}K`; return fmt(v); };
const fmtN = v => new Intl.NumberFormat("en-AU").format(v);

// ─────────────────────────────────────────────────────────────
// SHARED STYLES
// ─────────────────────────────────────────────────────────────
const card  = { background:"white", borderRadius:"14px", padding:"24px", border:"1px solid #f1f5f9", boxShadow:"0 1px 8px rgba(0,0,0,0.06)" };
const selSt = { background:"white", border:"1px solid #e2e8f0", borderRadius:"8px", padding:"8px 12px", fontSize:"13px", color:"#0f172a" };
const inpSt = { background:"white", border:"1px solid #e2e8f0", borderRadius:"8px", padding:"8px 12px", fontSize:"13px", color:"#0f172a" };

// ─────────────────────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────────────────────
function Toast({ message, type }) {
  if (!message) return null;
  const bg = type === "error" ? "#fee2e2" : type === "saving" ? "#fef3c7" : "#dcfce7";
  const col = type === "error" ? "#ef4444" : type === "saving" ? "#d97706" : "#16a34a";
  return (
    <div style={{ position:"fixed", bottom:"24px", right:"24px", background:bg, border:`1px solid ${col}30`, borderRadius:"10px", padding:"12px 20px", color:col, fontSize:"13px", fontWeight:"600", zIndex:9999, boxShadow:"0 4px 20px rgba(0,0,0,0.1)", display:"flex", alignItems:"center", gap:"8px" }}>
      {type === "saving" ? "⏳" : type === "error" ? "❌" : "✓"} {message}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email, setEmail]       = useState("admin@edugrowth.com.au");
  const [password, setPassword] = useState("Admin2024!");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async () => {
    setLoading(true); setError("");
    try {
      const rows = await sbSelect("eg_users", `email=eq.${encodeURIComponent(email)}&password=eq.${encodeURIComponent(password)}&select=id,email,name,role`);
      if (rows.length > 0) { onLogin(rows[0]); }
      else { setError("Invalid email or password."); }
    } catch(e) {
      setError("Connection error — check your Supabase setup.");
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#0a0f1e 0%,#0d1b3e 50%,#0a1628 100%)", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Georgia,serif" }}>
      {/* background orbs */}
      <div style={{ position:"absolute", inset:0, overflow:"hidden", pointerEvents:"none" }}>
        {[...Array(16)].map((_,i) => (
          <div key={i} style={{ position:"absolute", borderRadius:"50%", background:`rgba(56,189,248,${0.02+Math.random()*0.04})`, width:`${50+Math.random()*130}px`, height:`${50+Math.random()*130}px`, top:`${Math.random()*100}%`, left:`${Math.random()*100}%`, animation:`pulse ${3+Math.random()*4}s ease-in-out infinite`, animationDelay:`${Math.random()*4}s` }} />
        ))}
      </div>

      <div style={{ width:"420px", background:"rgba(15,23,42,0.88)", backdropFilter:"blur(20px)", border:"1px solid rgba(56,189,248,0.2)", borderRadius:"20px", padding:"48px", position:"relative" }}>
        <div style={{ textAlign:"center", marginBottom:"40px" }}>
          <div style={{ width:"72px", height:"72px", background:"linear-gradient(135deg,#0ea5e9,#0284c7)", borderRadius:"18px", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px", boxShadow:"0 0 40px rgba(14,165,233,0.3)", fontSize:"32px" }}>📊</div>
          <h1 style={{ color:"#e2e8f0", fontSize:"26px", fontWeight:"700", margin:"0 0 6px", letterSpacing:"-0.5px" }}>EduGrowth BI</h1>
          <p style={{ color:"#64748b", fontSize:"13px", margin:0, fontFamily:"sans-serif" }}>Financial Intelligence Platform</p>
          <div style={{ display:"inline-flex", alignItems:"center", gap:"6px", marginTop:"10px", padding:"4px 12px", background:"rgba(14,165,233,0.1)", borderRadius:"20px", border:"1px solid rgba(14,165,233,0.2)" }}>
            <span style={{ width:"6px", height:"6px", borderRadius:"50%", background:"#22c55e", display:"inline-block" }} />
            <span style={{ color:"#94a3b8", fontSize:"11px", fontFamily:"sans-serif" }}>Connected to Supabase</span>
          </div>
        </div>

        {[
          { label:"Email",    type:"email",    val:email,    set:setEmail },
          { label:"Password", type:"password", val:password, set:setPassword },
        ].map(({ label, type, val, set }) => (
          <div key={label} style={{ marginBottom:"16px" }}>
            <label style={{ display:"block", color:"#94a3b8", fontSize:"11px", fontFamily:"sans-serif", fontWeight:"700", textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:"8px" }}>{label}</label>
            <input type={type} value={val} onChange={e => set(e.target.value)} onKeyDown={e => e.key==="Enter" && handleSubmit()}
              style={{ width:"100%", background:"rgba(30,41,59,0.8)", border:"1px solid rgba(56,189,248,0.2)", borderRadius:"10px", padding:"12px 16px", color:"#e2e8f0", fontSize:"14px", fontFamily:"sans-serif", outline:"none", boxSizing:"border-box" }} />
          </div>
        ))}

        {error && <div style={{ background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:"8px", padding:"10px 14px", color:"#fca5a5", fontSize:"13px", fontFamily:"sans-serif", marginBottom:"16px" }}>{error}</div>}

        <button onClick={handleSubmit} disabled={loading}
          style={{ width:"100%", background:loading?"rgba(14,165,233,0.5)":"linear-gradient(135deg,#0ea5e9,#0284c7)", border:"none", borderRadius:"10px", padding:"14px", color:"white", fontSize:"15px", fontFamily:"sans-serif", fontWeight:"600", cursor:loading?"not-allowed":"pointer", boxShadow:"0 4px 20px rgba(14,165,233,0.25)" }}>
          {loading ? "Signing in…" : "Sign In →"}
        </button>

        <div style={{ marginTop:"24px", padding:"14px 16px", background:"rgba(14,165,233,0.07)", borderRadius:"10px", border:"1px solid rgba(14,165,233,0.15)" }}>
          <p style={{ color:"#64748b", fontSize:"11px", fontFamily:"sans-serif", margin:"0 0 5px", fontWeight:"700" }}>Demo Credentials</p>
          <p style={{ color:"#94a3b8", fontSize:"11px", fontFamily:"sans-serif", margin:"2px 0" }}>admin@edugrowth.com.au / Admin2024!</p>
          <p style={{ color:"#94a3b8", fontSize:"11px", fontFamily:"sans-serif", margin:"2px 0" }}>finance@edugrowth.com.au / Finance2024!</p>
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:.3;transform:scale(1)}50%{opacity:.8;transform:scale(1.1)}}`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, icon, trend }) {
  const c = { blue:"#0ea5e9", teal:"#14b8a6", green:"#22c55e", orange:"#f97316", red:"#ef4444", purple:"#a855f7" }[color] || "#0ea5e9";
  return (
    <div style={{ ...card, display:"flex", flexDirection:"column", gap:"6px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div style={{ fontSize:"11px", color:"#64748b", fontWeight:"700", textTransform:"uppercase", letterSpacing:"0.5px" }}>{label}</div>
        <div style={{ width:"34px", height:"34px", background:`${c}18`, borderRadius:"10px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"17px" }}>{icon}</div>
      </div>
      <div style={{ fontSize:"26px", fontWeight:"800", color:"#0f172a", letterSpacing:"-1px" }}>{value}</div>
      {sub && <div style={{ fontSize:"12px", color: trend==="up" ? "#22c55e" : trend==="down" ? "#ef4444" : "#94a3b8" }}>{sub}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DASHBOARD OVERVIEW
// ─────────────────────────────────────────────────────────────
function DashboardOverview({ calc, yearBasis, selectedYear }) {
  const { regions, ops, grandRev, grandUnits, grandBudget } = calc;

  const agg = useMemo(() => {
    let rev=0, units=0, budget=0, payments=0, cashPos=0;
    ops.forEach(o => { if(inPeriod(o.month,yearBasis,selectedYear)){ rev+=o.revenue; payments+=o.payments; cashPos=o.closingBalance; }});
    regions.forEach(r => r.monthlyData.forEach(md => { if(inPeriod(md.month,yearBasis,selectedYear)){ units+=md.units; budget+=md.budget; }}));

    const chartData = MONTHS.filter(m => inPeriod(m,yearBasis,selectedYear)).map(m => {
      const o = ops.find(x=>x.month===m)||{};
      return { month:m.slice(0,3), revenue:o.revenue||0, baseCost:o.baseCost||0, staffExtra:o.staffExtra||0, payments:o.payments||0, balance:o.closingBalance||0, netCashflow:o.netCashflow||0 };
    });

    const regionData = regions.map(r => ({
      name: r.region,
      revenue: r.monthlyData.filter(md=>inPeriod(md.month,yearBasis,selectedYear)).reduce((s,md)=>s+md.revenue,0),
    })).sort((a,b)=>b.revenue-a.revenue);

    return { rev, units, budget, payments, cashPos, chartData, regionData };
  }, [regions, ops, yearBasis, selectedYear]);

  const totalStaffExtra = agg.chartData.reduce((s,d)=>s+(d.staffExtra||0),0);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"24px" }}>
      {totalStaffExtra > 0 && (
        <div style={{ display:"flex", alignItems:"center", gap:"10px", padding:"10px 16px", background:"#fef3c7", border:"1px solid #fcd34d", borderRadius:"10px", fontSize:"13px", color:"#92400e" }}>
          <span>👥</span>
          <span><strong>New hire costs active:</strong> {fmtK(totalStaffExtra)} added to total costs this period from Staff Planner hires. Remove hires from Staff Planner to reverse.</span>
        </div>
      )}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:"16px" }}>
        <StatCard label="Total Revenue"    value={fmtK(agg.rev)}    sub={`Budget: ${fmtK(agg.budget)}`} color="blue"   icon="💰" />
        <StatCard label="Total Enrolments" value={fmtN(agg.units)}  sub="Students enrolled"              color="teal"   icon="🎓" />
        <StatCard label="Budget Attainment" value={agg.budget>0?`${Math.round(agg.rev/agg.budget*100)}%`:"—"} sub={agg.rev>=agg.budget?"▲ On track":"▼ Below budget"} color={agg.rev>=agg.budget?"green":"orange"} icon="🎯" trend={agg.rev>=agg.budget?"up":"down"} />
        <StatCard label="Cash Position"    value={fmtK(agg.cashPos)} sub={totalStaffExtra>0?`Costs: ${fmtK(agg.payments)} (incl. ${fmtK(totalStaffExtra)} new hires)`:`Payments: ${fmtK(agg.payments)}`} color={agg.cashPos>0?"green":"red"} icon="🏦" trend={agg.cashPos>0?"up":"down"} />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:"24px" }}>
        <div style={card}>
          <h3 style={{ fontSize:"14px", fontWeight:"700", color:"#0f172a", margin:"0 0 16px" }}>Revenue · Costs · Cash Balance</h3>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={agg.chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{fontSize:11}} />
              <YAxis yAxisId="l" tickFormatter={v=>`$${(v/1000).toFixed(0)}K`} tick={{fontSize:11}} />
              <YAxis yAxisId="r" orientation="right" tickFormatter={v=>`$${(v/1000).toFixed(0)}K`} tick={{fontSize:11}} />
              <Tooltip formatter={(v,n)=>[fmtK(v),n]} />
              <Legend />
              <Bar yAxisId="l" dataKey="revenue"    fill="#0ea5e9" opacity={0.85} name="Revenue"         stackId="no" />
              <Bar yAxisId="l" dataKey="baseCost"   fill="#f97316" opacity={0.75} name="Base Costs"      stackId="costs" />
              <Bar yAxisId="l" dataKey="staffExtra" fill="#ef4444" opacity={0.85} name="New Hire Costs"  stackId="costs" />
              <Line yAxisId="r" type="monotone" dataKey="balance" stroke="#22c55e" strokeWidth={2} dot={false} name="Cash Balance" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div style={card}>
          <h3 style={{ fontSize:"14px", fontWeight:"700", color:"#0f172a", margin:"0 0 16px" }}>Revenue by Region</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={agg.regionData} cx="50%" cy="50%" innerRadius={55} outerRadius={88} dataKey="revenue" nameKey="name">
                {agg.regionData.map((d,i)=><Cell key={i} fill={REGION_COLORS[d.name]||"#94a3b8"} />)}
              </Pie>
              <Tooltip formatter={v=>fmtK(v)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={card}>
        <h3 style={{ fontSize:"14px", fontWeight:"700", color:"#0f172a", margin:"0 0 16px" }}>Monthly Net Cashflow</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={agg.chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{fontSize:11}} />
            <YAxis tickFormatter={v=>`$${(v/1000).toFixed(0)}K`} tick={{fontSize:11}} />
            <Tooltip formatter={v=>fmtK(v)} />
            <ReferenceLine y={0} stroke="#94a3b8" />
            <Bar dataKey="netCashflow" name="Net Cashflow" radius={[4,4,0,0]}>
              {agg.chartData.map((d,i)=><Cell key={i} fill={d.netCashflow>=0?"#22c55e":"#ef4444"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// REGIONAL ANALYSIS
// ─────────────────────────────────────────────────────────────
function RegionalAnalysis({ calc, yearBasis, selectedYear }) {
  const { regions } = calc;
  const filtered = useMemo(() => regions.map((r,i) => {
    const fMD = r.monthlyData.filter(md => inPeriod(md.month,yearBasis,selectedYear));
    return { region:r.region, revenue:fMD.reduce((s,m)=>s+m.revenue,0), units:fMD.reduce((s,m)=>s+m.units,0), budget:fMD.reduce((s,m)=>s+m.budget,0), trend:fMD.slice(-6).map(m=>({month:m.month.slice(0,3),revenue:m.revenue})), color:REGION_COLORS[r.region]||"#94a3b8" };
  }), [regions, yearBasis, selectedYear]);

  const chartData = useMemo(() => MONTHS.filter(m=>inPeriod(m,yearBasis,selectedYear)).map(m => {
    const row = { month:m.slice(0,3) };
    regions.forEach(r => { const md=r.monthlyData.find(d=>d.month===m); row[r.region]=md?md.revenue:0; });
    return row;
  }), [regions, yearBasis, selectedYear]);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"24px" }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:"14px" }}>
        {filtered.map(r => (
          <div key={r.region} style={{ ...card, border:`1px solid ${r.color}25` }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"10px" }}>
              <span style={{ fontWeight:"800", fontSize:"20px", color:r.color }}>{r.region}</span>
              <span style={{ fontSize:"11px", background:`${r.color}15`, color:r.color, borderRadius:"20px", padding:"3px 10px", fontWeight:"700" }}>
                {r.budget>0?`${Math.round(r.revenue/r.budget*100)}%`:"—"}
              </span>
            </div>
            <div style={{ fontSize:"22px", fontWeight:"800", color:"#0f172a" }}>{fmtK(r.revenue)}</div>
            <div style={{ fontSize:"12px", color:"#64748b", marginTop:"4px" }}>{fmtN(r.units)} units · Budget {fmtK(r.budget)}</div>
            <div style={{ marginTop:"12px", height:"40px" }}>
              <ResponsiveContainer width="100%" height={40}>
                <AreaChart data={r.trend}><Area type="monotone" dataKey="revenue" stroke={r.color} fill={`${r.color}20`} strokeWidth={2} dot={false} /></AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>

      <div style={card}>
        <h3 style={{ fontSize:"14px", fontWeight:"700", color:"#0f172a", margin:"0 0 16px" }}>Stacked Regional Revenue</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{fontSize:11}} />
            <YAxis tickFormatter={v=>`$${(v/1000).toFixed(0)}K`} tick={{fontSize:11}} />
            <Tooltip formatter={v=>fmtK(v)} />
            <Legend />
            {REGIONS.map((r,i)=><Area key={r} type="monotone" dataKey={r} stackId="1" stroke={REGION_COLORS[r]||"#94a3b8"} fill={REGION_COLORS[r]||"#94a3b8"} fillOpacity={0.65} />)}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// BUDGET EDITOR  (reads/writes eg_units in Supabase)
// ─────────────────────────────────────────────────────────────
function BudgetEditor({ rawUnits, onUnitsChange, toast }) {
  const [region,   setRegion]   = useState("NSW");
  const [editMode, setEditMode] = useState("units");
  const [editCell, setEditCell] = useState(null);
  const [editVal,  setEditVal]  = useState("");

  const filtered = rawUnits.filter(u => u.region === region);
  const productCodes = [...new Set(filtered.map(u => u.code))];

  const getVal = (code, month) => {
    const u = filtered.find(x => x.code===code && x.month===month);
    if (!u) return 0;
    return editMode === "units" ? u.units : u.budget;
  };

  const handleSave = async () => {
    if (!editCell) return;
    const [code, month] = editCell.split("|||");
    const val = parseFloat(editVal) || 0;
    const prod = filtered.find(u => u.code===code);

    const existing = filtered.find(u => u.code===code && u.month===month);
    const updated = { ...existing, region, code, month, name: prod?.name||code, price: prod?.price||0 };

    if (editMode === "units") {
      updated.units   = Math.round(val);
      updated.revenue = Math.round(val) * (prod?.price || 0);
    } else {
      updated.budget  = Math.round(val);
    }
    updated.updated_at = new Date().toISOString();

    toast("Saving…", "saving");
    try {
      await sbUpsert("eg_units", updated);
      onUnitsChange(prev => prev.map(u => u.region===region && u.code===code && u.month===month ? { ...u, ...updated } : u));
      toast("Saved ✓", "success");
    } catch(e) {
      toast("Save failed: " + e.message, "error");
    }
    setEditCell(null);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"20px" }}>
      <div style={{ display:"flex", gap:"12px", alignItems:"center", flexWrap:"wrap" }}>
        <select value={region} onChange={e=>setRegion(e.target.value)} style={selSt}>
          {REGIONS.map(r=><option key={r}>{r}</option>)}
        </select>
        <div style={{ display:"flex", background:"#f1f5f9", borderRadius:"8px", padding:"3px" }}>
          {["units","budget"].map(m=>(
            <button key={m} onClick={()=>setEditMode(m)} style={{ padding:"6px 14px", borderRadius:"6px", border:"none", cursor:"pointer", fontSize:"13px", fontWeight:"600", background:editMode===m?"white":"transparent", color:editMode===m?"#0ea5e9":"#64748b", boxShadow:editMode===m?"0 1px 4px rgba(0,0,0,0.1)":"none" }}>
              {m==="units"?"Unit Counts":"Budget $"}
            </button>
          ))}
        </div>
        <span style={{ fontSize:"12px", color:"#94a3b8" }}>Click any cell to edit · Enter to save · Esc to cancel</span>
      </div>

      <div style={{ ...card, padding:"0", overflow:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"12px", minWidth:"1200px" }}>
          <thead>
            <tr style={{ background:"#f8fafc", borderBottom:"2px solid #e2e8f0" }}>
              <th style={{ padding:"12px 16px", textAlign:"left", color:"#64748b", fontWeight:"700", position:"sticky", left:0, background:"#f8fafc", minWidth:"180px" }}>Product</th>
              {MONTHS.map(m=><th key={m} style={{ padding:"8px 10px", textAlign:"right", color:"#64748b", fontWeight:"600", minWidth:"72px", whiteSpace:"nowrap" }}>{m.slice(0,3)}</th>)}
              <th style={{ padding:"8px 14px", textAlign:"right", color:"#0f172a", fontWeight:"700", background:"#eef2ff", minWidth:"90px" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {productCodes.map(code => {
              const prod = filtered.find(u=>u.code===code);
              const rowTotal = MONTHS.reduce((s,m)=>s+getVal(code,m),0);
              return (
                <tr key={code} style={{ borderBottom:"1px solid #f1f5f9" }}>
                  <td style={{ padding:"10px 16px", fontWeight:"600", color:"#0f172a", position:"sticky", left:0, background:"white", borderRight:"1px solid #f1f5f9" }}>
                    <div style={{ fontSize:"13px" }}>{code}</div>
                    <div style={{ fontSize:"11px", color:"#94a3b8" }}>@ {fmt(prod?.price||0)}</div>
                  </td>
                  {MONTHS.map(month => {
                    const key = `${code}|||${month}`;
                    const isEditing = editCell === key;
                    const val = getVal(code, month);
                    return (
                      <td key={month} style={{ padding:"3px 5px", textAlign:"right" }} onClick={()=>{ if(!isEditing){setEditCell(key);setEditVal(String(val));} }}>
                        {isEditing
                          ? <input autoFocus value={editVal} onChange={e=>setEditVal(e.target.value)}
                              onBlur={handleSave} onKeyDown={e=>{if(e.key==="Enter")handleSave();if(e.key==="Escape")setEditCell(null);}}
                              style={{ width:"68px", padding:"4px 6px", border:"2px solid #0ea5e9", borderRadius:"6px", fontSize:"12px", textAlign:"right" }} />
                          : <div style={{ padding:"5px 7px", borderRadius:"6px", cursor:"pointer" }}
                              onMouseEnter={e=>e.currentTarget.style.background="#f0f9ff"}
                              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                              {editMode==="units"?fmtN(val):fmtK(val)}
                            </div>
                        }
                      </td>
                    );
                  })}
                  <td style={{ padding:"10px 14px", textAlign:"right", fontWeight:"700", color:"#0f172a", background:"#f5f7ff" }}>
                    {editMode==="units"?fmtN(rowTotal):fmtK(rowTotal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background:"#f8fafc", borderTop:"2px solid #e2e8f0" }}>
              <td style={{ padding:"12px 16px", fontWeight:"800", color:"#0f172a", position:"sticky", left:0, background:"#f8fafc" }}>TOTAL</td>
              {MONTHS.map(m => {
                const colTotal = productCodes.reduce((s,c)=>s+getVal(c,m),0);
                return <td key={m} style={{ padding:"10px", textAlign:"right", fontWeight:"700" }}>{editMode==="units"?fmtN(colTotal):fmtK(colTotal)}</td>;
              })}
              <td style={{ padding:"10px 14px", textAlign:"right", fontWeight:"800", color:"#0ea5e9", background:"#eef2ff" }}>
                {editMode==="units"
                  ? fmtN(productCodes.reduce((s,c)=>s+MONTHS.reduce((ss,m)=>ss+getVal(c,m),0),0))
                  : fmtK(productCodes.reduce((s,c)=>s+MONTHS.reduce((ss,m)=>ss+getVal(c,m),0),0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PAYMENTS EDITOR
// ─────────────────────────────────────────────────────────────
function PaymentsEditor({ rawPayments, onPaymentsChange, toast }) {
  const [editCell, setEditCell] = useState(null);
  const [editVal,  setEditVal]  = useState("");

  const handleSave = async () => {
    if (!editCell) return;
    const [month, field] = editCell.split("|||");
    const val = parseFloat(editVal) || 0;
    const existing = rawPayments.find(p=>p.month===month) || { month };
    const updated = { ...existing, [field]: Math.round(val), updated_at: new Date().toISOString() };

    toast("Saving…","saving");
    try {
      await sbUpsert("eg_payments", updated);
      onPaymentsChange(prev => prev.map(p => p.month===month ? { ...p, ...updated } : p));
      toast("Saved ✓","success");
    } catch(e) { toast("Save failed: "+e.message,"error"); }
    setEditCell(null);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"20px" }}>
      <h3 style={{ fontSize:"15px", fontWeight:"700", color:"#0f172a", margin:0 }}>Monthly Payments & Opening Balance</h3>
      <div style={{ ...card, padding:"0", overflow:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"13px" }}>
          <thead>
            <tr style={{ background:"#f8fafc", borderBottom:"2px solid #e2e8f0" }}>
              {["Month","Opening Balance","Payments (Costs)","Est. Net Revenue","Est. Closing Balance"].map(h=>(
                <th key={h} style={{ padding:"12px 20px", textAlign:h==="Month"?"left":"right", color:"#64748b", fontWeight:"700" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MONTHS.map(month => {
              const p = rawPayments.find(x=>x.month===month) || { month, payments:0, opening_balance:0 };
              const fields = ["opening_balance","payments"];
              return (
                <tr key={month} style={{ borderBottom:"1px solid #f1f5f9" }}>
                  <td style={{ padding:"10px 20px", fontWeight:"600", color:"#0f172a" }}>{month}</td>
                  {fields.map(field => {
                    const key = `${month}|||${field}`;
                    const isEditing = editCell===key;
                    return (
                      <td key={field} style={{ padding:"6px 16px", textAlign:"right" }} onClick={()=>{ if(!isEditing){setEditCell(key);setEditVal(String(p[field]||0));} }}>
                        {isEditing
                          ? <input autoFocus value={editVal} onChange={e=>setEditVal(e.target.value)}
                              onBlur={handleSave} onKeyDown={e=>{if(e.key==="Enter")handleSave();if(e.key==="Escape")setEditCell(null);}}
                              style={{ width:"130px", padding:"6px 10px", border:"2px solid #0ea5e9", borderRadius:"6px", fontSize:"13px", textAlign:"right" }} />
                          : <div style={{ padding:"6px 10px", borderRadius:"6px", cursor:"pointer" }}
                              onMouseEnter={e=>e.currentTarget.style.background="#f0f9ff"}
                              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                              {fmt(p[field]||0)}
                            </div>
                        }
                      </td>
                    );
                  })}
                  <td style={{ padding:"10px 20px", textAlign:"right", color:"#64748b" }}>—</td>
                  <td style={{ padding:"10px 20px", textAlign:"right", color:"#64748b" }}>—</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize:"12px", color:"#94a3b8", margin:0 }}>💡 Est. Net Revenue and Closing Balance are calculated live from your unit data in the Overview dashboard.</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// STAFF PLANNER
// ─────────────────────────────────────────────────────────────

function StaffPlanner({ staffPlan, onStaffChange, toast }) {
  const [region,     setRegion]     = useState("NSW");
  const [roleId,     setRoleId]     = useState("trainer");
  const [count,      setCount]      = useState(1);
  const [startMonth, setStartMonth] = useState("Jan-25");

  const addHire = async () => {
    const payload = { region, role_id: roleId, count, start_month: startMonth };
    toast("Saving…", "saving");
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/eg_staff_plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON,
          "Authorization": `Bearer ${SUPABASE_ANON}`,
          "Prefer": "return=representation",
        },
        body: JSON.stringify(payload),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(`${r.status}: ${JSON.stringify(body)}`);
      const savedRow = Array.isArray(body) ? body[0] : body;
      if (!savedRow?.id) throw new Error("No id returned — check RLS policies allow INSERT");
      onStaffChange(prev => [...prev, savedRow]);
      toast("Hire added ✓", "success");
    } catch(e) { toast("Save failed: " + e.message, "error"); }
  };

  const removeHire = async (id) => {
    toast("Removing…", "saving");
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/eg_staff_plan?id=eq.${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON,
          "Authorization": `Bearer ${SUPABASE_ANON}`,
        },
      });
      if (!r.ok) {
        const body = await r.text();
        throw new Error(`${r.status}: ${body}`);
      }
      onStaffChange(prev => prev.filter(e => e.id !== id));
      toast("Removed ✓", "success");
    } catch(e) { toast("Remove failed: " + e.message, "error"); }
  };

  const chartData = useMemo(() => MONTHS.map(m => {
    let cost=0, headcount=0;
    staffPlan.forEach(e => {
      if (MONTHS.indexOf(m) >= MONTHS.indexOf(e.start_month)) { cost+=getMonthlyCost(e.role_id)*e.count; headcount+=e.count; }
    });
    return { month:m.slice(0,3), staffCost:Math.round(cost), headcount };
  }), [staffPlan]);

  const totalAnnual = staffPlan.reduce((s,e)=>s+getMonthlyCost(e.role_id)*e.count*12,0);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"24px" }}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"24px" }}>
        <div style={card}>
          <h3 style={{ fontSize:"14px", fontWeight:"700", color:"#0f172a", margin:"0 0 20px" }}>Add Hire Event</h3>
          <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
            {[
              { label:"Region",      el:<select value={region}     onChange={e=>setRegion(e.target.value)}     style={selSt}>{REGIONS.map(r=><option key={r}>{r}</option>)}</select> },
              { label:"Role",        el:<select value={roleId}     onChange={e=>setRoleId(e.target.value)}     style={selSt}>{STAFF_ROLES.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}</select> },
              { label:"Count",       el:<input type="number" min={1} value={count} onChange={e=>setCount(parseInt(e.target.value)||1)} style={{ ...inpSt, width:"80px", textAlign:"right" }} /> },
              { label:"Start Month", el:<select value={startMonth} onChange={e=>setStartMonth(e.target.value)} style={selSt}>{MONTHS.map(m=><option key={m}>{m}</option>)}</select> },
            ].map(({label,el})=>(
              <div key={label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <label style={{ fontSize:"13px", color:"#64748b", fontWeight:"600" }}>{label}</label>
                {el}
              </div>
            ))}
            <button onClick={addHire} style={{ marginTop:"8px", background:"#0ea5e9", border:"none", borderRadius:"8px", padding:"10px 16px", color:"white", fontSize:"13px", fontWeight:"600", cursor:"pointer" }}>
              + Add to Plan
            </button>
          </div>
        </div>

        <div style={card}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px" }}>
            <h3 style={{ fontSize:"14px", fontWeight:"700", color:"#0f172a", margin:0 }}>Hiring Plan</h3>
            <span style={{ fontSize:"12px", color:"#64748b" }}>Annual cost: <strong style={{ color:"#0f172a" }}>{fmtK(totalAnnual)}</strong></span>
          </div>
          {staffPlan.length === 0
            ? <div style={{ color:"#94a3b8", fontSize:"13px", textAlign:"center", padding:"32px" }}>No hiring events yet.</div>
            : <div style={{ display:"flex", flexDirection:"column", gap:"8px", maxHeight:"280px", overflowY:"auto" }}>
                {staffPlan.map(e => {
                  const role = STAFF_ROLES.find(r=>r.id===e.role_id);
                  return (
                    <div key={e.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", background:"#f8fafc", borderRadius:"8px" }}>
                      <div>
                        <div style={{ fontSize:"13px", fontWeight:"600", color:"#0f172a" }}>{e.count}× {role?.label}</div>
                        <div style={{ fontSize:"11px", color:"#64748b" }}>{e.region} · from {e.start_month}</div>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                        <span style={{ fontSize:"12px", fontWeight:"600", color:"#8b5cf6" }}>{fmtK(getMonthlyCost(e.role_id)*e.count)}/mo</span>
                        <button onClick={()=>removeHire(e.id)} style={{ background:"#fee2e2", border:"none", borderRadius:"6px", padding:"4px 10px", color:"#ef4444", cursor:"pointer", fontSize:"12px" }}>✕</button>
                      </div>
                    </div>
                  );
                })}
              </div>
          }
        </div>
      </div>

      <div style={card}>
        <h3 style={{ fontSize:"14px", fontWeight:"700", color:"#0f172a", margin:"0 0 16px" }}>Staff Cost Projection</h3>
        <ResponsiveContainer width="100%" height={250}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{fontSize:11}} />
            <YAxis yAxisId="l" tickFormatter={v=>`$${(v/1000).toFixed(0)}K`} tick={{fontSize:11}} />
            <YAxis yAxisId="r" orientation="right" tick={{fontSize:11}} />
            <Tooltip formatter={(v,n)=>n==="headcount"?[v,"Headcount"]:[fmtK(v),"Staff Cost"]} />
            <Legend />
            <Bar yAxisId="l" dataKey="staffCost" fill="#8b5cf6" opacity={0.8} name="Staff Cost" />
            <Line yAxisId="r" type="monotone" dataKey="headcount" stroke="#f97316" strokeWidth={2} name="Headcount" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AI SCENARIO BUILDER
// ─────────────────────────────────────────────────────────────
function ScenarioBuilder({ calc, savedScenarios, onScenarioSave, toast }) {
  const [prompt,  setPrompt]  = useState("");
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [tab,     setTab]     = useState("new"); // "new" | "saved"
  const [error,   setError]   = useState("");

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const summary = { grandRevenue:calc.grandRev, grandUnits:calc.grandUnits, regions:calc.regions.map(r=>({region:r.region,revenue:r.totalRevenue,units:r.totalUnits,budget:r.totalBudget})), cashPosition:calc.ops[calc.ops.length-1]?.closingBalance||0 };
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514", max_tokens:1000,
          system:`You are a financial modelling expert for an Australian RTO. Given the user's scenario, return ONLY valid JSON (no markdown):
{"summary":"2-3 sentence impact summary","adjustments":[{"description":"...","type":"PERCENTAGE|FIXED_AMOUNT","target":"REVENUE|EXPENSES","value":number,"region":"NSW|VIC|QLD|WA|SA|All"}],"impactRevenue":number,"impactExpenses":number,"impactCashflow":number,"riskLevel":"LOW|MEDIUM|HIGH"}`,
          messages:[{ role:"user", content:`Data: ${JSON.stringify(summary)}\n\nScenario: ${prompt}` }]
        })
      });
      const data = await response.json();
      const text = (data.content||[]).map(c=>c.text||"").join("").replace(/```json|```/g,"").trim();
      setResult(JSON.parse(text));
    } catch(e) { setError("Failed to generate — check network or try again."); }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!result) return;
    const row = { name: prompt.slice(0,60), prompt, result, created_by:"user" };
    toast("Saving scenario…","saving");
    try {
      const saved = await sbUpsert("eg_scenarios", row);
      onScenarioSave(prev => [...prev, ...(saved||[])]);
      toast("Scenario saved ✓","success");
    } catch(e) { toast("Save failed: "+e.message,"error"); }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"24px" }}>
      <div style={{ display:"flex", gap:"4px", background:"#f1f5f9", borderRadius:"10px", padding:"4px", width:"fit-content" }}>
        {[["new","✨ New Scenario"],["saved","📁 Saved Scenarios"]].map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} style={{ padding:"8px 18px", borderRadius:"8px", border:"none", cursor:"pointer", fontSize:"13px", fontWeight:"600", background:tab===t?"white":"transparent", color:tab===t?"#8b5cf6":"#64748b", boxShadow:tab===t?"0 1px 4px rgba(0,0,0,0.1)":"none" }}>{l}</button>
        ))}
      </div>

      {tab === "new" && (
        <>
          <div style={card}>
            <h3 style={{ fontSize:"15px", fontWeight:"700", color:"#0f172a", margin:"0 0 8px" }}>✨ AI Scenario Builder</h3>
            <p style={{ fontSize:"13px", color:"#64748b", margin:"0 0 16px" }}>Ask "what if" questions to model financial impacts on your live data.</p>
            <div style={{ display:"flex", gap:"12px" }}>
              <input value={prompt} onChange={e=>setPrompt(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleGenerate()}
                placeholder="e.g. What if QLD enrolments drop 20% from Jan-26?"
                style={{ flex:1, padding:"12px 16px", border:"1px solid #e2e8f0", borderRadius:"10px", fontSize:"14px", outline:"none" }} />
              <button onClick={handleGenerate} disabled={loading} style={{ background:loading?"#8b5cf650":"#8b5cf6", border:"none", borderRadius:"10px", padding:"12px 20px", color:"white", fontSize:"14px", fontWeight:"600", cursor:loading?"not-allowed":"pointer", whiteSpace:"nowrap" }}>
                {loading?"Analysing…":"Simulate →"}
              </button>
            </div>
            {error && <div style={{ marginTop:"12px", color:"#ef4444", fontSize:"13px" }}>{error}</div>}
          </div>

          {result && (
            <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ display:"flex", gap:"12px" }}>
                  {[{label:"Revenue Impact",val:result.impactRevenue,icon:"💰"},{label:"Expense Impact",val:result.impactExpenses,icon:"💸"},{label:"Cashflow Impact",val:result.impactCashflow,icon:"🏦"}].map(({label,val,icon})=>(
                    <StatCard key={label} label={label} value={fmtK(Math.abs(val))} sub={val>=0?"▲ Positive":"▼ Negative"} color={val>=0?"green":"red"} icon={icon} trend={val>=0?"up":"down"} />
                  ))}
                </div>
                <button onClick={handleSave} style={{ background:"#0ea5e9", border:"none", borderRadius:"8px", padding:"10px 18px", color:"white", fontSize:"13px", fontWeight:"600", cursor:"pointer", height:"fit-content" }}>
                  💾 Save Scenario
                </button>
              </div>

              <div style={card}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px" }}>
                  <h3 style={{ fontSize:"14px", fontWeight:"700", color:"#0f172a", margin:0 }}>Analysis</h3>
                  <span style={{ padding:"4px 14px", borderRadius:"20px", fontSize:"12px", fontWeight:"700", background:result.riskLevel==="HIGH"?"#fee2e2":result.riskLevel==="MEDIUM"?"#fef3c7":"#dcfce7", color:result.riskLevel==="HIGH"?"#ef4444":result.riskLevel==="MEDIUM"?"#d97706":"#16a34a" }}>
                    {result.riskLevel} RISK
                  </span>
                </div>
                <p style={{ fontSize:"14px", color:"#374151", lineHeight:"1.7", margin:"0 0 16px" }}>{result.summary}</p>
                <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                  {(result.adjustments||[]).map((adj,i)=>(
                    <div key={i} style={{ display:"flex", gap:"12px", alignItems:"center", padding:"10px 14px", background:"#f8fafc", borderRadius:"8px" }}>
                      <span style={{ width:"8px", height:"8px", borderRadius:"50%", background:adj.target==="REVENUE"?"#0ea5e9":"#f97316", flexShrink:0 }} />
                      <span style={{ flex:1, fontSize:"13px", color:"#374151" }}>{adj.description}</span>
                      <span style={{ fontSize:"12px", fontWeight:"600", color:adj.target==="REVENUE"?"#0ea5e9":"#f97316", background:adj.target==="REVENUE"?"#e0f2fe":"#fff7ed", padding:"3px 10px", borderRadius:"20px" }}>
                        {adj.type==="PERCENTAGE"?`${adj.value}%`:fmtK(adj.value)} · {adj.region||"All"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {tab === "saved" && (
        <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
          {savedScenarios.length===0
            ? <div style={{ ...card, textAlign:"center", color:"#94a3b8", padding:"48px" }}>No saved scenarios yet. Run a simulation and click Save.</div>
            : savedScenarios.map(s=>(
                <div key={s.id} style={{ ...card, cursor:"pointer" }} onClick={()=>{ setPrompt(s.prompt); setResult(s.result); setTab("new"); }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                    <div>
                      <div style={{ fontWeight:"700", color:"#0f172a", marginBottom:"4px" }}>{s.name}</div>
                      <div style={{ fontSize:"12px", color:"#64748b" }}>{new Date(s.created_at).toLocaleDateString("en-AU")}</div>
                    </div>
                    <span style={{ padding:"4px 12px", borderRadius:"20px", fontSize:"11px", fontWeight:"700", background:s.result?.riskLevel==="HIGH"?"#fee2e2":s.result?.riskLevel==="MEDIUM"?"#fef3c7":"#dcfce7", color:s.result?.riskLevel==="HIGH"?"#ef4444":s.result?.riskLevel==="MEDIUM"?"#d97706":"#16a34a" }}>
                      {s.result?.riskLevel||"—"}
                    </span>
                  </div>
                  <p style={{ fontSize:"13px", color:"#64748b", margin:"8px 0 0", lineHeight:"1.5" }}>{s.result?.summary?.slice(0,150)}…</p>
                </div>
              ))
          }
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// RAW DATA TABLE
// ─────────────────────────────────────────────────────────────
function RawDataTable({ calc, yearBasis, selectedYear }) {
  const [region, setRegion] = useState("All");
  const rows = useMemo(() =>
    calc.ops.filter(o=>inPeriod(o.month,yearBasis,selectedYear)).map(o => {
      const r = { month:o.month, revenue:o.revenue, payments:o.payments, netCashflow:o.netCashflow, openingBalance:o.openingBalance, closingBalance:o.closingBalance };
      calc.regions.forEach(reg => {
        if (region==="All"||region===reg.region) { const md=reg.monthlyData.find(m=>m.month===o.month); r[`${reg.region}_rev`]=md?.revenue||0; r[`${reg.region}_units`]=md?.units||0; }
      });
      return r;
    }), [calc, yearBasis, selectedYear, region]);

  const displayRegions = region==="All" ? REGIONS : [region];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"20px" }}>
      <select value={region} onChange={e=>setRegion(e.target.value)} style={selSt}>
        <option value="All">All Regions</option>
        {REGIONS.map(r=><option key={r}>{r}</option>)}
      </select>
      <div style={{ ...card, padding:"0", overflow:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"12px" }}>
          <thead>
            <tr style={{ background:"#f8fafc", borderBottom:"2px solid #e2e8f0" }}>
              {["Month","Revenue","Payments","Net CF","Opening","Closing",...displayRegions.flatMap(r=>[`${r} Rev`,`${r} Units`])].map(h=>(
                <th key={h} style={{ padding:"10px 14px", textAlign:h==="Month"?"left":"right", color:"#64748b", fontWeight:"700", whiteSpace:"nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row,i)=>(
              <tr key={row.month} style={{ borderBottom:"1px solid #f1f5f9", background:i%2===0?"white":"#fafbfc" }}>
                <td style={{ padding:"10px 14px", fontWeight:"600", color:"#0f172a" }}>{row.month}</td>
                {[row.revenue,row.payments,row.netCashflow,row.openingBalance,row.closingBalance].map((v,j)=>(
                  <td key={j} style={{ padding:"10px 14px", textAlign:"right", color:j===2?(v>=0?"#22c55e":"#ef4444"):"#374151" }}>{fmtK(v)}</td>
                ))}
                {displayRegions.flatMap(r=>[
                  <td key={`${r}_r`} style={{ padding:"10px 14px", textAlign:"right" }}>{fmtK(row[`${r}_rev`]||0)}</td>,
                  <td key={`${r}_u`} style={{ padding:"10px 14px", textAlign:"right" }}>{fmtN(row[`${r}_units`]||0)}</td>,
                ])}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// LOADING SCREEN
// ─────────────────────────────────────────────────────────────
function LoadingScreen({ message }) {
  return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:"#f8fafc", gap:"16px" }}>
      <div style={{ width:"48px", height:"48px", border:"4px solid #e2e8f0", borderTopColor:"#0ea5e9", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
      <p style={{ color:"#64748b", fontSize:"14px", fontFamily:"sans-serif" }}>{message}</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────
export default function App() {
  const [user,       setUser]       = useState(null);
  const [rawUnits,   setRawUnits]   = useState([]);
  const [rawPayments,setRawPayments]= useState([]);
  const [staffPlan,  setStaffPlan]  = useState([]);
  const [scenarios,  setScenarios]  = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [initDone,   setInitDone]   = useState(false);
  const [activeTab,  setActiveTab]  = useState("dashboard");
  const [yearBasis,  setYearBasis]  = useState("financial");
  const [selectedYear,setSelectedYear] = useState("All");
  const [sidebarOpen,setSidebarOpen] = useState(true);
  const [toastMsg,   setToastMsg]   = useState("");
  const [toastType,  setToastType]  = useState("success");
  const toastTimer = useRef(null);

  const toast = (msg, type="success") => {
    setToastMsg(msg); setToastType(type);
    clearTimeout(toastTimer.current);
    if (type !== "saving") toastTimer.current = setTimeout(()=>setToastMsg(""), 3000);
  };

  // Restore session
  useEffect(() => {
    const s = sessionStorage.getItem("eg_user");
    if (s) { try { setUser(JSON.parse(s)); } catch(e){} }
    setInitDone(true);
  }, []);

  // Load data after login
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const [units, payments, staff, scens] = await Promise.all([
          sbSelect("eg_units", "select=*&order=region,code,month"),
          sbSelect("eg_payments", "select=*&order=month"),
          sbSelect("eg_staff_plan", "select=*"),
          sbSelect("eg_scenarios", "select=*&order=created_at.desc"),
        ]);

        // Seed if empty
        if (units.length === 0) {
          toast("First run — seeding data…","saving");
          const seedU = seedUnits();
          const seedP = seedPayments();
          // batch upsert in chunks
          for (let i=0; i<seedU.length; i+=200) await sbUpsert("eg_units", seedU.slice(i,i+200));
          for (const p of seedP) await sbUpsert("eg_payments", p);
          setRawUnits(seedU);
          setRawPayments(seedP);
          toast("Data seeded ✓","success");
        } else {
          setRawUnits(units);
          setRawPayments(payments);
        }
        setStaffPlan(staff);
        setScenarios(scens);
      } catch(e) {
        toast("Failed to load data: " + e.message, "error");
      }
      setLoading(false);
    })();
  }, [user]);

  const handleLogin = u => { sessionStorage.setItem("eg_user", JSON.stringify(u)); setUser(u); };
  const handleLogout = () => { sessionStorage.removeItem("eg_user"); setUser(null); setRawUnits([]); setRawPayments([]); };

  if (!initDone) return null;
  if (!user)     return <LoginScreen onLogin={handleLogin} />;
  if (loading)   return <LoadingScreen message="Loading your data from Supabase…" />;

  const calc = recalculate(rawUnits, rawPayments, staffPlan);
  const availableYears = [...new Set(MONTHS.map(m=>{ const d=parseMonthDate(m); return yearBasis==="financial"?getFY(d):getCY(d); }))].sort();

  const tabs = [
    { id:"dashboard", icon:"📊", label:"Overview",        group:"Analytics" },
    { id:"regions",   icon:"🗺️", label:"Regional",        group:"Analytics" },
    { id:"data",      icon:"📋", label:"Raw Data",         group:"Analytics" },
    { id:"budget",    icon:"✏️", label:"Budget Editor",    group:"Planning"  },
    { id:"payments",  icon:"💳", label:"Payments",         group:"Planning"  },
    { id:"staff",     icon:"👥", label:"Staff Planner",    group:"Planning"  },
    { id:"scenario",  icon:"✨", label:"AI Scenarios",     group:"Planning"  },
  ];
  const groups = ["Analytics","Planning"];

  return (
    <div style={{ display:"flex", height:"100vh", background:"#f8fafc", fontFamily:"system-ui,sans-serif", overflow:"hidden" }}>
      {/* ── Sidebar ── */}
      <aside style={{ width:sidebarOpen?"240px":"64px", background:"#0f172a", display:"flex", flexDirection:"column", transition:"width 0.25s ease", overflow:"hidden", flexShrink:0 }}>
        <div style={{ padding:sidebarOpen?"20px 20px 16px":"18px 14px", borderBottom:"1px solid rgba(255,255,255,0.08)", display:"flex", alignItems:"center", gap:"10px" }}>
          <div style={{ width:"36px", height:"36px", flexShrink:0, background:"linear-gradient(135deg,#0ea5e9,#0284c7)", borderRadius:"10px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"18px" }}>📊</div>
          {sidebarOpen && <div><div style={{ color:"white", fontWeight:"800", fontSize:"15px" }}>EduGrowth</div><div style={{ color:"#475569", fontSize:"11px" }}>BI Platform</div></div>}
        </div>

        <nav style={{ flex:1, padding:"10px 8px", overflowY:"auto" }}>
          {groups.map(group => (
            <div key={group} style={{ marginBottom:"6px" }}>
              {sidebarOpen && <div style={{ fontSize:"10px", fontWeight:"700", color:"#475569", textTransform:"uppercase", letterSpacing:"0.8px", padding:"8px 12px 4px" }}>{group}</div>}
              {tabs.filter(t=>t.group===group).map(tab => {
                const active = activeTab===tab.id;
                const c = TAB_COLORS[tab.id];
                return (
                  <button key={tab.id} onClick={()=>setActiveTab(tab.id)} title={tab.label}
                    style={{ width:"100%", display:"flex", alignItems:"center", gap:"10px", padding:sidebarOpen?"10px 12px":"10px", borderRadius:"8px", border:"none", cursor:"pointer", marginBottom:"2px", background:active?`${c}22`:"transparent", color:active?c:"#64748b", justifyContent:sidebarOpen?"flex-start":"center", transition:"all 0.15s" }}>
                    <span style={{ fontSize:"17px", flexShrink:0 }}>{tab.icon}</span>
                    {sidebarOpen && <span style={{ fontSize:"13px", fontWeight:active?"700":"500", whiteSpace:"nowrap" }}>{tab.label}</span>}
                    {active && sidebarOpen && <span style={{ marginLeft:"auto", width:"6px", height:"6px", borderRadius:"50%", background:c }} />}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div style={{ padding:"10px 8px", borderTop:"1px solid rgba(255,255,255,0.08)" }}>
          {sidebarOpen && (
            <div style={{ padding:"10px 12px", background:"rgba(14,165,233,0.08)", borderRadius:"8px", marginBottom:"8px", border:"1px solid rgba(14,165,233,0.15)" }}>
              <div style={{ fontSize:"10px", color:"#64748b", fontWeight:"700", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:"4px" }}>Database</div>
              <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                <span style={{ width:"6px", height:"6px", borderRadius:"50%", background:"#22c55e", display:"inline-block" }} />
                <span style={{ fontSize:"11px", color:"#94a3b8" }}>Supabase · live</span>
              </div>
            </div>
          )}
          <button onClick={()=>setSidebarOpen(s=>!s)} style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:sidebarOpen?"space-between":"center", padding:"8px 12px", borderRadius:"8px", border:"none", cursor:"pointer", background:"rgba(255,255,255,0.05)", color:"#64748b" }}>
            {sidebarOpen && <span style={{ fontSize:"12px" }}>Collapse</span>}
            <span style={{ fontSize:"14px" }}>{sidebarOpen?"◀":"▶"}</span>
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        {/* Header */}
        <header style={{ height:"56px", background:"white", borderBottom:"1px solid #e2e8f0", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 24px", flexShrink:0, boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
          <h2 style={{ fontSize:"15px", fontWeight:"700", color:"#0f172a", margin:0 }}>
            {tabs.find(t=>t.id===activeTab)?.icon} {tabs.find(t=>t.id===activeTab)?.label}
          </h2>

          <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
            {["dashboard","regions","data"].includes(activeTab) && (<>
              <div style={{ display:"flex", background:"#f1f5f9", borderRadius:"8px", padding:"3px" }}>
                {["financial","calendar"].map(basis=>(
                  <button key={basis} onClick={()=>{ setYearBasis(basis); setSelectedYear(basis==="financial"?"FY25":"2025"); }} style={{ padding:"5px 12px", borderRadius:"6px", border:"none", cursor:"pointer", fontSize:"12px", fontWeight:"600", background:yearBasis===basis?"white":"transparent", color:yearBasis===basis?"#0ea5e9":"#64748b", boxShadow:yearBasis===basis?"0 1px 3px rgba(0,0,0,0.1)":"none" }}>
                    {basis==="financial"?"FY":"CY"}
                  </button>
                ))}
              </div>
              <select value={selectedYear} onChange={e=>setSelectedYear(e.target.value)} style={{ ...selSt, minWidth:"100px" }}>
                <option value="All">All Periods</option>
                {availableYears.map(y=><option key={y}>{y}</option>)}
              </select>
            </>)}

            <div style={{ display:"flex", alignItems:"center", gap:"8px", padding:"5px 12px", background:"#f8fafc", borderRadius:"8px", border:"1px solid #e2e8f0" }}>
              <div style={{ width:"28px", height:"28px", background:"linear-gradient(135deg,#0ea5e9,#0284c7)", borderRadius:"8px", display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:"12px", fontWeight:"700" }}>
                {user.name.slice(0,2).toUpperCase()}
              </div>
              <div style={{ fontSize:"12px" }}>
                <div style={{ fontWeight:"600", color:"#0f172a", lineHeight:"1.2" }}>{user.name}</div>
                <div style={{ color:"#64748b", textTransform:"capitalize", fontSize:"11px" }}>{user.role}</div>
              </div>
              <button onClick={handleLogout} style={{ marginLeft:"4px", background:"none", border:"1px solid #e2e8f0", borderRadius:"6px", padding:"3px 10px", fontSize:"11px", color:"#64748b", cursor:"pointer" }}>Logout</button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main style={{ flex:1, overflowY:"auto", padding:"24px" }}>
          {activeTab==="dashboard" && <DashboardOverview calc={calc} yearBasis={yearBasis} selectedYear={selectedYear} />}
          {activeTab==="regions"   && <RegionalAnalysis  calc={calc} yearBasis={yearBasis} selectedYear={selectedYear} />}
          {activeTab==="data"      && <RawDataTable       calc={calc} yearBasis={yearBasis} selectedYear={selectedYear} />}
          {activeTab==="budget"    && <BudgetEditor   rawUnits={rawUnits}     onUnitsChange={setRawUnits}     toast={toast} />}
          {activeTab==="payments"  && <PaymentsEditor rawPayments={rawPayments} onPaymentsChange={setRawPayments} toast={toast} />}
          {activeTab==="staff"     && <StaffPlanner   staffPlan={staffPlan}   onStaffChange={setStaffPlan}    toast={toast} />}
          {activeTab==="scenario"  && <ScenarioBuilder calc={calc} savedScenarios={scenarios} onScenarioSave={setScenarios} toast={toast} />}
        </main>
      </div>

      <Toast message={toastMsg} type={toastType} />
    </div>
  );
}
