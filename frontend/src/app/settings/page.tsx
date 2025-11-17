"use client";

import type { UserProfile } from "@skylive/shared";
import { useEffect, useMemo, useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useUserProfile } from "@/hooks/useUserProfile";
import { apiFetch, ApiClientError } from "@/lib/api-client";

type ToggleDescriptor =
  | {
      id: string;
      title: string;
      description: string;
      section: "notifications";
      field: keyof UserProfile["preferences"]["notifications"];
    }
  | {
      id: string;
      title: string;
      description: string;
      section: "privacy";
      field: keyof UserProfile["preferences"]["privacy"];
    }
  | {
      id: string;
      title: string;
      description: string;
      section: "roomDefaults";
      field: "muteOnJoin" | "autoRecordSessions" | "enableSpatialAudio";
    }
  | {
      id: string;
      title: string;
      description: string;
      section: "integrations";
      field: keyof UserProfile["preferences"]["integrations"];
    };

const toggleConfig: ToggleDescriptor[] = [
  {
    id: "pref-room-reminders",
    title: "Send me room reminders",
    description: "Receive emails when a scheduled watch party is approaching.",
    section: "notifications",
    field: "roomReminders"
  },
  {
    id: "pref-product-news",
    title: "Product updates",
    description: "Hear about new cinematic features and experimental betas.",
    section: "notifications",
    field: "productNews"
  },
  {
    id: "pref-session-summary",
    title: "Send post-room summaries",
    description: "Receive a quick digest of chat, guests, and playback stats after each session.",
    section: "notifications",
    field: "sessionSummaries"
  },
  {
    id: "pref-mute-on-join",
    title: "Mute my mic on join",
    description: "Avoid surprise audio when entering a live room.",
    section: "roomDefaults",
    field: "muteOnJoin"
  },
  {
    id: "pref-auto-record",
    title: "Auto-record sessions",
    description: "Capture every hosted watch party with server-side recording.",
    section: "roomDefaults",
    field: "autoRecordSessions"
  },
  {
    id: "pref-spatial-audio",
    title: "Spatial audio",
    description: "Render remote participants with positional audio for more natural conversations.",
    section: "roomDefaults",
    field: "enableSpatialAudio"
  },
  {
    id: "pref-analytics",
    title: "Share anonymized analytics",
    description: "Help Skylive improve video sync quality with aggregated metrics.",
    section: "privacy",
    field: "analyticsSharing"
  },
  {
    id: "pref-guest-dms",
    title: "Allow guest DMs",
    description: "Let guests send you direct messages outside of active rooms.",
    section: "privacy",
    field: "allowGuestDms"
  },
  {
    id: "pref-presence",
    title: "Show live presence",
    description: "Let trusted guests see when you are online or preparing a room.",
    section: "privacy",
    field: "showPresence"
  },
  {
    id: "pref-calendar-sync",
    title: "Calendar sync",
    description: "Automatically push new sessions to your connected calendar.",
    section: "integrations",
    field: "calendarSync"
  },
  {
    id: "pref-cloud-backups",
    title: "Cloud recording backups",
    description: "Mirror session recordings to your preferred cloud storage provider.",
    section: "integrations",
    field: "cloudBackups"
  }
];

const videoQualityOptions = [
  { value: "auto", label: "Auto adapt (recommended)" },
  { value: "720p", label: "720p HD" },
  { value: "1080p", label: "1080p Full HD" }
];

export default function SettingsPage() {
  const { profile, isLoading, error, accessToken, refresh, setProfile } = useUserProfile({ redirectTo: "/settings" });
  const [preferences, setPreferences] = useState(profile?.preferences ?? null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [quality, setQuality] = useState("auto");
  const [qualitySaving, setQualitySaving] = useState(false);
  const [qualityFeedback, setQualityFeedback] = useState<string | null>(null);
  const [qualityError, setQualityError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setPreferences(profile.preferences);
      setQuality(profile.preferences.roomDefaults.defaultVideoQuality ?? "auto");
    }
  }, [profile]);

  const roleLabel = useMemo(() => (profile?.role === "host" ? "Host" : "Guest"), [profile?.role]);

  const handleToggle = async (descriptor: ToggleDescriptor, checked: boolean) => {
    if (!accessToken || !preferences) {
      return;
    }

    setSavingKey(descriptor.id);
    setFeedback(null);
    setSaveError(null);

    const previous = preferences;

    setPreferences((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        [descriptor.section]: {
          ...prev[descriptor.section],
          [descriptor.field]: checked
        }
      };
    });

    const body = {
      [descriptor.section]: {
        [descriptor.field]: checked
      }
    } as Record<string, Record<string, boolean>>;

    try {
      const updated = await apiFetch<UserProfile["preferences"], Record<string, Record<string, boolean>>>(
        "/user/preferences",
        {
          method: "PATCH",
          body,
          token: accessToken
        }
      );

      setPreferences(updated);
      setProfile((existing) => (existing ? { ...existing, preferences: updated } : existing));
      setFeedback("Preferences updated.");
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Unable to save preference.";
      setSaveError(message);
      setPreferences(previous);
    } finally {
      setSavingKey(null);
    }
  };

  const resolveToggleValue = (descriptor: ToggleDescriptor) => {
    if (!preferences) {
      return false;
    }
    const sectionValues = preferences[descriptor.section];
    const key = descriptor.field as keyof typeof sectionValues;
    return Boolean(sectionValues[key]);
  };

  const handleQualityChange = async (nextQuality: string) => {
    if (!accessToken || !preferences) {
      return;
    }

    setQuality(nextQuality);
    setQualitySaving(true);
    setQualityFeedback(null);
    setQualityError(null);

    const previous = preferences.roomDefaults.defaultVideoQuality;

    setPreferences((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        roomDefaults: {
          ...prev.roomDefaults,
          defaultVideoQuality: nextQuality as UserProfile["preferences"]["roomDefaults"]["defaultVideoQuality"]
        }
      };
    });

    try {
      const updated = await apiFetch<UserProfile["preferences"], Record<string, Record<string, string>>>(
        "/user/preferences",
        {
          method: "PATCH",
          body: {
            roomDefaults: {
              defaultVideoQuality: nextQuality
            }
          },
          token: accessToken
        }
      );

      setPreferences(updated);
      setProfile((existing) => (existing ? { ...existing, preferences: updated } : existing));
      setQualityFeedback("Room quality preference saved.");
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Unable to update default quality.";
      setQualityError(message);
      setPreferences((prev) => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          roomDefaults: {
            ...prev.roomDefaults,
            defaultVideoQuality: previous
          }
        };
      });
      setQuality(previous);
    } finally {
      setQualitySaving(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-10 px-6 py-16 text-white">
      <header className="space-y-3 text-center">
        <p className="text-sm uppercase tracking-[0.4em] text-skylive-cyan/80">Settings</p>
        <h1 className="text-4xl font-semibold">Control your cinematic setup</h1>
        <p className="text-white/60">Adjust audio, privacy, and notification defaults before hosting your next watch party.</p>
        <div className="flex justify-center gap-3">
          <Button variant="ghost" className="border border-white/20" onClick={() => void refresh()} disabled={isLoading}>
            Refresh
          </Button>
        </div>
      </header>

      {isLoading ? (
        <GlassCard className="flex min-h-40 items-center justify-center text-white/70">Loading settings…</GlassCard>
      ) : null}

      {!isLoading && error ? (
        <GlassCard className="border-red-500/40 bg-red-500/10 text-red-200">
          <p className="font-medium">{error}</p>
          <p className="mt-2 text-sm">Try refreshing, or sign back in to continue.</p>
        </GlassCard>
      ) : null}

      {!isLoading && profile && preferences ? (
        <GlassCard className="space-y-10 bg-white/10">
          <section className="grid gap-3 text-sm text-white/70">
            <h2 className="text-xl font-semibold text-white">Profile snapshot</h2>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-xl border border-white/15 bg-black/30 px-4 py-2 text-white/80">{profile.displayName}</span>
              <span className="rounded-xl border border-white/15 bg-black/20 px-4 py-2 text-white/60">{roleLabel}</span>
              <span className="rounded-xl border border-white/15 bg-black/20 px-4 py-2 text-white/60">
                Default timezone: {profile.timezone ?? "UTC"}
              </span>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-white">Preferences</h2>
              <p className="text-sm text-white/60">Toggle defaults for new rooms, email updates, and privacy.</p>
            </div>
            <div className="grid gap-6">
              <div className="grid gap-2 text-sm">
                <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-white/70">Email & alerts</h3>
                {toggleConfig
                  .filter((item) => item.section === "notifications")
                  .map((descriptor) => {
                    const checked = resolveToggleValue(descriptor);
                    return (
                      <div
                        key={descriptor.id}
                        className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-4 md:flex-row md:items-center md:justify-between"
                      >
                        <div>
                          <p className="text-sm font-medium text-white">{descriptor.title}</p>
                          <p className="text-xs text-white/60">{descriptor.description}</p>
                        </div>
                        <Switch
                          id={descriptor.id}
                          checked={checked}
                          onChange={(event) => handleToggle(descriptor, event.target.checked)}
                          aria-label={descriptor.title}
                          disabled={savingKey === descriptor.id}
                        />
                      </div>
                    );
                  })}
              </div>

              <div className="grid gap-2 text-sm">
                <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-white/70">Room defaults</h3>
                <div className="rounded-2xl border border-white/10 bg-black/35 px-4 py-4">
                  <label htmlFor="default-quality" className="text-sm font-medium text-white">
                    Default streaming quality
                  </label>
                  <p className="text-xs text-white/60">Choose the fallback quality for new rooms before adaptive bitrate kicks in.</p>
                  <select
                    id="default-quality"
                    value={quality}
                    onChange={(event) => handleQualityChange(event.target.value)}
                    disabled={qualitySaving}
                    className="mt-3 h-11 w-full rounded-xl border border-white/15 bg-black/50 px-3 text-sm text-white focus:border-skylive-cyan focus:outline-none"
                  >
                    {videoQualityOptions.map((option) => (
                      <option key={option.value} value={option.value} className="bg-black text-white">
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {qualityFeedback ? <p className="mt-2 text-xs text-emerald-300">{qualityFeedback}</p> : null}
                  {qualityError ? <p className="mt-2 text-xs text-red-300">{qualityError}</p> : null}
                </div>
                {toggleConfig
                  .filter((item) => item.section === "roomDefaults")
                  .map((descriptor) => {
                    const checked = resolveToggleValue(descriptor);
                    return (
                      <div
                        key={descriptor.id}
                        className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-4 md:flex-row md:items-center md:justify-between"
                      >
                        <div>
                          <p className="text-sm font-medium text-white">{descriptor.title}</p>
                          <p className="text-xs text-white/60">{descriptor.description}</p>
                        </div>
                        <Switch
                          id={descriptor.id}
                          checked={checked}
                          onChange={(event) => handleToggle(descriptor, event.target.checked)}
                          aria-label={descriptor.title}
                          disabled={savingKey === descriptor.id}
                        />
                      </div>
                    );
                  })}
              </div>

              <div className="grid gap-2 text-sm">
                <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-white/70">Privacy & presence</h3>
                {toggleConfig
                  .filter((item) => item.section === "privacy")
                  .map((descriptor) => {
                    const checked = resolveToggleValue(descriptor);
                    return (
                      <div
                        key={descriptor.id}
                        className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-4 md:flex-row md:items-center md:justify-between"
                      >
                        <div>
                          <p className="text-sm font-medium text-white">{descriptor.title}</p>
                          <p className="text-xs text-white/60">{descriptor.description}</p>
                        </div>
                        <Switch
                          id={descriptor.id}
                          checked={checked}
                          onChange={(event) => handleToggle(descriptor, event.target.checked)}
                          aria-label={descriptor.title}
                          disabled={savingKey === descriptor.id}
                        />
                      </div>
                    );
                  })}
              </div>

              <div className="grid gap-2 text-sm">
                <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-white/70">Integrations</h3>
                {toggleConfig
                  .filter((item) => item.section === "integrations")
                  .map((descriptor) => {
                    const checked = resolveToggleValue(descriptor);
                    return (
                      <div
                        key={descriptor.id}
                        className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-4 md:flex-row md:items-center md:justify-between"
                      >
                        <div>
                          <p className="text-sm font-medium text-white">{descriptor.title}</p>
                          <p className="text-xs text-white/60">{descriptor.description}</p>
                        </div>
                        <Switch
                          id={descriptor.id}
                          checked={checked}
                          onChange={(event) => handleToggle(descriptor, event.target.checked)}
                          aria-label={descriptor.title}
                          disabled={savingKey === descriptor.id}
                        />
                      </div>
                    );
                  })}
              </div>
            </div>
            {feedback ? <p className="text-sm text-emerald-300">{feedback}</p> : null}
            {saveError ? <p className="text-sm text-red-300">{saveError}</p> : null}
          </section>
        </GlassCard>
      ) : null}
    </main>
  );
}
