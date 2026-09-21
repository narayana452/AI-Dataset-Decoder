/* 10 normal test cases + 10 edge/fault test cases */
const Tests = (() => {
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const throws = fn => { try { fn(); return false; } catch (e) { return true; } };
  const B = list => Logic.buildCodebook(list);
  const letters = k => Array.from({ length: k }, (_, i) => "C" + i);

  const cases = [
    // ---------- NORMAL ----------
    { type: "Normal", name: "2 categories: A -> [1,0]", run: () => {
        const v = Logic.encode("A", B(["A", "B"])).vec;
        return { pass: same(v, [1, 0]), detail: JSON.stringify(v) };
    }},
    { type: "Normal", name: "3 categories: Green -> [0,1,0]", run: () => {
        const v = Logic.encode("Green", B(["Red", "Green", "Blue"])).vec;
        return { pass: same(v, [0, 1, 0]), detail: JSON.stringify(v) };
    }},
    { type: "Normal", name: "4 categories (power of 2): all vectors unique", run: () => {
        const b = B(["W", "X", "Y", "Z"]);
        const set = new Set(b.categories.map(c => Logic.encode(c, b).vec.join("")));
        return { pass: set.size === 4, detail: `${set.size} unique vectors` };
    }},
    { type: "Normal", name: "5 categories: E uses code 100 (3 bits)", run: () => {
        const b = B(["A", "B", "C", "D", "E"]);
        const r = Logic.encode("E", b);
        return { pass: b.n === 3 && same(r.bits, [1, 0, 0]), detail: r.bits.join("") };
    }},
    { type: "Normal", name: "8 categories: full 3-to-8 decoder validates", run: () => {
        const b = B(letters(8));
        const ok = b.categories.every((c, i) => {
          const r = Logic.encode(c, b);
          return Logic.validate(r.vec, i, 8, r.full).ok;
        });
        return { pass: ok, detail: "8/8 valid" };
    }},
    { type: "Normal", name: "6 categories: round-trip decode", run: () => {
        const b = B(letters(6));
        const ok = b.categories.every((c, i) => Logic.decodeOneHot(Logic.encode(c, b).vec) === i);
        return { pass: ok, detail: "6/6 decoded" };
    }},
    { type: "Normal", name: "7 categories: matches standard one-hot", run: () => {
        const b = B(letters(7));
        const ok = b.categories.every((c, i) => same(Logic.encode(c, b).vec, Logic.standardOneHot(i, 7)));
        return { pass: ok, detail: "7/7 equal" };
    }},
    { type: "Normal", name: "2-to-4 decoder truth table", run: () => {
        const rows = [0, 1, 2, 3].map(i => Logic.decoder(Logic.toBits(i, 2)));
        const ok = rows.every((r, i) => same(r, Logic.standardOneHot(i, 4)));
        return { pass: ok, detail: "identity matrix" };
    }},
    { type: "Normal", name: "10-row dataset gives 10 x 3 matrix", run: () => {
        const b = B(["X", "Y", "Z"]);
        const data = ["X", "Y", "Z", "X", "Y", "Z", "X", "Y", "Z", "X"];
        const m = data.map(v => Logic.encode(v, b).vec);
        return { pass: m.length === 10 && m.every(r => r.length === 3), detail: `${m.length} x ${m[0].length}` };
    }},
    { type: "Normal", name: "Whitespace is trimmed", run: () => {
        const b = B([" Cat ", "Dog"]);
        return { pass: b.categories[0] === "Cat", detail: `"${b.categories[0]}"` };
    }},

    // ---------- EDGE / FAULT ----------
    { type: "Edge", name: "Unknown category is rejected", run: () => {
        return { pass: throws(() => Logic.encode("Pink", B(["Red", "Blue"]))), detail: "error thrown" };
    }},
    { type: "Edge", name: "Empty category list is rejected", run: () => {
        return { pass: throws(() => B([])), detail: "error thrown" };
    }},
    { type: "Edge", name: "Single category -> n=1, vector [1]", run: () => {
        const b = B(["Only"]);
        const v = Logic.encode("Only", b).vec;
        return { pass: b.n === 1 && same(v, [1]), detail: `n=${b.n}, ${JSON.stringify(v)}` };
    }},
    { type: "Edge", name: "Duplicate categories are merged", run: () => {
        const b = B(["A", "B", "A", "B"]);
        return { pass: b.categories.length === 2, detail: `${b.categories.length} unique` };
    }},
    { type: "Edge", name: "Invalid input bit (2) is rejected", run: () => {
        return { pass: throws(() => Logic.decoder([0, 2])), detail: "error thrown" };
    }},
    { type: "Fault", name: "Stuck-at-0 fault is detected", run: () => {
        const b = B(["A", "B", "C", "D"]);
        const r = Logic.encode("C", b, { line: 2, type: 0 });
        return { pass: !Logic.validate(r.vec, r.idx, 4, r.full).ok, detail: JSON.stringify(r.vec) };
    }},
    { type: "Fault", name: "Stuck-at-1 fault is detected", run: () => {
        const b = B(["A", "B", "C", "D"]);
        const r = Logic.encode("B", b, { line: 0, type: 1 });
        return { pass: !Logic.validate(r.vec, r.idx, 4, r.full).ok, detail: JSON.stringify(r.vec) };
    }},
    { type: "Edge", name: "More than 64 categories is rejected", run: () => {
        return { pass: throws(() => B(letters(65))), detail: "error thrown" };
    }},
    { type: "Edge", name: "Unused code (101 with k=5) is flagged", run: () => {
        const out = Logic.decoder(Logic.toBits(5, 3));
        return { pass: Logic.unusedActive(out, 5), detail: "D5 active, outside k=5" };
    }},
    { type: "Edge", name: "Enable = 0 forces all outputs to 0", run: () => {
        const out = Logic.decoder([1, 0], 0);
        return { pass: out.every(v => v === 0), detail: JSON.stringify(out) };
    }},
  ];

  function run() {
    return cases.map(c => {
      try { return { type: c.type, name: c.name, ...c.run() }; }
      catch (e) { return { type: c.type, name: c.name, pass: false, detail: "Error: " + e.message }; }
    });
  }

  return { run };
})();