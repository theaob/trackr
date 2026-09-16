"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { User } from "@/types";

interface UserContextType {
  currentUser: User | null;
  users: User[];
  setCurrentUser: (user: User) => void;
  setUsers: (users: User[]) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({
  children,
  initialUsers = [],
}: {
  children: React.ReactNode;
  initialUsers?: User[];
}) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [currentUser, setCurrentUser] = useState<User | null>(
    initialUsers.length > 0 ? initialUsers[0] : null
  );

  useEffect(() => {
    if (initialUsers.length > 0 && !currentUser) {
      setCurrentUser(initialUsers[0]);
    }
  }, [initialUsers, currentUser]);

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
