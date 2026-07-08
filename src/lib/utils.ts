import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const IST: Intl.DateTimeFormatOptions = { timeZone: "Asia/Kolkata" };

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(new Date(iso).toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(new Date(iso).toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()} ${hh}:${min}`;
}

/** Safely extract a string message from an Axios error.
 *  Handles FastAPI/Pydantic 422 responses where detail is an array of objects.
 *  Returns "" for cancelled requests (e.g. writes blocked in a support session)
 *  — the interceptor already toasted, so callers can `toast.error(msg)` safely
 *  without double-toasting. Pair with `if (msg) toast.error(msg)`. */
export function getApiError(err: any, fallback = "Something went wrong"): string {
  if (err?.__CANCEL__ || err?.constructor?.name === "Cancel") return "";
  const detail = err?.response?.data?.detail;
  if (!detail) return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((e: any) => e?.msg ?? JSON.stringify(e)).join("; ");
  }
  return fallback;
}
