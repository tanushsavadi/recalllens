/**
 * Shared outbreak/case state hooks. The background globe and the page panels
 * all read from the same polled queries so the globe reflects the SAME on-chain
 * state the panels show (the convergence is never a standalone frontend flag).
 */
import { useQuery } from "@tanstack/react-query";
import { create } from "zustand";
import { api, DEMO_CASE_ID } from "./api";

export function useOutbreak() {
  return useQuery({
    queryKey: ["outbreak"],
    queryFn: api.outbreak,
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  });
}

export function useCaseStatus() {
  return useQuery({
    queryKey: ["case", DEMO_CASE_ID],
    queryFn: () => api.caseStatus(DEMO_CASE_ID),
    refetchInterval: 3500,
  });
}

/** "Replay convergence" nonce — replays the globe camera without a new proof. */
interface ReplayState {
  nonce: number;
  replay: () => void;
}
export const useReplay = create<ReplayState>((set, get) => ({
  nonce: 0,
  replay: () => set({ nonce: get().nonce + 1 }),
}));

/** Convenience selector for the globe. */
export function useOutbreakState() {
  const outbreak = useOutbreak();
  const status = useCaseStatus();
  const nonce = useReplay((s) => s.nonce);
  return {
    affectedStates: outbreak.data?.snapshot.outbreak.states ?? [
      "Indiana",
      "Kentucky",
      "Michigan",
      "Ohio",
      "West Virginia",
    ],
    confirmedCount: status.data?.chain.matchCount ?? 0,
    converged: status.data?.chain.converged ?? false,
    replayNonce: nonce,
  };
}
