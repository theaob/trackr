"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User } from "@/types";

interface UserContextType {
  currentUser: User | null;
  users: User[];
  setCurrentUser: (user: User) => void;
  setUsers: (users: User[]) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

/**
 * Holds the signed-in user for client components.
 *
 * `sessionUser` is resolved on the server from the session cookie; this context
 * only mirrors it for rendering. Changing it here grants nothing -- every
 * server action re-derives the caller from the cookie.
 */
export function UserProvider({
  children,
  sessionUser = null,
  initialUsers = [],
}: {
  children?: React.ReactNode;
  sessionUser?: User | null;
  initialUsers?: User[];
}) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [currentUser, setCurrentUser] = useState<User | null>(sessionUser);

  // Keep in step with the server when the session changes (sign in or out).
  useEffect(() => {
    setCurrentUser(sessionUser);
  }, [sessionUser]);

  return (
    <UserContext.Provider
      value={{
        currentUser,
        users,
        setCurrentUser,
        setUsers,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useCurrentUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useCurrentUser must be used within a UserProvider");
  }
  return context;
}
