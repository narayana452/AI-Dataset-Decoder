/* UI layer: works live on whatever the user types, runs only on button press */
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g,
  c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const parseList = t => t.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);

let book = null;
let lastRows = [];

/* ---------- Table helpers ---------- */
function table(headers, rows) {
  return "<table><thead><tr>" + headers.map(h => `<th>${h}</th>`).join("") +
    "</tr></thead><tbody>" +
    rows.map(r => "<tr>" + r.map(c =>
      `<td${c.cls ? ` class="${c.cls}"` : ""}>${c.html !== undefined ? c.html : c}</td>`
    ).join("") + "</tr>").join("") +
    "</tbody></table>";
}
const cell = (html, cls) => ({ html, cls });

function getFault() {
  const type = $("faultType").value;
  const line = parseInt($("faultLine").value, 10);
  if (type === "none" || isNaN(line) || line < 0 || line >= book.lines) return null;
  return { line, type: Number(type) };
}

/* ---------- Step 1 : Category codes ---------- */
function renderCodebook() {
  const k = book.categories.length;
  const unused = book.lines - k;
  $("codebookInfo").textContent =
    `${k} categories → n = ${book.n} input bit(s) → ${book.n}-to-${book.lines} decoder ` +
    `(${unused} unused output line${unused === 1 ? "" : "s"}).`;
  $("codebook").innerHTML = table(
    ["Index", "Category", "Binary code"],
    book.categories.map((c, i) => [i, esc(c), Logic.toBits(i, book.n).join("")])
  );
}

/* ---------- Step 2 : Decoder truth table ---------- */
function renderTruth() {
  const { n, lines } = book;
  const k = book.categories.length;
  const showMatrix = lines <= 16;
  const inputHeads = Array.from({ length: n }, (_, j) => `A${n - 1 - j}`);
  const outHeads = showMatrix ? Array.from({ length: lines }, (_, i) => `D${i}`) : [];
  const rows = [];

  for (let i = 0; i < lines; i++) {
    const bits = Logic.toBits(i, n);
    const out = Logic.decoder(bits);
    const row = [...bits];
    if (showMatrix) out.forEach(v => row.push(cell(v, v ? "hot" : "")));
    row.push(i < k ? esc(book.categories[i]) : cell("unused", "bad"));
    rows.push(row);
  }
  $("truth").innerHTML = table([...inputHeads, ...outHeads, "Category"], rows);
}

/* ---------- Intermediate states ---------- */
function renderTraceSelect() {
  $("traceSelect").innerHTML = book.categories
    .map((c, i) => `<option value="${i}">${esc(c)}</option>`).join("");
  $("faultLine").max = book.lines - 1;
}

function renderTrace() {
  const idx = Number($("traceSelect").value) || 0;
  const k = book.categories.length;
  const r = Logic.encode(book.categories[idx], book, getFault());
  const inputs = r.bits.map((b, j) => `A${book.n - 1 - j}=${b}`).join(", ");
  const inverted = r.bits.map((b, j) => `A${book.n - 1 - j}'=${b ? 0 : 1}`).join(", ");

  const lineRows = r.full.map((y, i) => [
    `D${i}`,
    Logic.equation(i, book.n),
    cell(y, y ? "hot" : ""),
    i < k ? esc(book.categories[i]) : "unused",
  ]);

  const v = Logic.validate(r.vec, r.idx, k, r.full);
  const checkRows = v.checks.map(c => [c.name, cell(c.ok ? "PASS" : "FAIL", c.ok ? "ok" : "bad")]);

  $("trace").innerHTML =
    `<p><strong>Inputs:</strong> ${inputs}<br><strong>NOT gates:</strong> ${inverted}</p>` +
    table(["Line", "AND-gate equation", "Output", "Category"], lineRows) +
    `<p><strong>Validation:</strong></p>` +
    table(["Check", "Result"], checkRows);
}

/* ---------- Step 3 and 4 : One-hot vectors + validation ---------- */
function renderDataset() {
  const values = parseList($("dataset").value);
  const k = book.categories.length;
  const fault = getFault();
  lastRows = [];
  let valid = 0, invalid = 0;

  const rows = values.map((val, i) => {
    try {
      const r = Logic.encode(val, book, fault);
      const v = Logic.validate(r.vec, r.idx, k, r.full);
      if (v.ok) { valid++; lastRows.push({ value: val, vec: r.vec }); } else invalid++;
      return [i + 1, esc(val), r.bits.join(""), r.vec.join(" "),
        cell(v.ok ? "VALID" : "INVALID", v.ok ? "ok" : "bad")];
    } catch (e) {
      invalid++;
      return [i + 1, esc(val), "-", "-", cell(esc(e.message), "bad")];
    }
  });

  $("datasetSummary").textContent =
    `${values.length} rows · ${valid} valid · ${invalid} invalid` +
    (fault ? ` · fault injected: stuck-at-${fault.type} on D${fault.line}` : "");
  $("dataset-out").innerHTML = table(["#", "Value", "Code", "One-hot vector", "Validation"], rows);
}

/* ---------- Step 5 : Comparison with standard encoding ---------- */
function renderCompare() {
  const k = book.categories.length;
  const n = book.n;
  const N = parseList($("dataset").value).length;

  const perCategory = book.categories.map((c, i) => {
    const oh = Logic.encode(c, book).vec;
    const same = JSON.stringify(oh) === JSON.stringify(Logic.standardOneHot(i, k));
    return [esc(c), i, Logic.toBits(i, n).join(""), oh.join(" "),
      cell(same ? "YES" : "NO", same ? "ok" : "bad")];
  });

  const summary = [
    ["Label encoding", 1, N, "Yes (implies false order)", "Compact, but models may treat 2 > 1"],
    ["Binary encoding", n, N * n, "Partly (shared bits)", "Compact, harder to interpret"],
    ["One-hot (decoder)", k, N * k, "No", "Equal distance between categories"],
  ];

  $("compare").innerHTML =
    table(["Category", "Label", "Binary", "One-hot (decoder)", "Same as standard one-hot"], perCategory) +
    "<br>" +
    table(["Method", "Columns", `Cells for ${N} rows`, "Ordinal bias", "Remark"], summary);
}

/* ---------- Validation report (test cases) ---------- */
function renderTests() {
  const results = Tests.run();
  const passed = results.filter(r => r.pass).length;
  const normal = results.filter(r => r.type === "Normal").length;

  $("testSummary").textContent =
    `${passed}/${results.length} passed · ${normal} normal cases · ${results.length - normal} edge/fault cases`;
  $("tests").innerHTML = table(
    ["#", "Type", "Test case", "Detail", "Result"],
    results.map((r, i) => [
      i + 1, r.type, esc(r.name), esc(r.detail),
      cell(r.pass ? "PASS" : "FAIL", r.pass ? "ok" : "bad"),
    ])
  );
}

/* ---------- CSV download ---------- */
function downloadCsv() {
  if (!book || lastRows.length === 0) {
    $("message").textContent = "Press Encode Dataset first, then download the CSV.";
    return;
  }
  const q = s => `"${String(s).replace(/"/g, '""')}"`;
  const lines = [["value", ...book.categories].map(q).join(",")];
  lastRows.forEach(r => lines.push([q(r.value), ...r.vec].join(",")));

  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
  a.download = "one_hot_encoded.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ---------- Main ---------- */
function run() {
  $("message").textContent = "";
  try {
    book = Logic.buildCodebook(parseList($("categories").value));
  } catch (e) {
    $("message").textContent = e.message;
    $("results").classList.add("hidden");
    return;
  }
  renderCodebook();
  renderTruth();
  renderTraceSelect();
  renderTrace();
  renderDataset();
  renderCompare();
  $("results").classList.remove("hidden");
}

function loadSample() {
  $("categories").value = "Cat, Dog, Bird, Fish, Horse, Rabbit";
  $("dataset").value = "Dog\nCat\nFish\nRabbit\nBird\nHorse\nDog\nCat";
  $("faultType").value = "none";
  $("faultLine").value = 0;
  $("message").textContent = "Sample loaded. Now press Encode Dataset.";
}

/* Everything runs only when a button is pressed */
$("encodeBtn").addEventListener("click", run);
$("sampleBtn").addEventListener("click", loadSample);
$("csvBtn").addEventListener("click", downloadCsv);
$("testBtn").addEventListener("click", renderTests);
$("traceSelect").addEventListener("change", () => { if (book) renderTrace(); });