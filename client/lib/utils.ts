import { clsx, type ClassValue } from "clsx";
import type { Route } from "next";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function asRoute(path: string): Route {
  return path as Route;
}
