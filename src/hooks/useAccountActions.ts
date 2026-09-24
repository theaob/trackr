"use client";

import { useState } from "react";
import { useCurrentUser } from "@/context/UserContext";
import { logout } from "@/lib/actions/auth";
import { setNewLayout } from "@/lib/actions/preferences";

/**
 * What the account menu can do, shared by the classic navbar and the new
 * rail: change or remove the avatar, sign out, and switch layouts.
 */
export function useAccountActions() {
  const { currentUser, users, setCurrentUser, setUsers } = useCurrentUser();
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [switchingLayout, setSwitchingLayout] = useState(false);

  const updateAvatar = (avatarUrl: string | null) => {
    if (!currentUser) return;
    setCurrentUser({ ...currentUser, avatarUrl });
    setUsers(users.map((u) => (u.id === currentUser.id ? { ...u, avatarUrl } : u)));
  };

  const uploadAvatar = async (file: File) => {
    if (!currentUser) return;
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const res = await fetch(`/api/v1/users/${currentUser.id}/avatar`, { method: "POST", body: formData });
      if (res.ok) updateAvatar((await res.json()).user.avatarUrl);
    } catch (err) {
      console.error("Avatar upload failed:", err);
    } finally {
      setAvatarUploading(false);
    }
  };

  const deleteAvatar = async () => {
    if (!currentUser) return;
    setAvatarUploading(true);
    try {
      const res = await fetch(`/api/v1/users/${currentUser.id}/avatar`, { method: "DELETE" });
      if (res.ok) updateAvatar(null);
    } catch (err) {
      console.error("Avatar delete failed:", err);
    } finally {
      setAvatarUploading(false);
    }
  };

  const signOut = async () => {
    setSigningOut(true);
    try {
      await logout();
      // Full navigation, for the same reason as sign-in: a client-side replace
      // racing a refresh can leave stale session state on screen.
      window.location.assign("/login");
    } catch {
      setSigningOut(false);
    }
  };

  /** Saves the choice and reloads, so every server-rendered part switches together. */
  const switchLayout = async (enabled: boolean) => {
    setSwitchingLayout(true);
    const res = await setNewLayout(enabled);
    if (!res.success) {
      setSwitchingLayout(false);
      return;
    }
    // Home and Inbox only exist in the new layout; elsewhere, stay put.
    const onNewOnlyPage = /^\/(home|inbox)(\/|$)/.test(window.location.pathname);
    if (enabled) window.location.assign("/home");
    else if (onNewOnlyPage) window.location.assign("/projects");
    else window.location.reload();
  };

  return { avatarUploading, uploadAvatar, deleteAvatar, signingOut, signOut, switchingLayout, switchLayout };
}
