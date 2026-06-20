import { getUserPointSummary } from '@/lib/user-points';
import { getUserPointsProgress } from '@/lib/user-points-levels';

export type UserPointsProfile = {
  points: number;
  progress: ReturnType<typeof getUserPointsProgress>;
  recent: Awaited<ReturnType<typeof getUserPointSummary>>['recent'];
};

export async function getUserPointsProfile(userId: string, limit = 10): Promise<UserPointsProfile> {
  const summary = await getUserPointSummary(userId, limit);
  return {
    points: summary.points,
    progress: getUserPointsProgress(summary.points),
    recent: summary.recent,
  };
}
