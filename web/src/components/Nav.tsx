"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { useNotifications } from "@/lib/hooks";
import { getSocket } from "@/lib/socket";
import { Avatar } from "./Avatar";

export function Nav() {
  const { user, token, logout, loading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { data } = useNotifications();
  const unread = data?.unreadCount ?? 0;

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    function onNotification() {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
    socket.on("notification", onNotification);
    return () => {
      socket.off("notification", onNotification);
    };
  }, [token, queryClient]);

  function handleLogout() {
    logout();
    setMenuOpen(false);
    router.push("/");
  }

  const navLinks = [
    { href: "/tasks", label: "Aufgaben durchsuchen" },
    { href: "/tasks/new", label: "Aufgabe erstellen" },
    { href: "/my-tasks", label: "Meine Aufgaben" },
    { href: "/messages", label: "Nachrichten" },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-border">
      <div className="container-page flex items-center justify-between h-16">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg text-primary-dark">
            <span className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center text-sm">
              HH
            </span>
            HelferHand
          </Link>
          {user && (
            <nav className="hidden lg:flex items-center gap-1">
              {navLinks.map((l) => (
                <Link key={l.href} href={l.href} className="btn-ghost text-sm">
                  {l.label}
                </Link>
              ))}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!loading && !user && (
            <>
              <Link href="/login" className="btn-ghost text-sm hidden sm:inline-flex">
                Anmelden
              </Link>
              <Link href="/register" className="btn-primary text-sm">
                Registrieren
              </Link>
            </>
          )}

          {user && (
            <>
              <Link
                href="/notifications"
                className="relative btn-ghost !p-2 text-lg"
                aria-label="Benachrichtigungen"
              >
                🔔
                {unread > 0 && (
                  <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>

              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="flex items-center gap-1 p-1 rounded-full hover:bg-primary-light"
                >
                  <Avatar
                    name={`${user.firstName} ${user.lastName}`}
                    avatarUrl={user.avatarUrl}
                    size={32}
                  />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-52 card shadow-lg py-1 text-sm">
                    <div className="px-3 py-2 border-b border-border">
                      <p className="font-medium truncate">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-muted text-xs truncate">{user.email}</p>
                    </div>
                    <Link
                      href="/profile"
                      className="block px-3 py-2 hover:bg-primary-light"
                      onClick={() => setMenuOpen(false)}
                    >
                      Profil
                    </Link>
                    <Link
                      href="/my-tasks"
                      className="block px-3 py-2 hover:bg-primary-light lg:hidden"
                      onClick={() => setMenuOpen(false)}
                    >
                      Meine Aufgaben
                    </Link>
                    {user.isAdmin && (
                      <Link
                        href="/admin"
                        className="block px-3 py-2 hover:bg-primary-light"
                        onClick={() => setMenuOpen(false)}
                      >
                        Admin
                      </Link>
                    )}
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-3 py-2 hover:bg-primary-light text-red-600"
                    >
                      Abmelden
                    </button>
                  </div>
                )}
              </div>

              <button
                className="lg:hidden btn-ghost !p-2"
                onClick={() => setMobileOpen((v) => !v)}
                aria-label="Menü"
              >
                ☰
              </button>
            </>
          )}
        </div>
      </div>

      {user && mobileOpen && (
        <nav className="lg:hidden border-t border-border px-4 py-2 flex flex-col">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="py-2 text-sm"
              onClick={() => setMobileOpen(false)}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
