/**
 * Safe formula evaluator for derived metrics.
 *
 * Tokens:
 *   [kpi:UUID:quantity]        → KPI quantity value
 *   [kpi:UUID:mj_value]       → KPI MJ value
 *   [kpi:UUID:emission_value] → KPI emission value
 *   [ind:ID]                  → direct indicator quantity
 *   [dm:UUID]                 → another derived metric's result
 *
 * Operators: + - * / % (percentage = LHS/RHS*100 in legacy; modulo in formula)
 *            ( ) for grouping
 *
 * No eval(), no Function() — pure recursive descent parser.
 */

import type { KPI, Indicator, DerivedMetric } from "@/types";

// ── Token types for the lexer ──────────────────────────────────────────────
type TokenType =
  | "NUMBER"
  | "PLUS"
  | "MINUS"
  | "STAR"
  | "SLASH"
  | "PERCENT"
  | "LPAREN"
  | "RPAREN"
  | "REF"
  | "EOF";

interface LexToken {
  type: TokenType;
  value: number | string;
}

// ── Reference regex ────────────────────────────────────────────────────────
const REF_RE =
  /\[kpi:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):(quantity|mj_value|emission_value)\]|\[ind:(\d+)\]|\[dm:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/g;

// ── Public: extract referenced tokens from a formula ───────────────────────
export interface FormulaToken {
  type: "kpi" | "indicator" | "derived";
  id: string;
  field?: string; // only for kpi
}

export function extractTokens(formula: string): FormulaToken[] {
  const tokens: FormulaToken[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(REF_RE.source, "g");
  while ((m = re.exec(formula)) !== null) {
    if (m[1]) tokens.push({ type: "kpi", id: m[1], field: m[2] });
    else if (m[3]) tokens.push({ type: "indicator", id: m[3] });
    else if (m[4]) tokens.push({ type: "derived", id: m[4] });
  }
  return tokens;
}

// ── Lexer ──────────────────────────────────────────────────────────────────
function tokenize(
  formula: string,
  values: Map<string, number>,
): LexToken[] | null {
  const tokens: LexToken[] = [];
  let i = 0;
  const s = formula;

  while (i < s.length) {
    // Skip whitespace
    if (/\s/.test(s[i])) {
      i++;
      continue;
    }

    // Single-character operators
    if (s[i] === "+") { tokens.push({ type: "PLUS", value: "+" }); i++; continue; }
    if (s[i] === "-") { tokens.push({ type: "MINUS", value: "-" }); i++; continue; }
    if (s[i] === "*") { tokens.push({ type: "STAR", value: "*" }); i++; continue; }
    if (s[i] === "/") { tokens.push({ type: "SLASH", value: "/" }); i++; continue; }
    if (s[i] === "%") { tokens.push({ type: "PERCENT", value: "%" }); i++; continue; }
    if (s[i] === "(") { tokens.push({ type: "LPAREN", value: "(" }); i++; continue; }
    if (s[i] === ")") { tokens.push({ type: "RPAREN", value: ")" }); i++; continue; }

    // Number literal
    if (/[0-9.]/.test(s[i])) {
      let num = "";
      while (i < s.length && /[0-9.]/.test(s[i])) {
        num += s[i];
        i++;
      }
      const parsed = parseFloat(num);
      if (isNaN(parsed)) return null;
      tokens.push({ type: "NUMBER", value: parsed });
      continue;
    }

    // Reference token: [kpi:UUID:field], [ind:ID], [dm:UUID]
    if (s[i] === "[") {
      const rest = s.slice(i);
      const refRe = new RegExp(REF_RE.source);
      const m = refRe.exec(rest);
      if (!m || m.index !== 0) return null; // invalid token

      let val: number | undefined;
      if (m[1]) {
        // KPI reference
        const kpiId = m[1];
        const field = m[2];
        const key =
          field === "mj_value" ? `${kpiId}_mj` :
          field === "emission_value" ? `${kpiId}_co2e` :
          kpiId;
        val = values.get(key);
      } else if (m[3]) {
        // Indicator reference
        val = values.get(`ind_${m[3]}`);
      } else if (m[4]) {
        // Derived metric reference
        val = values.get(`dm_${m[4]}`);
      }

      if (val === undefined) return null; // missing value — can't compute
      tokens.push({ type: "NUMBER", value: val });
      i += m[0].length;
      continue;
    }

    // Unknown character
    return null;
  }

  tokens.push({ type: "EOF", value: 0 });
  return tokens;
}

// ── Recursive descent parser ───────────────────────────────────────────────
// Grammar:
//   expression → term (('+' | '-') term)*
//   term       → unary (('*' | '/' | '%') unary)*
//   unary      → '-' unary | atom
//   atom       → NUMBER | '(' expression ')'

class Parser {
  private tokens: LexToken[];
  private pos = 0;
  private depth = 0;
  private static MAX_DEPTH = 50;

  constructor(tokens: LexToken[]) {
    this.tokens = tokens;
  }

  private peek(): LexToken {
    return this.tokens[this.pos];
  }

  private advance(): LexToken {
    const t = this.tokens[this.pos];
    this.pos++;
    return t;
  }

  parse(): number | null {
    const result = this.expression();
    if (this.peek().type !== "EOF") return null;
    return result;
  }

  private expression(): number | null {
    let left = this.term();
    if (left === null) return null;

    while (this.peek().type === "PLUS" || this.peek().type === "MINUS") {
      const op = this.advance();
      const right = this.term();
      if (right === null) return null;
      left = op.type === "PLUS" ? left + right : left - right;
    }
    return left;
  }

  private term(): number | null {
    let left = this.unary();
    if (left === null) return null;

    while (
      this.peek().type === "STAR" ||
      this.peek().type === "SLASH" ||
      this.peek().type === "PERCENT"
    ) {
      const op = this.advance();
      const right = this.unary();
      if (right === null) return null;
      if (op.type === "STAR") {
        left = left * right;
      } else if (op.type === "SLASH") {
        if (right === 0) return null;
        left = left / right;
      } else {
        // PERCENT: modulo in formula mode
        if (right === 0) return null;
        left = left % right;
      }
    }
    return left;
  }

  private unary(): number | null {
    if (this.peek().type === "MINUS") {
      this.advance();
      const val = this.unary();
      return val === null ? null : -val;
    }
    return this.atom();
  }

  private atom(): number | null {
    const t = this.peek();
    if (t.type === "NUMBER") {
      this.advance();
      return t.value as number;
    }
    if (t.type === "LPAREN") {
      this.advance();
      this.depth++;
      if (this.depth > Parser.MAX_DEPTH) return null;
      const val = this.expression();
      this.depth--;
      if (val === null) return null;
      if (this.peek().type !== "RPAREN") return null;
      this.advance();
      return val;
    }
    return null;
  }
}

// ── Public: evaluate a formula ─────────────────────────────────────────────
export function evaluateFormula(
  formula: string,
  values: Map<string, number>,
): number | null {
  const tokens = tokenize(formula, values);
  if (!tokens) return null;
  const parser = new Parser(tokens);
  const result = parser.parse();
  if (result === null || !isFinite(result)) return null;
  return result;
}

// ── Public: display formula with human-readable names ──────────────────────
export function displayFormula(
  formula: string,
  kpis: KPI[],
  indicators: Indicator[],
  derivedMetrics: DerivedMetric[],
): string {
  const kpiMap = new Map(kpis.map((k) => [k.kpi_id, k]));
  const indMap = new Map(indicators.map((i) => [String(i.indicator_id), i]));
  const dmMap = new Map(derivedMetrics.map((d) => [d.metric_id, d]));

  const fieldLabel: Record<string, string> = {
    quantity: "",
    mj_value: " (MJ)",
    emission_value: " (tCO₂e)",
  };

  return formula.replace(
    new RegExp(REF_RE.source, "g"),
    (match, kpiId, field, indId, dmId) => {
      if (kpiId) {
        const kpi = kpiMap.get(kpiId);
        return kpi ? `[${kpi.kpi_name}${fieldLabel[field] || ""}]` : match;
      }
      if (indId) {
        const ind = indMap.get(indId);
        return ind ? `[${ind.indicator_name}]` : match;
      }
      if (dmId) {
        const dm = dmMap.get(dmId);
        return dm ? `[${dm.name}]` : match;
      }
      return match;
    },
  );
}
