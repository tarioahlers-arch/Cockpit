"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { useAuth } from "./auth-context";
import type { Category, Notification } from "./types";

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await api.get<{ categories: Category[] }>("/categories");
      return res.data.categories;
    },
    staleTime: 5 * 60_000,
  });
}

export function useNotifications() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await api.get<{ notifications: Notification[]; unreadCount: number }>(
        "/notifications"
      );
      return res.data;
    },
    enabled: !!token,
    refetchInterval: 30_000,
  });
}
