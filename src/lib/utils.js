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
