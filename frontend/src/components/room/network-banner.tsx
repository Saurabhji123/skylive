import { cn } from "@/lib/utils";

interface NetworkBannerProps {
  quality: "excellent" | "good" | "poor" | "critical";
  rtt?: number;
  jitter?: number;
  reconnecting?: boolean;
  reconnectAttempts?: number;
}

const qualityCopy: Record<NetworkBannerProps["quality"], { label: string; tone: string }> = {
  excellent: { label: "Excellent connection", tone: "text-emerald-300" },
  good: { label: "Stable connection", tone: "text-skylive-cyan" },
  poor: { label: "Network jitter detected", tone: "text-amber-300" },
  critical: { label: "Connection unstable", tone: "text-red-300" }
};

export function NetworkBanner({ quality, rtt, jitter, reconnecting, reconnectAttempts }: NetworkBannerProps) {
  const copy = qualityCopy[quality];
  const tone = reconnecting ? "text-amber-300 animate-pulse" : copy.tone;
  const label = reconnecting ? "Reconnecting..." : copy.label;
  const detail = reconnecting ? `Attempt ${reconnectAttempts ?? 1}` : undefined;
  const metrics: string[] = [];
  if (rtt !== undefined) {
    metrics.push(`RTT ${rtt}ms`);
  }
  if (jitter !== undefined) {
    metrics.push(`Jitter ${jitter}ms`);
  }
  const metricsText = metrics.join(" · ");
  const trailingCopy = detail ? `${detail}${metricsText ? ` - ${metricsText}` : ""}` : metricsText;
  return (
    <div className={cn("flex items-center justify-between rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-sm", tone)}>
      <span>{label}</span>
      <span className="text-white/60">{trailingCopy}</span>
    </div>
  );
}
