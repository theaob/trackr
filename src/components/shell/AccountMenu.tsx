"use client";

import React, { useRef, useState } from "react";
import { Camera, ChevronsUpDown, Keyboard, KeyRound, LayoutTemplate, Loader2, LogOut, ShieldCheck, Trash2 } from "lucide-react";
import { useCurrentUser } from "@/context/UserContext";
import { useKeyboardShortcutsContext } from "@/context/KeyboardShortcutsContext";
import { useAccountActions } from "@/hooks/useAccountActions";
import { useProjectPermissions } from "@/hooks/useProjectPermissions";
import UserAvatar from "@/components/common/UserAvatar";
import PersonalAccessTokensModal from "@/components/auth/PersonalAccessTokensModal";
import AccountSecurityModal from "@/components/auth/AccountSecurityModal";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/Menu";
import { cn } from "@/components/ui/cn";
import type { Project } from "@/types";
import AppearanceMenuItems from "./AppearanceMenuItems";

/**
 * The foot of the rail: who is signed in, and everything about their account.
 * The role badge that used to sit in the top bar lives here now.
 */
export default function AccountMenu({ collapsed, currentProject }: { collapsed: boolean; currentProject?: Project | null }) {
  const { currentUser } = useCurrentUser();
  const permissions = useProjectPermissions(currentProject);
  const { openShortcutsModal } = useKeyboardShortcutsContext();
  const { avatarUploading, uploadAvatar, deleteAvatar, signingOut, signOut, switchingLayout, switchLayout } = useAccountActions();
  const [showTokens, setShowTokens] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);

  if (!currentUser) return null;

  return (
    <>
      <input
        ref={avatarInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) await uploadAvatar(file);
          e.target.value = "";
        }}
      />
      <Menu>
        <MenuTrigger asChild>
          <button
            type="button"
            aria-label={collapsed ? `Account: ${currentUser.name}` : undefined}
            className={cn(
              "flex w-full items-center gap-2 rounded-control p-1.5 text-left transition-colors hover:bg-surface",
              collapsed && "justify-center"
            )}
          >
            <span aria-hidden="true">
              <UserAvatar user={currentUser} size="md" />
            </span>
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">{currentUser.name}</span>
                  <span className="block truncate text-xs text-muted">{currentUser.email}</span>
                </span>
                <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              </>
            )}
          </button>
        </MenuTrigger>
        <MenuContent side="top" align="start" className="w-64">
          <MenuLabel className="normal-case tracking-normal">
            <span className="block text-[13px] font-semibold text-ink">{currentUser.name}</span>
            <span className="block text-xs font-normal text-muted">{currentUser.role}</span>
            {currentProject && (
              <span className="mt-1 block text-xs font-normal text-ink-2">
                {currentProject.key}: {permissions.roleConfig.name}
              </span>
            )}
          </MenuLabel>
          <MenuSeparator />
          <MenuItem
            icon={avatarUploading ? <Loader2 className="animate-spin" /> : <Camera />}
            disabled={avatarUploading}
            onSelect={() => avatarInput.current?.click()}
          >
            {currentUser.avatarUrl ? "Change avatar" : "Upload avatar"}
          </MenuItem>
          {currentUser.avatarUrl && (
            <MenuItem icon={<Trash2 />} disabled={avatarUploading} onSelect={deleteAvatar}>
              Remove avatar
            </MenuItem>
          )}
          <MenuItem icon={<KeyRound />} onSelect={() => setShowTokens(true)}>
            Personal access tokens
          </MenuItem>
          <MenuItem icon={<ShieldCheck />} onSelect={() => setShowSecurity(true)}>
            Password &amp; sessions
          </MenuItem>
          <MenuItem icon={<Keyboard />} shortcut="?" onSelect={openShortcutsModal}>
            Keyboard shortcuts
          </MenuItem>
          <MenuSeparator />
          <AppearanceMenuItems />
          <MenuSeparator />
          <MenuItem
            icon={switchingLayout ? <Loader2 className="animate-spin" /> : <LayoutTemplate />}
            disabled={switchingLayout}
            onSelect={() => switchLayout(false)}
          >
            Use the classic layout
          </MenuItem>
          <MenuItem icon={signingOut ? <Loader2 className="animate-spin" /> : <LogOut />} disabled={signingOut} onSelect={signOut}>
            Sign out
          </MenuItem>
        </MenuContent>
      </Menu>
      <PersonalAccessTokensModal isOpen={showTokens} onClose={() => setShowTokens(false)} />
      <AccountSecurityModal isOpen={showSecurity} onClose={() => setShowSecurity(false)} />
    </>
  );
}
