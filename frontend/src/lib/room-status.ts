import type { RoomSummary } from "@skylive/shared";

export const roomStatusTokens: Record<RoomSummary["status"], { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-white/10 text-white/70" },
  live: { label: "Live", className: "bg-emerald-500/20 text-emerald-200" },
  ended: { label: "Ended", className: "bg-blue-500/20 text-blue-200" },
  suspended: { label: "Suspended", className: "bg-red-500/15 text-red-200" }
};
