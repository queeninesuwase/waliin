"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getCurrentUser, type SignInStatus } from "@/lib/auth";

interface UserProfileContextValue {
  user: SignInStatus | null;
  loading: boolean;
}

const UserProfileContext = createContext<UserProfileContextValue>({
  user: null,
  loading: true,
});

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SignInStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    getCurrentUser()
      .then((profile) => {
        if (active) setUser(profile);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <UserProfileContext.Provider value={{ user, loading }}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  return useContext(UserProfileContext);
}
