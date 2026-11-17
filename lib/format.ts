import axios from "axios";

/** Readable message from an API / network / JS error. */
export function errorMessage(e: unknown) {
  return axios.isAxiosError(e)
    ? String(e.response?.data?.message || e.message)
    : e instanceof Error
      ? e.message
      : "Could not complete this request";
}

/** "in_progress" -> "In Progress" */
export const label = (s?: string) =>
  String(s || "—")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
