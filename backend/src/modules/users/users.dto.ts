import { User } from "@prisma/client";

export function publicUser(user: User) {
  const { passwordHash, verificationToken, stripeAccountId, stripeCustomerId, ...rest } = user;
  return rest;
}

export function publicProfile(user: User) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    city: user.city,
    hourlyRate: user.hourlyRate,
    isTaskerOnboarded: user.isTaskerOnboarded,
    ratingAvg: user.ratingAvg,
    ratingCount: user.ratingCount,
    createdAt: user.createdAt,
  };
}
