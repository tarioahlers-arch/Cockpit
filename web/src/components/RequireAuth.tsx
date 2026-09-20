"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Spinner } from "./Ui";

export function RequireAuth({
  children,
  adminOnly = false,
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    } else if (adminOnly && !user.isAdmin) {
      router.replace("/tasks");
    }
  }, [user, loading, router, pathname, adminOnly]);

  if (loading || !user || (adminOnly && !user.isAdmin)) {
    return (
      <div className="container-page py-16">
        <Spinner label="Wird geladen…" />
      </div>
    );
  }

  return <>{children}</>;
}
