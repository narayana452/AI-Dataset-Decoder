/* Digital-logic model: gates, n-to-2^n decoder, one-hot encoder, validation */
const Logic = (() => {
  const MAX_CATEGORIES = 64;

  // ---- Basic gates ----
  const NOT = a => (a ? 0 : 1);
  const AND = (...inputs) => (inputs.every(v => v === 1) ? 1 : 0);

  // ---- Helpers ----
  const bitsNeeded = k => Math.max(1, Math.ceil(Math.log2(k)));
  const toBits = (num, n) => num.toString(2).padStart(n, "0").split("").map(Number);

  /* n-to-2^n decoder with enable input and optional stuck-at fault.
     bits[0] is the MSB. Output line Di is the minterm of code i. */
  function decoder(bits, enable = 1, fault = null) {
    if (!Array.isArray(bits) || bits.length < 1 || bits.some(b => b !== 0 && b !== 1)) {
      throw new Error("Decoder inputs must be an array of 0/1 bits.");
    }
    if (enable !== 0 && enable !== 1) throw new Error("Enable must be 0 or 1.");

    const n = bits.length;
    const outputs = [];
    for (let i = 0; i < 2 ** n; i++) {
      const pattern = toBits(i, n);
      const literals = bits.map((b, j) => (pattern[j] === 1 ? b : NOT(b)));
      let y = AND(enable, ...literals);
      if (fault && fault.line === i) y = fault.type; // stuck-at-0 / stuck-at-1
      outputs.push(y);
    }
    return outputs;
  }

  // Boolean expression for output line i, e.g. D2 = A2'.A1.A0'
  function equation(i, n) {
    const pattern = toBits(i, n);
    const terms = pattern.map((b, j) => `A${n - 1 - j}${b ? "" : "'"}`);
    return `D${i} = ${terms.join("·")}`;
  }

  // ---- Category codes ----
  function buildCodebook(list) {
    const categories = [...new Set(list.map(s => String(s).trim()).filter(Boolean))];
    if (categories.length === 0) throw new Error("Please enter at least one category.");
    if (categories.length > MAX_CATEGORIES) {
      throw new Error(`Too many categories (${categories.length}). Maximum is ${MAX_CATEGORIES}.`);
    }
    const n = bitsNeeded(categories.length);
    return { categories, n, lines: 2 ** n };
  }

  // ---- Encoder: category -> code -> decoder -> one-hot ----
  function encode(value, book, fault = null) {
    const idx = book.categories.indexOf(String(value).trim());
    if (idx < 0) throw new Error(`Unknown category "${value}"`);
    const bits = toBits(idx, book.n);
    const full = decoder(bits, 1, fault);
    return { idx, bits, full, vec: full.slice(0, book.categories.length) };
  }

  // ---- Standard (reference) encodings ----
  const standardOneHot = (idx, k) => Array.from({ length: k }, (_, i) => (i === idx ? 1 : 0));
  const decodeOneHot = vec => (vec.filter(v => v === 1).length === 1 ? vec.indexOf(1) : -1);
  const unusedActive = (full, k) => full.slice(k).some(v => v === 1);

  // ---- Validation ----
  function validate(vec, idx, k, full) {
    const ones = vec.filter(v => v === 1).length;
    const std = standardOneHot(idx, k);
    const checks = [
      { name: "Exactly one hot line", ok: ones === 1 },
      { name: "Hot line matches category index", ok: ones === 1 && vec[idx] === 1 },
      { name: "No unused decoder line active", ok: !unusedActive(full, k) },
      { name: "Equals standard one-hot", ok: std.every((v, i) => v === vec[i]) },
      { name: "Round-trip decode correct", ok: decodeOneHot(vec) === idx },
    ];
    return { ok: checks.every(c => c.ok), checks };
  }

  return {
    MAX_CATEGORIES, bitsNeeded, toBits, decoder, equation,
    buildCodebook, encode, standardOneHot, decodeOneHot, unusedActive, validate,
  };
})();