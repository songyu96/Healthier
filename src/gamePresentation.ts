import type { UserProfile } from "./domain";
import type { GameDietDay } from "./game";

export type SwimPace = "EASY" | "STEADY" | "SURGE";

export interface SwimPresentation {
  pace: SwimPace;
  label: string;
  luminousWater: boolean;
}

export interface AvatarProportions {
  bodyWidth: number;
  strokeReach: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function avatarProportions(profile?: Pick<UserProfile, "heightCm" | "currentWeightKg">): AvatarProportions {
  const height = profile && Number.isFinite(profile.heightCm) ? profile.heightCm : 170;
  const weight = profile && Number.isFinite(profile.currentWeightKg) ? profile.currentWeightKg : 70;
  return {
    bodyWidth: clamp(0.96 + (weight - 70) * 0.0018, 0.88, 1.12),
    strokeReach: clamp(0.98 + (height - 170) * 0.0015, 0.9, 1.08)
  };
}

export function swimPresentation(todayPoints: number, dietDay?: GameDietDay): SwimPresentation {
  const pace: SwimPace = todayPoints >= 20 ? "SURGE" : todayPoints > 0 ? "STEADY" : "EASY";
  return {
    pace,
    label: pace === "SURGE" ? "迎浪加速" : pace === "STEADY" ? "稳步前进" : "自在巡游",
    luminousWater: dietDay?.status === "ASSESSED" && dietDay.score >= 0.5
  };
}
