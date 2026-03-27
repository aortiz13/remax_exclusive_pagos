import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
    return twMerge(clsx(inputs))
}

/**
 * Returns a local ISO string (YYYY-MM-DDTHH:mm) without UTC shift.
 * Useful for initializing <input type="datetime-local">
 */
export function toISOLocal(date = new Date()) {
    const d = new Date(date);
    const z = d.getTimezoneOffset() * 60 * 1000;
    const local = new Date(d - z);
    return local.toISOString().slice(0, 16);
}

/**
 * Convert a datetime-local input string (e.g. "2026-03-27T11:23") to a proper
 * UTC ISO string for DB storage (e.g. "2026-03-27T14:23:00.000Z").
 * new Date() interprets strings without 'Z' as local time, so .toISOString()
 * correctly produces the UTC equivalent.
 */
export function localToISO(localStr) {
    return new Date(localStr).toISOString();
}
