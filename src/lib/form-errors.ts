/**
 * Map server validation errors (HTTP 422) to form field keys.
 * Supports FastAPI-style { detail: [{ loc, msg }] } and flat { detail: { field: msg } }.
 */
export function mapServerErrors(err: unknown): Record<string, string> {
  const data = (err as { response?: { data?: unknown } })?.response?.data;
  if (!data || typeof data !== "object") return {};

  const detail = (data as { detail?: unknown }).detail;
  const out: Record<string, string> = {};

  if (Array.isArray(detail)) {
    for (const item of detail) {
      if (!item || typeof item !== "object") continue;
      const loc = (item as { loc?: unknown }).loc;
      const msg = (item as { msg?: string }).msg;
      if (!msg) continue;
      const key = Array.isArray(loc)
        ? String(loc[loc.length - 1])
        : typeof loc === "string"
          ? loc
          : "root";
      out[key] = msg;
    }
    return out;
  }

  if (typeof detail === "object" && detail !== null) {
    for (const [k, v] of Object.entries(detail as Record<string, unknown>)) {
      if (typeof v === "string") out[k] = v;
      else if (Array.isArray(v) && typeof v[0] === "string") out[k] = v[0];
    }
    return out;
  }

  if (typeof detail === "string") {
    out.root = detail;
  }

  return out;
}

export function firstServerError(err: unknown): string | undefined {
  const mapped = mapServerErrors(err);
  return mapped.root ?? Object.values(mapped)[0];
}
