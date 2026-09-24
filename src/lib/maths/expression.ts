/**
 * A small, safe maths expression parser for the tutor's graphs. Nothing is ever eval'd:
 * expressions are parsed into a closure over a fixed set of operators, functions and variables.
 *
 * Understands how maths is written at GCSE: implicit multiplication (5x, 2(x+1), ax^2), x², √,
 * ×, ÷ and the Unicode minus; -x^2 means -(x^2).
 */

export type Fn = (vars: Record<string, number>) => number;

const MAX_LENGTH = 200;
const GREEK = /[Α-Ωα-ω]/;

const FUNCTIONS: Record<string, (v: number) => number> = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  ln: Math.log,
  log: Math.log10,
  exp: Math.exp,
};
const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };

type Token =
  | { t: "num"; v: number }
  | { t: "name"; v: string }
  | { t: "func"; v: string }
  | { t: "op"; v: "+" | "-" | "*" | "/" | "^" }
  | { t: "(" }
  | { t: ")" };

function normalise(src: string) {
  return src
    .replace(/[−–]/g, "-")
    .replace(/[×·]/g, "*")
    .replace(/÷/g, "/")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/√/g, "sqrt")
    .replace(/π/g, "pi");
}

function tokenize(src: string): Token[] {
  const s = normalise(src);
  const tokens: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      i++;
    } else if (/[0-9.]/.test(ch)) {
      const m = s.slice(i).match(/^\d*\.?\d+(?:e[+-]?\d+)?/i)!;
      if (!m) throw new Error(`Bad number at "${s.slice(i)}"`);
      tokens.push({ t: "num", v: Number(m[0]) });
      i += m[0].length;
    } else if (GREEK.test(ch)) {
      // Greek letters (ρ, λ, θ…) are single-letter variables, as in physics formulas.
      tokens.push({ t: "name", v: ch });
      i++;
    } else if (/[a-z]/i.test(ch)) {
      // Function names and constants are read whole; any other letters are single-letter variables (ax = a·x).
      const rest = s.slice(i).toLowerCase();
      const fn = Object.keys(FUNCTIONS).find((f) => rest.startsWith(f) && /^\s*\(|^\s*[a-z0-9]/.test(rest.slice(f.length)));
      const constant = Object.keys(CONSTANTS).find((c) => rest.startsWith(c) && !/^[a-z]/.test(rest.slice(c.length)));
      if (fn) {
        tokens.push({ t: "func", v: fn });
        i += fn.length;
      } else if (constant) {
        tokens.push({ t: "name", v: constant });
        i += constant.length;
      } else {
        tokens.push({ t: "name", v: ch });
        i++;
      }
    } else if ("+-*/^".includes(ch)) {
      tokens.push({ t: "op", v: ch as "+" });
      i++;
    } else if (ch === "(" || ch === "[") {
      tokens.push({ t: "(" });
      i++;
    } else if (ch === ")" || ch === "]") {
      tokens.push({ t: ")" });
      i++;
    } else {
      throw new Error(`Unexpected "${ch}"`);
    }
  }
  return insertImplicitMultiplication(tokens);
}

/** 5x → 5*x, 2(x) → 2*(x), (a)(b) → (a)*(b), x sqrt(y) → x*sqrt(y). */
function insertImplicitMultiplication(tokens: Token[]): Token[] {
  const out: Token[] = [];
  for (const tok of tokens) {
    const prev = out[out.length - 1];
    const prevEndsValue = prev && (prev.t === "num" || prev.t === "name" || prev.t === ")");
    const startsValue = tok.t === "num" || tok.t === "name" || tok.t === "func" || tok.t === "(";
    if (prevEndsValue && startsValue) out.push({ t: "op", v: "*" });
    out.push(tok);
  }
  return out;
}

export function compile(src: string, params: string[] = []): Fn {
  if (src.length > MAX_LENGTH) throw new Error("Expression is too long");
  const allowed = new Set(["x", ...params]);
  const tokens = tokenize(src);
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (v: string) => peek()?.t === "op" && (peek() as { v: string }).v === v;

  // expr := term (('+'|'-') term)*
  function expr(): Fn {
    let left = term();
    while (isOp("+") || isOp("-")) {
      const op = (tokens[pos++] as { v: string }).v;
      const l = left;
      const r = term();
      left = op === "+" ? (v) => l(v) + r(v) : (v) => l(v) - r(v);
    }
    return left;
  }
  // term := unary (('*'|'/') unary)*
  function term(): Fn {
    let left = unary();
    while (isOp("*") || isOp("/")) {
      const op = (tokens[pos++] as { v: string }).v;
      const l = left;
      const r = unary();
      left = op === "*" ? (v) => l(v) * r(v) : (v) => l(v) / r(v);
    }
    return left;
  }
  // unary := '-' unary | '+' unary | power      (so -x^2 = -(x^2))
  function unary(): Fn {
    if (isOp("-")) {
      pos++;
      const inner = unary();
      return (v) => -inner(v);
    }
    if (isOp("+")) {
      pos++;
      return unary();
    }
    return power();
  }
  // power := atom ('^' unary)?     (right-associative)
  function power(): Fn {
    const base = atom();
    if (isOp("^")) {
      pos++;
      const exponent = unary();
      return (v) => Math.pow(base(v), exponent(v));
    }
    return base;
  }
  function atom(): Fn {
    const tok = tokens[pos++];
    if (!tok) throw new Error("Expression ended too soon");
    if (tok.t === "num") return () => tok.v;
    if (tok.t === "name") {
      if (tok.v in CONSTANTS) {
        const c = CONSTANTS[tok.v];
        return () => c;
      }
      if (!allowed.has(tok.v)) throw new Error(`Unknown name "${tok.v}"`);
      const name = tok.v;
      return (v) => v[name] ?? NaN;
    }
    if (tok.t === "func") {
      const f = FUNCTIONS[tok.v];
      const arg = peek()?.t === "(" ? atom() : power();
      return (v) => f(arg(v));
    }
    if (tok.t === "(") {
      const inner = expr();
      if (tokens[pos++]?.t !== ")") throw new Error("Missing closing bracket");
      return inner;
    }
    throw new Error("Unexpected symbol");
  }

  const fn = expr();
  if (pos !== tokens.length) throw new Error("Unexpected symbol after the end of the expression");
  return fn;
}
