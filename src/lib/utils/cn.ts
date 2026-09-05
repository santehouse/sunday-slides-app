import { clsx, type ClassValue } from "clsx";

/** Join class names; last-wins is handled by keeping variants mutually exclusive. */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
