import { QuietcareRepository } from "./repository";
import type { QuietcareAppState } from "@/types/quietcare";

export async function getStore(): Promise<QuietcareAppState> {
  return QuietcareRepository.getState();
}

export async function updateStore(
  updater: (prev: QuietcareAppState) => QuietcareAppState
): Promise<QuietcareAppState> {
  return QuietcareRepository.updateState(updater);
}

export async function resetStore(): Promise<QuietcareAppState> {
  return QuietcareRepository.resetState();
}
