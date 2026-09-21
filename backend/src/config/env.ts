import dotenv from "dotenv";

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL", "file:./dev.db"),
  jwtSecret: required("JWT_SECRET", "dev-secret-change-me"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  clientUrl: process.env.CLIENT_URL ?? "http://localhost:3000",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_placeholder",
  platformFeePercent: Number(process.env.STRIPE_PLATFORM_FEE_PERCENT ?? 15),
  uploadDir: process.env.UPLOAD_DIR ?? "./uploads",
};
