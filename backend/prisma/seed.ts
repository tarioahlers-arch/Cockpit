import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CATEGORIES = [
  { name: "Umzug & Transport", icon: "truck" },
  { name: "Möbelmontage", icon: "wrench" },
  { name: "Reinigung", icon: "sparkles" },
  { name: "Gartenarbeit", icon: "leaf" },
  { name: "Renovierung & Handwerk", icon: "hammer" },
  { name: "IT- & Technik-Hilfe", icon: "cpu" },
  { name: "Einkaufen & Botengänge", icon: "shopping-cart" },
  { name: "Umzugsputz", icon: "broom" },
  { name: "Elektroinstallation", icon: "zap" },
  { name: "Sonstiges", icon: "more-horizontal" },
];

const CITIES = ["Berlin", "Hamburg", "München", "Köln", "Frankfurt am Main", "Stuttgart", "Düsseldorf", "Leipzig"];

async function main() {
  console.log("Seeding HelferHand Datenbank...");

  const categories = await Promise.all(
    CATEGORIES.map((c) => prisma.category.upsert({ where: { name: c.name }, update: {}, create: c })),
  );

  const passwordHash = await bcrypt.hash("Passwort123!", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@helferhand.de" },
    update: {},
    create: {
      email: "admin@helferhand.de",
      passwordHash,
      firstName: "Admina",
      lastName: "Verwalter",
      isAdmin: true,
      emailVerified: true,
      city: "Berlin",
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: "kunde@helferhand.de" },
    update: {},
    create: {
      email: "kunde@helferhand.de",
      passwordHash,
      firstName: "Julia",
      lastName: "Fischer",
      emailVerified: true,
      city: "Berlin",
      bio: "Suche zuverlässige Hilfe für Alltagsaufgaben.",
    },
  });

  const tasker1 = await prisma.user.upsert({
    where: { email: "helfer1@helferhand.de" },
    update: {},
    create: {
      email: "helfer1@helferhand.de",
      passwordHash,
      firstName: "Max",
      lastName: "Weber",
      emailVerified: true,
      city: "Berlin",
      bio: "Erfahrener Handwerker mit 8 Jahren Erfahrung in Möbelmontage und Renovierung.",
      isTaskerOnboarded: true,
      hourlyRate: 2500,
      radiusKm: 25,
      ratingAvg: 4.8,
      ratingCount: 34,
      stripeAccountId: "acct_test_demo1",
    },
  });

  const tasker2 = await prisma.user.upsert({
    where: { email: "helfer2@helferhand.de" },
    update: {},
    create: {
      email: "helfer2@helferhand.de",
      passwordHash,
      firstName: "Sophie",
      lastName: "Klein",
      emailVerified: true,
      city: "München",
      bio: "Ich helfe gerne bei Umzügen, Reinigung und Gartenarbeit.",
      isTaskerOnboarded: true,
      hourlyRate: 2000,
      radiusKm: 30,
      ratingAvg: 4.9,
      ratingCount: 51,
      stripeAccountId: "acct_test_demo2",
    },
  });

  await prisma.taskerSkill.createMany({
    data: [
      { userId: tasker1.id, categoryId: categories[1].id },
      { userId: tasker1.id, categoryId: categories[4].id },
      { userId: tasker1.id, categoryId: categories[8].id },
      { userId: tasker2.id, categoryId: categories[0].id },
      { userId: tasker2.id, categoryId: categories[2].id },
      { userId: tasker2.id, categoryId: categories[3].id },
    ],
  });

  const task1 = await prisma.task.create({
    data: {
      title: "IKEA-Kleiderschrank aufbauen",
      description: "Ich brauche Hilfe beim Aufbau eines PAX-Kleiderschranks (2,5m breit). Werkzeug ist vorhanden.",
      categoryId: categories[1].id,
      city: "Berlin",
      address: "Prenzlauer Berg",
      budgetCents: 6000,
      posterId: customer.id,
      status: "POSTED",
    },
  });

  await prisma.task.create({
    data: {
      title: "Wohnungsreinigung nach Auszug",
      description: "Gründliche Endreinigung einer 3-Zimmer-Wohnung (75m²) inkl. Fenster.",
      categoryId: categories[2].id,
      city: "München",
      budgetCents: 12000,
      posterId: customer.id,
      status: "POSTED",
    },
  });

  await prisma.task.create({
    data: {
      title: "Rasen mähen und Hecke schneiden",
      description: "Regelmäßige Gartenpflege für einen 200m² Garten gesucht.",
      categoryId: categories[3].id,
      city: "Hamburg",
      budgetCents: 4500,
      posterId: customer.id,
      status: "POSTED",
    },
  });

  await prisma.taskApplication.create({
    data: {
      taskId: task1.id,
      taskerId: tasker1.id,
      message: "Ich habe schon viele PAX-Schränke montiert, kann heute Nachmittag vorbeikommen.",
      proposedCents: 5500,
    },
  });

  console.log("Seed abgeschlossen.");
  console.log("Demo-Zugänge (Passwort für alle: Passwort123!):");
  console.log(`  Admin:  ${admin.email}`);
  console.log(`  Kunde:  ${customer.email}`);
  console.log(`  Helfer: ${tasker1.email}`);
  console.log(`  Helfer: ${tasker2.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
