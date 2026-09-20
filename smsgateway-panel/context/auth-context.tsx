"use client";

import React, {
  createContext,
  useState,
  useEffect,
  ReactNode,
  useContext,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/pb";
import type { UserRecord } from "@/types/pb";

const pb = createClient();

interface AuthResult {
  success: boolean;
  user: UserRecord | null;
  error?: { message: string };
}

interface AuthContextType {
  user: UserRecord | null;
  // In PocketBase the `users` record *is* the profile. `profile` is kept as an
  // alias of `user` so the ProtectedRoute pattern maps over cleanly.
  profile: UserRecord | null;
  login: (email: string, password: string) => Promise<AuthResult>;
  logOut: () => Promise<void>;
  register: (
    email: string,
    fullname: string,
    password: string
  ) => Promise<AuthResult>;
  changePassword: (
    oldPassword: string,
    newPassword: string
  ) => Promise<void>;
  loading: boolean;
  refreshUser: () => Promise<void>;
  token: string | null;
}

interface AuthProviderProps {
  children: ReactNode;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<UserRecord | null>(null);
  const [token, setToken] = useState<string | null>(null);
  // True until the first auth check (reading the persisted authStore) is done.
  const [loading, setLoading] = useState(true);

  const router = useRouter();

  const syncFromStore = useCallback(() => {
    if (pb.authStore.isValid && pb.authStore.record) {
      setUser(pb.authStore.record as unknown as UserRecord);
      setToken(pb.authStore.token);
    } else {
      setUser(null);
      setToken(null);
    }
  }, []);

  useEffect(() => {
    // Load whatever the LocalAuthStore persisted, then subscribe to changes.
    syncFromStore();
    setLoading(false);

    const unsubscribe = pb.authStore.onChange(() => {
      syncFromStore();
    });

    return () => unsubscribe();
  }, [syncFromStore]);

  const refreshUser = useCallback(async () => {
    if (!pb.authStore.isValid) return;
    try {
      await pb.collection("users").authRefresh();
      syncFromStore();
    } catch {
      pb.authStore.clear();
    }
  }, [syncFromStore]);

  const login = async (
    email: string,
    password: string
  ): Promise<AuthResult> => {
    try {
      const authData = await pb
        .collection("users")
        .authWithPassword(email, password);
      // onChange handles state; return the record for the caller.
      return { success: true, user: authData.record as unknown as UserRecord };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Invalid email or password.";
      return { success: false, user: null, error: { message } };
    }
  };

  const register = async (
    email: string,
    fullname: string,
    password: string
  ): Promise<AuthResult> => {
    try {
      await pb.collection("users").create({
        email,
        password,
        passwordConfirm: password,
        name: fullname,
      });
      // Log the new user straight in.
      const authData = await pb
        .collection("users")
        .authWithPassword(email, password);
      return { success: true, user: authData.record as unknown as UserRecord };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not create account.";
      return { success: false, user: null, error: { message } };
    }
  };

  const logOut = async (): Promise<void> => {
    pb.authStore.clear();
    router.push("/auth/login");
  };

  const changePassword = async (
    oldPassword: string,
    newPassword: string
  ): Promise<void> => {
    if (!pb.authStore.record) throw new Error("Not authenticated");
    await pb.collection("users").update(pb.authStore.record.id, {
      oldPassword,
      password: newPassword,
      passwordConfirm: newPassword,
    });
    // Changing the password invalidates the token; refresh it.
    await pb.collection("users").authWithPassword(
      (pb.authStore.record as unknown as UserRecord).email,
      newPassword
    );
  };

  const contextValue: AuthContextType = {
    user,
    profile: user,
    login,
    logOut,
    register,
    changePassword,
    loading,
    refreshUser,
    token,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {/* Don't render children until the initial auth check is complete. */}
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
