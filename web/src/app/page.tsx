"use client";

import Link from "next/link";
import { useCategories } from "@/lib/hooks";
import { useAuth } from "@/lib/auth-context";
import { categoryEmoji } from "@/lib/categoryIcons";
import { Spinner } from "@/components/Ui";

const STEPS = [
  {
    title: "1. Aufgabe beschreiben",
    text: "Erstelle in wenigen Minuten deine Aufgabe – mit Kategorie, Ort und Budget.",
    icon: "📝",
  },
  {
    title: "2. Helfer auswählen",
    text: "Erhalte Bewerbungen von geprüften Helfern und wähle den passenden aus.",
    icon: "🤝",
  },
  {
    title: "3. Sicher bezahlen",
    text: "Bezahle bequem online – das Geld wird erst nach Erledigung freigegeben.",
    icon: "✅",
  },
];

export default function HomePage() {
  const { data: categories, isLoading } = useCategories();
  const { user } = useAuth();

  return (
    <div>
      <section className="bg-gradient-to-b from-primary-light to-background">
        <div className="container-page py-16 sm:py-24 text-center">
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground max-w-3xl mx-auto">
            Finde Hilfe für jede Aufgabe.
            <br />
            <span className="text-primary-dark">Schnell, sicher, in deiner Stadt.</span>
          </h1>
          <p className="mt-4 text-muted max-w-xl mx-auto">
            HelferHand verbindet dich mit vertrauenswürdigen Helfern für Umzug, Montage,
            Reinigung, Gartenarbeit und mehr – überall in Deutschland.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href={user ? "/tasks/new" : "/register"} className="btn-primary text-base px-6 py-3">
              Aufgabe erstellen
            </Link>
            <Link href="/tasks" className="btn-secondary text-base px-6 py-3">
              Aufgaben durchsuchen
            </Link>
          </div>
        </div>
      </section>

      <section className="container-page py-12">
        <h2 className="text-xl font-bold mb-6">Kategorien</h2>
        {isLoading ? (
          <Spinner />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {categories?.map((cat) => (
              <Link
                key={cat.id}
                href={`/tasks?categoryId=${cat.id}`}
                className="card p-4 flex items-center gap-3 hover:border-primary hover:shadow-sm transition-all"
              >
                <span className="text-2xl">{categoryEmoji(cat.icon)}</span>
                <span className="font-medium text-sm">{cat.name}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="bg-primary-light/50 py-12">
        <div className="container-page">
          <h2 className="text-xl font-bold mb-8 text-center">So funktioniert&apos;s</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {STEPS.map((step) => (
              <div key={step.title} className="card p-6 text-center">
                <div className="text-4xl mb-3">{step.icon}</div>
                <h3 className="font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-muted">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
