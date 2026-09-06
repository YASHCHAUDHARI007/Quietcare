import type { Medicine } from "@/types/quietcare";

export function calculateCoverage(items: Medicine[]): number {
  return Math.min(...items.map((medicine) => Math.floor(medicine.quantity / 2)), 7);
}
