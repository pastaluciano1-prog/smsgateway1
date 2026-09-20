"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user?.id) {
      router.replace("/auth/login");
    }
  }, [user, loading, router]);

  if (loading || !user?.id) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white/80 dark:bg-black/80 z-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-indigo-600 border-gray-200 dark:border-zinc-700" />
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
