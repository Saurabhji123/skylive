"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { AvatarAsset, RoomStats, UserProfile } from "@skylive/shared";
import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiFetch, ApiClientError, buildApiUrl } from "@/lib/api-client";
import { resolveAvatarUrl } from "@/lib/media";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useSessionStore } from "@/store/session-store";

const timezoneOptions = [
  { value: "UTC", label: "Coordinated Universal Time (UTC)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "Europe/London", label: "London (BST/GMT)" },
  { value: "Asia/Kolkata", label: "India (IST)" }
];

const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024;
const ACCEPTED_AVATAR_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return "";
  }

  const parts = trimmed.split(/\s+/).slice(0, 2);
  const initials = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  return initials || trimmed[0]?.toUpperCase() || "";
}

export default function ProfilePage() {
  const { profile, isLoading, error: loadError, refresh, setProfile, accessToken } = useUserProfile({ redirectTo: "/profile" });
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarRevision, setAvatarRevision] = useState<number>(0);
  const [bio, setBio] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [roomStats, setRoomStats] = useState<RoomStats | null>(null);
  const [roomStatsFetchedAt, setRoomStatsFetchedAt] = useState<string | null>(null);
  const [roomStatsError, setRoomStatsError] = useState<string | null>(null);
  const [roomStatsLoading, setRoomStatsLoading] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const computeAvatarRevision = useCallback((avatar: AvatarAsset | null | undefined, fallbackUrl: string | null | undefined) => {
    if (avatar?.uploadedAt) {
      const timestamp = Date.parse(avatar.uploadedAt);
      if (!Number.isNaN(timestamp)) {
        return timestamp;
      }
    }

    if (fallbackUrl && fallbackUrl.trim().length > 0) {
      return Date.now();
    }

    return 0;
  }, []);

  useEffect(() => {
    if (!profile) {
      return;
    }
    setDisplayName(profile.displayName ?? "");
    const baseAvatarPath = profile.avatar?.publicPath ?? profile.avatarUrl ?? "";
    setAvatarUrl(baseAvatarPath);
    setBio(profile.bio ?? "");
    setTimezone(profile.timezone ?? "UTC");
    setAvatarUploadError(null);
    setAvatarRevision(computeAvatarRevision(profile.avatar, profile.avatarUrl ?? null));
  }, [computeAvatarRevision, profile]);

  const fetchRoomStats = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setRoomStatsLoading(true);
    try {
      const data = await apiFetch<{ stats?: RoomStats }>("/rooms?limit=1&includeStats=true", {
        method: "GET",
        token: accessToken
      });

      setRoomStats(data.stats ?? null);
      setRoomStatsFetchedAt(new Date().toISOString());
      setRoomStatsError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load room metrics.";
      setRoomStatsError(message);
    } finally {
      setRoomStatsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    void fetchRoomStats();
  }, [accessToken, fetchRoomStats]);

  const liveRooms = roomStats?.live ?? profile?.stats.activeRooms ?? 0;
  const pendingRooms = roomStats?.pending ?? 0;
  const suspendedRooms = roomStats?.suspended ?? 0;
  const totalRoomsHosted = roomStats?.total ?? profile?.stats.roomsHosted ?? 0;

  const statusCard = useMemo(() => {
    if (liveRooms > 0) {
      return {
        surface: "border-emerald-400/40 bg-emerald-500/10",
        labelClass: "text-emerald-200",
        title: "Hosting live",
        subtitle: `${liveRooms} active ${liveRooms === 1 ? "session" : "sessions"}`
      };
    }

    if (pendingRooms > 0) {
      return {
        surface: "border-sky-400/30 bg-sky-500/10",
        labelClass: "text-sky-200",
        title: "Standing by",
        subtitle: `${pendingRooms} ${pendingRooms === 1 ? "room" : "rooms"} ready to launch`
      };
    }

    if (suspendedRooms > 0) {
      return {
        surface: "border-amber-400/40 bg-amber-500/10",
        labelClass: "text-amber-200",
        title: "Attention required",
        subtitle: `${suspendedRooms} ${suspendedRooms === 1 ? "room" : "rooms"} recently suspended`
      };
    }

    return {
      surface: "border-white/12 bg-black/40",
      labelClass: "text-white/60",
      title: "Offline",
      subtitle: "No live rooms at the moment"
    };
  }, [liveRooms, pendingRooms, suspendedRooms]);

  const clusterMetrics = useMemo(() => {
    if (!profile) {
      return [] as Array<{ label: string; value: number }>;
    }

    const metrics: Array<{ label: string; value: number }> = [
      { label: "Rooms hosted", value: totalRoomsHosted },
      { label: "Live rooms", value: liveRooms },
      { label: "Pending launch", value: pendingRooms }
    ];

    if (roomStats || suspendedRooms > 0) {
      metrics.push({ label: "Suspended", value: suspendedRooms });
    }

    if (roomStats) {
      metrics.push({ label: "Sessions ended", value: roomStats.ended });
    }

    metrics.push({ label: "Guests total", value: profile.stats.totalGuests });
    metrics.push({ label: "Unique guests", value: profile.stats.uniqueGuests });

    return metrics;
  }, [liveRooms, pendingRooms, profile, roomStats, suspendedRooms, totalRoomsHosted]);

  const preferenceSummary = useMemo(() => {
    if (!profile) {
      return [] as Array<{ label: string; value: string }>;
    }

    const qualityLabels: Record<UserProfile["preferences"]["roomDefaults"]["defaultVideoQuality"], string> = {
      auto: "Auto adaptive",
      "720p": "720p HD",
      "1080p": "1080p Full HD"
    };

    return [
      {
        label: "Room reminders",
        value: profile.preferences.notifications.roomReminders ? "On" : "Off"
      },
      {
        label: "Product updates",
        value: profile.preferences.notifications.productNews ? "Subscribed" : "Muted"
      },
      {
        label: "Session summaries",
        value: profile.preferences.notifications.sessionSummaries ? "Delivered" : "Off"
      },
      {
        label: "Auto-record sessions",
        value: profile.preferences.roomDefaults.autoRecordSessions ? "Enabled" : "Disabled"
      },
      {
        label: "Mute on join",
        value: profile.preferences.roomDefaults.muteOnJoin ? "Enabled" : "Disabled"
      },
      {
        label: "Spatial audio",
        value: profile.preferences.roomDefaults.enableSpatialAudio ? "On" : "Off"
      },
      {
        label: "Default quality",
        value: qualityLabels[profile.preferences.roomDefaults.defaultVideoQuality]
      },
      {
        label: "Presence visibility",
        value: profile.preferences.privacy.showPresence ? "Visible" : "Hidden"
      }
    ];
  }, [profile]);

  const formatDateTime = (iso?: string) => {
    if (!iso) {
      return "—";
    }
    try {
      return new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  const statsTimestampSource = roomStatsFetchedAt ?? profile?.lastLogin ?? null;
  const formattedStatsTime = formatDateTime(statsTimestampSource ?? undefined);
  const isRefreshing = isLoading || roomStatsLoading;
  const avatarInitials = useMemo(() => getInitials(displayName || profile?.displayName || ""), [displayName, profile?.displayName]);
  const avatarPreviewUrl = useMemo(() => {
    const resolved = resolveAvatarUrl(avatarUrl);
    if (!resolved) {
      return undefined;
    }

    if (!avatarRevision) {
      return resolved;
    }

    const separator = resolved.includes("?") ? "&" : "?";
    return `${resolved}${separator}v=${avatarRevision}`;
  }, [avatarRevision, avatarUrl]);
  const hasAvatar = Boolean(avatarPreviewUrl);

  const handleRefresh = useCallback(() => {
    void refresh();
    void fetchRoomStats();
  }, [fetchRoomStats, refresh]);

  const handleAvatarUploadClick = useCallback(() => {
    setAvatarUploadError(null);
    fileInputRef.current?.click();
  }, []);

  const handleAvatarFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";

      if (!file) {
        return;
      }

      if (!accessToken) {
        setAvatarUploadError("You need to be signed in to upload an avatar.");
        return;
      }

      if (file.size > MAX_AVATAR_SIZE_BYTES) {
        setAvatarUploadError("Avatar must be 2 MB or smaller.");
        return;
      }

      if (!ACCEPTED_AVATAR_TYPES.has(file.type)) {
        setAvatarUploadError("Use PNG, JPG, or WEBP images.");
        return;
      }

      setIsUploadingAvatar(true);
      setAvatarUploadError(null);
      setUpdateError(null);
      setSuccess(null);

      try {
        const formData = new FormData();
        formData.append("avatar", file);

        const response = await fetch(buildApiUrl("/user/avatar"), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`
          },
          body: formData,
          credentials: "include"
        });

        const payload = (await response.json().catch(() => null)) as {
          success?: boolean;
          data?: UserProfile;
          error?: string;
        } | null;

        if (!response.ok || !payload || payload.success !== true || !payload.data) {
          const message = payload?.error ?? "Unable to upload avatar.";
          throw new Error(message);
        }

        const updated = payload.data;
        const version = computeAvatarRevision(updated.avatar, updated.avatarUrl ?? null) || Date.now();
        const baseAvatarPath = updated.avatar?.publicPath ?? updated.avatarUrl;
        setProfile(updated);
        setDisplayName(updated.displayName ?? "");
        setAvatarUrl(baseAvatarPath ?? "");
        setBio(updated.bio ?? "");
        setTimezone(updated.timezone ?? "UTC");
        setAvatarRevision(version);

        const resolvedAvatar = resolveAvatarUrl(baseAvatarPath);
        const versionedAvatar = resolvedAvatar ? `${resolvedAvatar}${resolvedAvatar.includes("?") ? "&" : "?"}v=${version}` : undefined;

        useSessionStore.setState((state) => ({
          ...state,
          displayName: updated.displayName,
          avatarUrl: versionedAvatar,
          avatar: updated.avatar ? { ...updated.avatar } : undefined
        }));

        setSuccess("Avatar updated successfully.");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to upload avatar.";
        setAvatarUploadError(message);
      } finally {
        setIsUploadingAvatar(false);
      }
    },
    [accessToken, setProfile]
  );

  const handleAvatarRemove = useCallback(() => {
    setAvatarUploadError(null);
    setSuccess(null);
    setUpdateError(null);
    setAvatarUrl("");
    setAvatarRevision(0);
  }, []);

  const hasChanges = useMemo(() => {
    if (!profile) {
      return false;
    }

    return (
      displayName.trim() !== profile.displayName.trim() ||
      avatarUrl.trim() !== (profile.avatarUrl ?? "").trim() ||
      bio.trim() !== (profile.bio ?? "").trim() ||
      timezone !== (profile.timezone ?? "UTC")
    );
  }, [avatarUrl, bio, displayName, profile, timezone]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!profile || !accessToken || !hasChanges) {
      return;
    }

    const nextPayload: Record<string, string> = {};
    const trimmedName = displayName.trim();
    const trimmedAvatar = avatarUrl.trim();
    const trimmedBio = bio.trim();

    if (trimmedName !== profile.displayName.trim()) {
      nextPayload.displayName = trimmedName;
    }

    if (trimmedAvatar !== (profile.avatarUrl ?? "").trim()) {
      nextPayload.avatarUrl = trimmedAvatar;
    }

    if (trimmedBio !== (profile.bio ?? "").trim()) {
      nextPayload.bio = trimmedBio;
    }

    if (timezone !== (profile.timezone ?? "UTC")) {
      nextPayload.timezone = timezone;
    }

    if (!Object.keys(nextPayload).length) {
      return;
    }

    try {
      setSaving(true);
      setSuccess(null);
      setUpdateError(null);

      const updated = await apiFetch<UserProfile, typeof nextPayload>("/user/profile", {
        method: "PATCH",
        body: nextPayload,
        token: accessToken
      });

      setProfile(updated);
      setDisplayName(updated.displayName);
      const baseAvatarPath = updated.avatar?.publicPath ?? updated.avatarUrl;
      setAvatarUrl(baseAvatarPath ?? "");
      setBio(updated.bio ?? "");
      setTimezone(updated.timezone ?? "UTC");

      const nextVersion = computeAvatarRevision(updated.avatar, updated.avatarUrl ?? null);
      setAvatarRevision(nextVersion);

      const resolvedAvatar = resolveAvatarUrl(baseAvatarPath);
      const versionedAvatar = resolvedAvatar && nextVersion
        ? `${resolvedAvatar}${resolvedAvatar.includes("?") ? "&" : "?"}v=${nextVersion}`
        : resolvedAvatar;

      useSessionStore.setState((state) => ({
        ...state,
        displayName: updated.displayName,
        avatarUrl: versionedAvatar,
        avatar: updated.avatar ? { ...updated.avatar } : undefined
      }));

      setSuccess("Profile updated successfully.");
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Unable to update profile.";
      setUpdateError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 pb-24 pt-8">
      <div className="flex flex-col gap-6 text-white lg:flex-row lg:items-stretch">
        <GlassCard className="flex-1 space-y-6 bg-white/10 p-6 sm:p-8">
          <header className="flex flex-col gap-3">
            <p className="text-sm uppercase tracking-[0.4em] text-skylive-cyan/80">Account</p>
            <h1 className="text-4xl font-semibold">Host control center</h1>
            <p className="max-w-2xl text-sm text-white/70">
              Manage your host identity, monitor live session momentum, and keep guests aligned with your brand.
            </p>
          </header>
          {profile ? (
            <div className="grid gap-4 md:grid-cols-3">
              <div className={`rounded-2xl border px-4 py-4 ${statusCard.surface}`}>
                <p className={`text-xs font-semibold uppercase tracking-[0.28em] ${statusCard.labelClass}`}>Status</p>
                <p className="mt-2 text-lg font-semibold text-white">{statusCard.title}</p>
                <p className="text-xs text-white/70">{statusCard.subtitle}</p>
              </div>
              <div className="rounded-2xl border border-white/12 bg-black/35 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/60">Profile ID</p>
                <p className="mt-2 text-lg font-semibold text-white">{profile.id.slice(0, 8)}…</p>
                <p className="text-xs text-white/60">Share this when our support team needs to trace a session.</p>
              </div>
              <div className="rounded-2xl border border-white/12 bg-black/35 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/60">Data freshness</p>
                <p className="mt-2 text-lg font-semibold text-white">{formattedStatsTime}</p>
                <p className="text-xs text-white/60">
                  {roomStatsLoading ? "Refreshing metrics…" : roomStatsError ? "Some figures may be out of date." : "Includes profile and room activity."}
                </p>
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="ghost"
              className="border border-white/20"
              onClick={handleRefresh}
              disabled={isRefreshing}
              isLoading={isRefreshing}
            >
              Refresh data
            </Button>
            <Link href="/settings">
              <Button variant="secondary">Open settings</Button>
            </Link>
            <Link href="/rooms/create">
              <Button variant="ghost" className="border border-white/10">
                Create new room
              </Button>
            </Link>
          </div>
        </GlassCard>
        {profile ? (
          <GlassCard className="w-full max-w-md space-y-5 p-6">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">Activity metrics</h2>
              <p className="text-sm text-white/60">Live view of your hosting footprint.</p>
            </div>
            {clusterMetrics.length ? (
              <dl className="grid gap-3 sm:grid-cols-2">
                {clusterMetrics.map((item) => (
                  <div key={item.label} className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                    <dt className="text-xs uppercase tracking-[0.24em] text-white/50">{item.label}</dt>
                    <dd className="text-lg font-semibold text-white">{item.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-white/60">Metrics will appear after your first hosted session.</p>
            )}
            <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-xs text-white/60">
              <p>
                Metrics refreshed {formattedStatsTime}. Contact email <span className="text-white/80">{profile.email}</span>
              </p>
              {roomStatsError ? <p className="pt-1 text-amber-200/80">{roomStatsError}</p> : null}
            </div>
          </GlassCard>
        ) : null}
      </div>

      {isLoading ? (
        <GlassCard className="flex min-h-64 items-center justify-center text-white/70">Loading your profile…</GlassCard>
      ) : null}

      {!isLoading && loadError ? (
        <GlassCard className="border-red-500/40 bg-red-500/10 text-red-200">
          <p className="font-medium">{loadError}</p>
          <p className="mt-2 text-sm">Please refresh the page or try again later.</p>
        </GlassCard>
      ) : null}

      {!isLoading && profile ? (
        <section className="grid gap-8 lg:grid-cols-[1.8fr,1.2fr]">
          <GlassCard className="space-y-7">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Identity & presence</h2>
                <p className="text-sm text-white/60">Update what your guests see across every synced device.</p>
              </div>
              <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-white/60">Timezone: {timezone}</span>
            </div>
            <form className="grid gap-5" onSubmit={handleSubmit}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleAvatarFileChange}
              />
              <div className="flex flex-col gap-4 rounded-2xl border border-white/15 bg-black/40 px-4 py-4 md:flex-row md:items-center">
                <div className="relative h-24 w-24 overflow-hidden rounded-full border border-white/20 bg-black/60">
                  {hasAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarPreviewUrl} alt="Profile avatar preview" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-white/40">
                      {avatarInitials || "*"}
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-2 text-sm text-white/70">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAvatarUploadClick}
                      isLoading={isUploadingAvatar}
                      disabled={!accessToken || isUploadingAvatar}
                    >
                      Upload avatar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="border border-white/20"
                      onClick={handleAvatarRemove}
                      disabled={isUploadingAvatar || !accessToken || (!hasAvatar && !(profile?.avatarUrl))}
                    >
                      Remove
                    </Button>
                  </div>
                  <p className="text-xs text-white/50">PNG, JPG, or WEBP up to 2 MB.</p>
                  {avatarUploadError ? <p className="text-xs text-red-300">{avatarUploadError}</p> : null}
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-2 md:gap-3">
                <div className="grid gap-2">
                  <label htmlFor="displayName" className="text-sm font-medium text-white/80">
                    Display name
                  </label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Your name"
                    maxLength={64}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="timezone" className="text-sm font-medium text-white/80">
                    Timezone
                  </label>
                  <select
                    id="timezone"
                    value={timezone}
                    onChange={(event) => setTimezone(event.target.value)}
                    className="h-11 w-full rounded-xl border border-white/15 bg-black/40 px-3 text-sm text-white shadow-inner focus:border-skylive-cyan focus:outline-none"
                  >
                    {timezoneOptions.map((option) => (
                      <option key={option.value} value={option.value} className="bg-black text-white">
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-2">
                <label htmlFor="bio" className="text-sm font-medium text-white/80">
                  Host bio
                </label>
                <textarea
                  id="bio"
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  maxLength={280}
                  rows={4}
                  placeholder="Share a short introduction for your guests."
                  className="w-full rounded-2xl border border-white/15 bg-black/30 px-3 py-3 text-sm text-white shadow-inner focus:border-skylive-cyan focus:outline-none"
                />
                <p className="text-xs text-white/50">{bio.length}/280 characters</p>
              </div>
              <div className="grid gap-1 text-sm text-white/60">
                <p>
                  Email <span className="font-semibold text-white/80">{profile.email}</span>
                </p>
                <p>Member since {formatDateTime(profile.createdAt)}</p>
                <p>Last login {formatDateTime(profile.lastLogin)}</p>
              </div>
              {success ? <p className="text-sm text-emerald-300">{success}</p> : null}
              {updateError ? <p className="text-sm text-red-300">{updateError}</p> : null}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button type="submit" size="lg" disabled={!hasChanges} isLoading={saving}>
                  Save profile
                </Button>
                <Link href="/support/reset" className="text-sm text-white/60 transition hover:text-white">
                  Reset password
                </Link>
              </div>
            </form>
          </GlassCard>

          <div className="grid gap-6">
            <GlassCard className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Preference snapshot</h2>
                  <p className="text-sm text-white/60">Live pull from your saved preferences.</p>
                </div>
                <Link href="/settings" className="text-sm text-skylive-cyan hover:text-white">
                  Adjust
                </Link>
              </div>
              <ul className="space-y-3 text-sm text-white/70">
                {preferenceSummary.map((item) => (
                  <li key={item.label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
                    <span>{item.label}</span>
                    <span className="font-semibold text-white">{item.value}</span>
                  </li>
                ))}
              </ul>
            </GlassCard>

          </div>
        </section>
      ) : null}
    </div>
  );
}
