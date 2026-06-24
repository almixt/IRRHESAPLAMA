import React, { useState, useMemo, useEffect, useRef } from "react";

/* ============================================================
   IRR Hesaplama — Kredi / Fon Nakit Akışı
   ============================================================ */

const MS = 86400000;

function xirr(cashflows, dates) {
  if (cashflows.length < 2) return NaN;
  const d0 = dates[0];
  const yrs = dates.map((d) => (d - d0) / MS / 365);
  const npv = (r) =>
    cashflows.reduce((s, c, i) => s + c / Math.pow(1 + r, yrs[i]), 0);
  const dnpv = (r) =>
    cashflows.reduce(
      (s, c, i) => s - (yrs[i] * c) / Math.pow(1 + r, yrs[i] + 1),
      0
    );

  // Newton-Raphson
  let r = 0.1;
  for (let k = 0; k < 100; k++) {
    const f = npv(r);
    const df = dnpv(r);
    if (Math.abs(df) < 1e-12) break;
    let rn = r - f / df;
    if (!isFinite(rn)) break;
    if (rn <= -0.9999) rn = -0.99;
    if (Math.abs(rn - r) < 1e-10) {
      r = rn;
      break;
    }
    r = rn;
  }
  // Bisection fallback
  if (!(Math.abs(npv(r)) < 1)) {
    let lo = -0.9999,
      hi = 10,
      flo = npv(lo),
      fhi = npv(hi);
    if (flo * fhi < 0) {
      for (let k = 0; k < 300; k++) {
        const mid = (lo + hi) / 2;
        const fm = npv(mid);
        if (flo * fm <= 0) {
          hi = mid;
          fhi = fm;
        } else {
          lo = mid;
          flo = fm;
        }
      }
      r = (lo + hi) / 2;
    }
  }
  return r;
}

const num = (v) => {
  const n = parseFloat(String(v).replace(/\s/g, "").replace(",", "."));
  return isFinite(n) ? n : 0;
};
const tl = (x, dec = 0) =>
  !isFinite(x)
    ? "—"
    : x.toLocaleString("tr-TR", {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec,
      });
const pct = (x, dec = 3) =>
  !isFinite(x)
    ? "—"
    : "%" +
      (x * 100).toLocaleString("tr-TR", {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec,
      });

// Group an integer-like value with Turkish thousands separators (dots):
// "2000000" -> "2.000.000". Empty stays empty.
const groupTr = (v) => {
  const d = String(v).replace(/[^\d]/g, "");
  return d === ""
    ? ""
    : Number(d).toLocaleString("tr-TR", {
        maximumFractionDigits: 0,
      });
};

// --- Turkish date format (GG.AA.YYYY) <-> ISO (YYYY-MM-DD) ---
// Dates are entered and shown day.month.year (Turkish standard) but stored
// internally as ISO so the period math stays unambiguous.
const pad2 = (x) => String(x).padStart(2, "0");

function isoToTr(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso || "";
}

function trToIso(s) {
  // accepts 15.07.2026, 15/07/2026, 15-07-2026
  const m = /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/.exec(String(s).trim());
  if (!m) return null;
  const d = +m[1],
    mo = +m[2],
    y = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d)
    return null; // rejects e.g. 31.02
  return `${y}-${pad2(mo)}-${pad2(d)}`;
}

function DateCell({ value, onChange }) {
  const [text, setText] = useState(isoToTr(value));
  const [focused, setFocused] = useState(false);
  const nativeRef = useRef(null);

  // resync when value changes from outside (e.g. reset) while not editing
  useEffect(() => {
    if (!focused) setText(isoToTr(value));
  }, [value, focused]);

  // open the browser's native calendar on the hidden date input
  const openPicker = () => {
    const el = nativeRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") {
      try {
        el.showPicker();
        return;
      } catch (e) {
        /* fall through */
      }
    }
    el.focus();
    el.click();
  };

  return (
    <div className="datewrap">
      <input
        className="datein"
        value={text}
        placeholder="GG.AA.YYYY"
        inputMode="numeric"
        onFocus={() => setFocused(true)}
        onChange={(e) => {
          setText(e.target.value);
          const iso = trToIso(e.target.value);
          if (iso) onChange(iso);
        }}
        onBlur={(e) => {
          setFocused(false);
          const iso = trToIso(e.target.value);
          if (iso) {
            onChange(iso);
            setText(isoToTr(iso));
          } else {
            setText(isoToTr(value)); // revert to last valid
          }
        }}
      />
      <button
        type="button"
        className="calbtn"
        tabIndex={-1}
        title="Takvimden seç"
        onClick={openPicker}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>
      <input
        ref={nativeRef}
        type="date"
        className="dnative"
        value={value || ""}
        tabIndex={-1}
        onChange={(e) => {
          if (e.target.value) onChange(e.target.value);
        }}
      />
    </div>
  );
}

// Numeric input that shows thousands-grouped digits (2.000.000) while storing
// the raw digit string. Caret position is preserved across reformatting.
function NumberCell({ value, onChange, className }) {
  const display = groupTr(value);

  const handle = (e) => {
    const el = e.target;
    const raw = el.value;
    const caret = el.selectionStart == null ? raw.length : el.selectionStart;
    const digitsBeforeCaret = raw.slice(0, caret).replace(/[^\d]/g, "").length;
    const digits = raw.replace(/[^\d]/g, "");
    onChange(digits);

    // restore caret after the controlled re-render
    requestAnimationFrame(() => {
      const formatted = groupTr(digits);
      let pos = 0;
      let seen = 0;
      while (pos < formatted.length && seen < digitsBeforeCaret) {
        if (/\d/.test(formatted[pos])) seen++;
        pos++;
      }
      try {
        el.setSelectionRange(pos, pos);
      } catch (err) {
        /* ignore */
      }
    });
  };

  return (
    <input
      className={className}
      value={display}
      inputMode="numeric"
      onChange={handle}
    />
  );
}

const DEFAULT_ASSUMPTIONS = {
  annualRatePct: 15,
  mgmtFeePct: 2,
  bsmvPct: 5,
  monthlyFixed: 5000,
  setupCost: 10000,
  dayCount: 365,
};

const DEFAULT_ROWS = [
  {
    date: "2026-01-05",
    disbursement: "2000000",
    isCoupon: false,
    principal: "0",
  },
  {
    date: "2026-02-05",
    disbursement: "2000000",
    isCoupon: false,
    principal: "0",
  },
  {
    date: "2026-03-05",
    disbursement: "2000000",
    isCoupon: false,
    principal: "0",
  },
  // NB: 6th, not 5th — matches the Excel exactly (creates a 32-then-29 day split)
  {
    date: "2026-04-06",
    disbursement: "2000000",
    isCoupon: false,
    principal: "0",
  },
  {
    date: "2026-05-05",
    disbursement: "2000000",
    isCoupon: false,
    principal: "0",
  },
  { date: "2026-06-05", disbursement: "0", isCoupon: false, principal: "0" },
  { date: "2026-07-05", disbursement: "0", isCoupon: true, principal: "0" },
  { date: "2026-08-05", disbursement: "0", isCoupon: false, principal: "0" },
  { date: "2026-09-05", disbursement: "0", isCoupon: false, principal: "0" },
  { date: "2026-10-05", disbursement: "0", isCoupon: false, principal: "0" },
  { date: "2026-11-05", disbursement: "0", isCoupon: false, principal: "0" },
  { date: "2026-12-05", disbursement: "0", isCoupon: false, principal: "0" },
  {
    date: "2027-01-05",
    disbursement: "0",
    isCoupon: true,
    principal: "10000000",
  },
];

function compute(a, rows) {
  const n = rows.length;
  const annual = num(a.annualRatePct) / 100;
  const dayCount = num(a.dayCount) || 365;
  const daily = annual / dayCount;
  const mgmt = num(a.mgmtFeePct) / 100;
  const bsmv = num(a.bsmvPct) / 100;
  const monthlyMgmt = (mgmt * (1 + bsmv)) / 12;
  const monthlyFixed = num(a.monthlyFixed);
  const setup = num(a.setupCost);

  const dates = rows.map((r) => new Date(r.date + "T00:00:00"));
  const days = rows.map((r, i) =>
    i < n - 1 ? Math.round((dates[i + 1] - dates[i]) / MS) : 0
  );

  // Outstanding balance = -(cumulative disbursements)
  const bal = [];
  let cum = 0;
  for (let i = 0; i < n; i++) {
    cum += num(rows[i].disbursement);
    bal.push(-cum);
  }

  // Cumulative accrued interest (Dönem Faizi).
  // E_i = E_{i-1} + |balance_i| * days_i * daily — the running total of
  // interest accrued through the end of each period (= Excel col E).
  const E = [];
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += Math.abs(bal[i]) * days[i] * daily;
    E.push(acc);
  }

  // Coupons: at coupon rows (and always the final row) pay the interest
  // accrued THROUGH THIS ROW'S DATE — i.e. E_{i-1}, the cumulative accrual
  // up to (not including) this period — minus what has already been paid.
  // So a coupon checked on the 6-month row pays exactly 6 months of interest,
  // dated on that row. The final row is unaffected (its period is 0 days, so
  // E_{n-1} = E_{n-2}), and it always closes out the remaining interest.
  const coupon = new Array(n).fill(0);
  let paid = 0;
  for (let i = 0; i < n; i++) {
    const isLast = i === n - 1;
    if (rows[i].isCoupon || isLast) {
      const accruedThroughThisDate = i === 0 ? 0 : E[i - 1];
      const c = accruedThroughThisDate - paid;
      coupon[i] = c;
      paid += c;
    }
  }

  const principal = rows.map((r) => num(r.principal));
  const H = rows.map((r, i) => -num(r.disbursement) + coupon[i] + principal[i]); // Net NA Brüt
  const I = bal.map((b) => b * monthlyMgmt); // Yön. Ücreti
  const J = rows.map((r, i) =>
    i === 0 ? -(monthlyFixed + setup) : -monthlyFixed
  ); // Sabit Gider

  // Fund series over ALL rows (no folding). The final row carries only its
  // gross settlement (no mgmt fee / fixed expense), exactly like Excel where
  // I25 and J25 are blank. Net Fon IRR then runs over every row + its date.
  const K = rows.map((r, i) => (i === n - 1 ? H[i] : H[i] + I[i] + J[i]));

  const grossIRR = xirr(H, dates);
  const fundIRR = xirr(K, dates);
  const totalInterest = E[n - 1];
  let fees = 0;
  for (let i = 0; i < n - 1; i++) fees += I[i] + J[i];

  const dateOrderOk = days.slice(0, n - 1).every((d) => d > 0);

  return {
    daily,
    monthlyMgmt,
    days,
    bal,
    E,
    coupon,
    principal,
    H,
    I,
    J,
    K,
    grossIRR,
    fundIRR,
    totalInterest,
    fees,
    dateOrderOk,
    n,
  };
}

function Money({ v, dec = 0 }) {
  const cls = v < -0.5 ? "neg" : v > 0.5 ? "pos" : "zero";
  return (
    <span className={"mny " + cls}>
      {v < -0.5 ? "(" + tl(-v, dec) + ")" : tl(v, dec)}
    </span>
  );
}

export default function App() {
  const [a, setA] = useState(DEFAULT_ASSUMPTIONS);
  const [rows, setRows] = useState(DEFAULT_ROWS);

  const r = useMemo(() => compute(a, rows), [a, rows]);

  const setAssum = (k, v) => setA((p) => ({ ...p, [k]: v }));
  const setRow = (i, k, v) =>
    setRows((p) => p.map((row, idx) => (idx === i ? { ...row, [k]: v } : row)));

  const reset = () => {
    setA(DEFAULT_ASSUMPTIONS);
    setRows(DEFAULT_ROWS);
  };

  const n = rows.length;

  return (
    <div className="root">
      <style>{CSS}</style>

      <header className="hd">
        <div className="hd-titles">
          <h1>IRR Calculator Dashboard</h1>
        </div>
        <button className="ghost" onClick={reset}>
          Varsayılana sıfırla
        </button>
      </header>

      {/* ASSUMPTIONS */}
      <section className="panel">
        <div className="sec-label">
          <span className="sec-no">01</span> Veriler<em></em>
        </div>
        <div className="grid">
          <Field label="Yıllık faiz" hint="Annual rate" suffix="%">
            <input
              value={a.annualRatePct}
              onChange={(e) => setAssum("annualRatePct", e.target.value)}
              inputMode="decimal"
            />
          </Field>
          <Field
            label="Yönetim ücreti (yıllık)"
            hint="Mgmt fee (yearly)"
            suffix="%"
          >
            <input
              value={a.mgmtFeePct}
              onChange={(e) => setAssum("mgmtFeePct", e.target.value)}
              inputMode="decimal"
            />
          </Field>
          <Field
            label="BSMV"
            hint="Banking and Insurance Transactions Tax"
            suffix="%"
          >
            <input value={a.bsmvPct} disabled inputMode="decimal" />
          </Field>
          <Field
            label="Aylık sabit gider"
            hint="Monthly fixed expense"
            suffix="$"
          >
            <input
              value={a.monthlyFixed}
              onChange={(e) => setAssum("monthlyFixed", e.target.value)}
              inputMode="decimal"
            />
          </Field>
          <Field label="Kuruluş gideri" hint="İlk aya eklenir" suffix="$">
            <input
              value={a.setupCost}
              onChange={(e) => setAssum("setupCost", e.target.value)}
              inputMode="decimal"
            />
          </Field>
          <Field label="Gün sayacı" hint="Day count" suffix="gün">
            <input value={a.dayCount} disabled inputMode="numeric" />
          </Field>
        </div>
        <div className="derived">
          <span>
            <b>Günlük faiz</b> {pct(r.daily, 4)}
          </span>
          <span className="dot" />
          <span>
            <b>Aylık yönetim ücreti(+BSMV)</b> {pct(r.monthlyMgmt, 4)}
          </span>
        </div>
      </section>

      {/* SCHEDULE */}
      <section className="panel">
        <div className="sec-label">
          <span className="sec-no">02</span> Ödeme Takvimi
        </div>

        {!r.dateOrderOk && (
          <div className="warn">
            Tarihler artan sırada olmalı — bazı dönem gün sayıları sıfır veya
            negatif.
          </div>
        )}

        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th className="rownum"></th>
                <th className="edit">
                  Ödeme Takvimi<i>Payment Calendar</i>
                </th>
                <th className="edit num">
                  Ödeme Tutarı ($)<i>Payment Amount</i>
                </th>
                <th className="edit ctr">
                  Kupon<i>Coupon</i>
                </th>
                <th className="edit num">
                  Anapara ($)<i>Principal </i>
                </th>
                <th className="num">Bakiye ($)</th>
                <th className="num">Gün</th>
                <th className="num">Dönem Faizi ($)</th>
                <th className="num">Kupon ($)</th>
                <th className="num key">Net NA Brüt ($)</th>
                <th className="num">Yönetim Ücreti ($)</th>
                <th className="num">Sabit Gider ($)</th>
                <th className="num key">Net NA Fon ($)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const isLast = i === n - 1;
                return (
                  <tr key={i} className={isLast ? "settle" : ""}>
                    <td className="rownum">{i + 1}</td>
                    <td className="edit">
                      <DateCell
                        value={row.date}
                        onChange={(iso) => setRow(i, "date", iso)}
                      />
                    </td>
                    <td className="edit num">
                      <NumberCell
                        className="ri"
                        value={row.disbursement}
                        onChange={(v) => setRow(i, "disbursement", v)}
                      />
                    </td>
                    <td className="edit ctr">
                      <input
                        type="checkbox"
                        checked={row.isCoupon}
                        title="Bu tarihte birikmiş faiz ödenir"
                        onChange={(e) =>
                          setRow(i, "isCoupon", e.target.checked)
                        }
                      />
                    </td>
                    <td className="edit num">
                      <NumberCell
                        className="ri"
                        value={row.principal}
                        onChange={(v) => setRow(i, "principal", v)}
                      />
                    </td>
                    <td className="num">
                      <Money v={r.bal[i]} />
                    </td>
                    <td className="num gray">{r.days[i]}</td>
                    <td className="num">
                      <Money v={r.E[i]} />
                    </td>
                    <td className="num">
                      <Money v={r.coupon[i]} />
                    </td>
                    <td className="num key">
                      <Money v={r.H[i]} />
                    </td>
                    <td className="num">
                      {isLast ? (
                        <span className="dash">—</span>
                      ) : (
                        <Money v={r.I[i]} />
                      )}
                    </td>
                    <td className="num">
                      {isLast ? (
                        <span className="dash">—</span>
                      ) : (
                        <Money v={r.J[i]} />
                      )}
                    </td>
                    <td className="num key">
                      <Money v={r.K[i]} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td></td>
                <td colSpan={6} className="foot-l"></td>
                <td className="num"></td>
                <td colSpan={2} className="foot-l"></td>
                <td className="num" colSpan={3}></td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="fnote"></p>
      </section>

      {/* RESULT TAPE */}
      <div className="tape">
        <div className="tape-in">
          <div className="tape-lead"></div>
          <div className="results">
            <Result label="Brüt Kredi IRR" value={pct(r.grossIRR)} />
            <Result label="Net Fon IRR" value={pct(r.fundIRR)} primary />
            <Result
              label="Toplam Faiz"
              value={
                <>
                  <Money v={r.totalInterest} dec={0} /> $
                </>
              }
            />
            <Result
              label="Toplam Ücret"
              value={
                <>
                  <Money v={r.fees} dec={0} /> $
                </>
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, suffix, children }) {
  return (
    <label className="field">
      <span className="fl">
        {label}
        <i>{hint}</i>
      </span>
      <span className="fi">
        {children}
        {suffix && <em>{suffix}</em>}
      </span>
    </label>
  );
}

function Result({ label, sub, value, primary }) {
  return (
    <div className={"result" + (primary ? " primary" : "")}>
      <div className="r-label">{label}</div>
      <div className="r-value">{value}</div>
      <div className="r-sub" dangerouslySetInnerHTML={{ __html: sub }} />
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Spectral:wght@400;500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

:root{
  --paper:#F4F1E8; --surface:#FCFBF6; --line:#E0D9C6; --line2:#EDE8DA;
  --ink:#17202B; --ink2:#5A6270; --ink3:#8A8C84;
  --teal:#0E6B5C; --teal-d:#0a5247; --clay:#A8401F; --brass:#9C7A1E;
  --shadow:0 1px 2px rgba(23,32,43,.04),0 8px 30px rgba(23,32,43,.06);
}
*{box-sizing:border-box}
.root{
  font-family:'Inter',system-ui,sans-serif;
  background:
    radial-gradient(1100px 500px at 88% -8%, rgba(14,107,92,.06), transparent 60%),
    var(--paper);
  color:var(--ink); min-height:100vh; padding:28px 22px 150px; line-height:1.45;
}
.root *::selection{background:rgba(14,107,92,.18)}

/* header */
.hd{display:flex;align-items:center;gap:18px;max-width:1180px;margin:0 auto 26px}
.hd-mark{
  font-family:'IBM Plex Mono',monospace;font-weight:600;font-size:11px;letter-spacing:.32em;
  color:var(--teal-d);border:1px solid var(--teal);border-radius:3px;padding:9px 11px;line-height:1;
  background:rgba(14,107,92,.05);white-space:nowrap;align-self:flex-start;margin-top:4px;
}
.hd-titles{flex:1}
.hd-titles h1{font-family:'Spectral',serif;font-weight:600;font-size:34px;letter-spacing:-.01em;margin:0;line-height:1}
.hd-titles p{margin:6px 0 0;color:var(--ink2);font-size:13.5px}
.ghost{
  font-family:'Inter';font-size:12.5px;color:var(--ink2);background:transparent;
  border:1px solid var(--line);border-radius:7px;padding:9px 13px;cursor:pointer;transition:.15s;white-space:nowrap;
}
.ghost:hover{border-color:var(--teal);color:var(--teal-d);background:var(--surface)}

/* panels */
.panel{
  max-width:1180px;margin:0 auto 20px;background:var(--surface);
  border:1px solid var(--line);border-radius:13px;box-shadow:var(--shadow);padding:22px 24px;
}
.sec-label{
  display:flex;align-items:baseline;gap:11px;font-family:'Spectral',serif;font-weight:600;font-size:19px;
  margin:0 0 18px;letter-spacing:-.005em;
}
.sec-label em{font-family:'Inter';font-style:normal;font-weight:400;font-size:12.5px;color:var(--ink3)}
.sec-no{
  font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--teal-d);font-weight:600;
  border:1px solid var(--line);border-radius:4px;padding:3px 6px;letter-spacing:.05em;
}
.add{
  margin-left:auto;font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:500;
  color:var(--teal-d);background:rgba(14,107,92,.06);border:1px solid var(--teal);
  border-radius:7px;padding:7px 12px;cursor:pointer;transition:.15s;
}
.add:hover{background:var(--teal);color:#fff}

/* assumptions grid */
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:13px;align-items:end}
.field{display:flex;flex-direction:column;gap:7px}
.fl{font-size:12.5px;font-weight:500;color:var(--ink);text-align:left}
.fl i{display:block;font-style:normal;font-size:10.5px;color:var(--ink3);font-weight:400;margin-top:1px}
.fi{display:flex;align-items:stretch;padding:0;border:1px solid var(--line);border-radius:8px;background:#fff;transition:.15s;overflow:hidden;margin-top:auto}
.fi:focus-within{border-color:var(--teal);box-shadow:0 0 0 3px rgba(14,107,92,.1)}
.fi input{flex:1 1 auto;width:100%;min-width:0;border:0;outline:0;background:transparent;padding:11px 12px;font-family:'IBM Plex Mono',monospace;font-size:14px;color:var(--ink);font-weight:500;text-align:right;font-variant-numeric:tabular-nums}
.fi input:disabled,.fi input:read-only{color:var(--ink);background:transparent;cursor:default;opacity:1;-webkit-text-fill-color:var(--ink)}
.fi em{flex:0 0 46px;display:flex;align-items:center;justify-content:center;font-style:normal;font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--ink3);border-left:1px solid var(--line2)}

.derived{
  display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:16px;padding-top:15px;
  border-top:1px dashed var(--line);font-family:'IBM Plex Mono',monospace;font-size:13px;color:var(--ink2);
}
.derived b{color:var(--ink3);font-weight:500;font-size:11px;letter-spacing:.02em;margin-right:5px}
.derived .dot{width:4px;height:4px;border-radius:50%;background:var(--line);}

/* table */
.warn{font-size:12.5px;color:var(--clay);background:rgba(168,64,31,.07);
  border:1px solid rgba(168,64,31,.25);border-radius:8px;padding:9px 12px;margin-bottom:12px}
.tablewrap{overflow-x:auto;margin:0 -8px;border-radius:9px}
table{border-collapse:collapse;width:100%;min-width:1080px;font-size:12.5px}
thead th{
  font-family:'Inter';font-weight:600;font-size:10.5px;letter-spacing:.02em;color:var(--ink2);
  text-align:right;padding:8px 10px;border-bottom:1.5px solid var(--ink);vertical-align:bottom;white-space:nowrap;
}
thead th i{display:block;font-style:normal;font-weight:400;font-size:9px;color:var(--ink3);text-transform:none;margin-top:2px}
thead th.edit{color:var(--teal-d)}
thead th.ctr{text-align:center}
thead th.key{color:var(--ink)}
thead th.rownum,thead th.del{border-bottom-color:var(--ink)}
.num{text-align:right}
.ctr{text-align:center}
tbody td{padding:0 10px;border-bottom:1px solid var(--line2);height:38px;white-space:nowrap;font-family:'IBM Plex Mono',monospace}
tbody tr:hover{background:rgba(14,107,92,.025)}
tr.settle{background:rgba(156,122,30,.06)}
tr.settle:hover{background:rgba(156,122,30,.09)}
td.rownum{font-size:11px;color:var(--ink3);text-align:center;width:30px;padding:0 4px}
td.edit{padding:4px 6px}
td.edit input{
  width:100%;border:1px solid transparent;border-radius:6px;background:#fff;outline:0;
  padding:7px 8px;font-family:'IBM Plex Mono',monospace;font-size:12.5px;color:var(--ink);transition:.12s;
  box-shadow:inset 0 0 0 1px var(--line2);
}
td.edit input.ri{text-align:right}
td.edit input:focus{box-shadow:inset 0 0 0 1px var(--teal),0 0 0 3px rgba(14,107,92,.1)}
td.edit input[type=date]{font-size:11.5px;color:var(--teal-d);font-weight:500}
td.edit input.datein{font-size:12px;color:var(--teal-d);font-weight:500;letter-spacing:.01em;padding-right:28px}
td.edit input.datein::placeholder{color:var(--ink3);opacity:.55;font-weight:400}
td.edit.ctr{text-align:center}
td.edit.ctr input{width:16px;height:16px;accent-color:var(--teal);cursor:pointer;box-shadow:none;padding:0}
td.edit.ctr input:disabled{accent-color:var(--brass);cursor:not-allowed;opacity:.85}

/* date cell + native calendar trigger */
.datewrap{position:relative;display:flex;align-items:center;min-width:124px}
.datewrap .datein{flex:1;min-width:0}
.calbtn{
  position:absolute;right:5px;top:50%;transform:translateY(-50%);
  width:22px;height:22px;display:flex;align-items:center;justify-content:center;
  border:0;background:transparent;cursor:pointer;color:var(--teal-d);padding:0;border-radius:5px;transition:.12s;
}
.calbtn:hover{background:rgba(14,107,92,.12)}
.calbtn svg{width:14px;height:14px;display:block}
.dnative{
  position:absolute;right:5px;top:0;width:22px;height:100%;
  opacity:0;pointer-events:none;border:0;padding:0;box-shadow:none;background:transparent;
}

td.key{background:rgba(23,32,43,.025);font-weight:500}
/* default money values use the main ink color */
.mny{color:var(--ink)}
/* keep colored pos/neg/zero only inside key columns */
.num.key .mny.pos{color:var(--teal-d)}
.num.key .mny.neg{color:var(--clay)}
.num.key .mny.zero{color:var(--ink3)}
.gray{color:var(--ink2)}
.dash{color:var(--ink3);opacity:.5}
.fn{color:var(--brass);font-size:9px;margin-left:1px}
td.del{width:34px;text-align:center;padding:0}
td.del button{
  width:22px;height:22px;border-radius:6px;border:1px solid transparent;background:transparent;
  color:var(--ink3);font-size:15px;cursor:pointer;line-height:1;transition:.12s;
}
td.del button:hover:not(:disabled){background:rgba(168,64,31,.1);color:var(--clay)}
td.del button:disabled{opacity:.25;cursor:not-allowed}
tfoot td{padding:12px 10px;border-top:2px solid var(--ink);font-family:'IBM Plex Mono',monospace;font-size:13px}
tfoot .foot-l{font-family:'Inter';font-weight:600;font-size:11px;letter-spacing:.03em;text-align:right;color:var(--ink2);text-transform:uppercase}
.fnote{font-size:11.5px;color:var(--ink3);margin:12px 2px 0;line-height:1.5;max-width:760px}

/* result tape */
.tape{position:fixed;left:0;right:0;bottom:0;z-index:50;
  background:linear-gradient(180deg, rgba(23,32,43,0), var(--ink) 22%) padding-box, var(--ink);
  border-top:2px solid var(--teal);box-shadow:0 -10px 40px rgba(23,32,43,.22);
}
.tape-in{max-width:1180px;margin:0 auto;display:flex;align-items:center;gap:26px;padding:15px 24px;flex-wrap:nowrap}
.tape-lead{display:flex;align-items:center;gap:8px;font-family:'IBM Plex Mono',monospace;
  font-size:10.5px;letter-spacing:.28em;color:#9fb0ab;white-space:nowrap}
.live{width:7px;height:7px;border-radius:50%;background:#37d6b6;box-shadow:0 0 0 0 rgba(55,214,182,.6);
  animation:pulse 2s infinite}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(55,214,182,.5)}70%{box-shadow:0 0 0 7px rgba(55,214,182,0)}100%{box-shadow:0 0 0 0 rgba(55,214,182,0)}}
.results{display:flex;gap:14px;flex:1;min-width:280px}
.result{flex:1;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);
  border-radius:10px;padding:11px 16px;min-width:150px}
.result.primary{background:rgba(14,107,92,.18);border-color:rgba(55,214,182,.4)}
.r-label{font-family:'Inter';font-size:11px;font-weight:600;letter-spacing:.04em;color:#b9c4c0;text-transform:uppercase}
.r-value{font-family:'IBM Plex Mono',monospace;font-weight:600;font-size:22px;color:#fff;
  letter-spacing:-.01em;line-height:1.15;font-variant-numeric:tabular-nums;transition:color .3s}
.r-value .mny{color:inherit}
.result.primary .r-value{color:#5ee7c8}
.r-sub{font-size:10.5px;color:#7e8c88;margin-top:1px}
.aux{display:flex;flex-direction:column;gap:8px;border-left:1px solid rgba(255,255,255,.1);padding-left:24px}
.aux div{display:flex;flex-direction:column}
.aux span{font-family:'Inter';font-size:9.5px;letter-spacing:.04em;color:#7e8c88;text-transform:uppercase}
.aux b{font-family:'IBM Plex Mono',monospace;font-size:13.5px;font-weight:500;color:#e4eae8;font-variant-numeric:tabular-nums}

@media(max-width:720px){
  .hd-titles h1{font-size:26px}
  .aux{border-left:0;padding-left:0;flex-direction:row;gap:18px;width:100%}
  .tape-lead{width:100%}
  .r-value{font-size:24px}
}
`;
