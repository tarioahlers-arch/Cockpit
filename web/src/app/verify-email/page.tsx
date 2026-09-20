"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Spinner } from "@/components/Ui";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { updateUser, user } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      return;
    }
    api
      .post("/auth/verify-email", { token })
      .then((res) => {
        setStatus("success");
        if (user) updateUser(res.data.user);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(apiErrorMessage(err, "Bestätigung fehlgeschlagen."));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token && status === "loading") {
    return (
      <div className="container-page py-16 max-w-md">
        <div className="card p-8 text-center">
          <div className="text-4xl mb-2">⚠️</div>
          <h1 className="text-xl font-bold mb-2">Bestätigung fehlgeschlagen</h1>
          <p className="text-sm text-muted mb-4">Kein Bestätigungscode gefunden.</p>
          <Link href="/" className="btn-secondary w-full">
            Zur Startseite
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page py-16 max-w-md">
      <div className="card p-8 text-center">
        {status === "loading" && <Spinner label="E-Mail wird bestätigt…" />}
        {status === "success" && (
          <>
            <div className="text-4xl mb-2">✅</div>
            <h1 className="text-xl font-bold mb-2">E-Mail bestätigt!</h1>
            <p className="text-sm text-muted mb-4">
              Dein Konto ist jetzt vollständig aktiviert.
            </p>
            <Link href="/tasks" className="btn-primary w-full">
              Weiter zu HelferHand
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <div className="text-4xl mb-2">⚠️</div>
            <h1 className="text-xl font-bold mb-2">Bestätigung fehlgeschlagen</h1>
            <p className="text-sm text-muted mb-4">{message}</p>
            <Link href="/" className="btn-secondary w-full">
              Zur Startseite
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
