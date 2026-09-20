"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    router.replace(user?.id ? "/dashboard" : "/auth/login");
  }, [user, router]);

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-t-indigo-600 border-gray-200 dark:border-zinc-700" />
    </div>
  );
}
