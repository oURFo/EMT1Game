import type { Difficulty, DifficultyId } from "./types";

export const DIFFICULTIES: Record<DifficultyId, Difficulty> = {
  training: {
    id: "training",
    label: "實習班",
    description: "顯示關鍵提示，病況惡化較慢",
    declineRate: 0.08,
    scoreMultiplier: 0.85,
    showHints: true,
  },
  standard: {
    id: "standard",
    label: "正式值勤",
    description: "標準時間壓力與完整計分",
    declineRate: 0.14,
    scoreMultiplier: 1,
    showHints: false,
  },
  challenge: {
    id: "challenge",
    label: "黃金挑戰",
    description: "病況變化更快，分數加成 20%",
    declineRate: 0.22,
    scoreMultiplier: 1.2,
    showHints: false,
  },
};
