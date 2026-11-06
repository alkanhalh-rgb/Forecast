import type { User } from '@app/db';

/** What the client may see about the signed-in user. Never includes the phone number. */
export function publicMe(u: User) {
  return {
    id: u.id,
    nickname: u.nickname,
    city: u.city,
    interests: u.interests,
    role: u.role,
    ageConfirmed: !!u.ageConfirmedAt,
    onboarded: !!u.onboardedAt,
    createdAt: u.createdAt,
  };
}
