import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    run: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));
vi.mock("@/lib/storage", () => ({
  uploadVerificationEvidence: vi.fn(),
}));

import {
  computeAttemptFactor,
  computeScoreV2,
  computeTimeFactor,
} from "../service.ts";

describe("computeTimeFactor", () => {
  it("returns 1.0 when elapsedMs is null", () => {
    expect(computeTimeFactor(null, 30)).toBe(1.0);
  });

  it("returns 1.0 when elapsedMs is 0", () => {
    expect(computeTimeFactor(0, 30)).toBe(1.0);
  });

  it("decays linearly with elapsed time", () => {
    // 30 minutes = 1800000ms. Halfway (900000ms) = 0.5, floored at 0.7
    expect(computeTimeFactor(900000, 30)).toBe(0.7);
  });

  it("floors at 0.7", () => {
    expect(computeTimeFactor(3600000, 30)).toBe(0.7); // 60 min > 30 min estimate
    expect(computeTimeFactor(5400000, 30)).toBe(0.7); // 90 min
  });

  it("handles different estimated minutes", () => {
    expect(computeTimeFactor(300000, 60)).toBeCloseTo(1 - 300000 / (60 * 60 * 1000));
  });
});

describe("computeAttemptFactor", () => {
  it("returns 1.0 for 1 attempt", () => {
    expect(computeAttemptFactor(1)).toBe(1.0);
  });

  it("returns 0.95 for 2 attempts", () => {
    expect(computeAttemptFactor(2)).toBe(0.95);
  });

  it("returns 0.90 for 3 attempts", () => {
    expect(computeAttemptFactor(3)).toBe(0.90);
  });

  it("floors at 0.85", () => {
    expect(computeAttemptFactor(4)).toBe(0.85);
    expect(computeAttemptFactor(100)).toBe(0.85);
  });

  it("handles 0 attempts (treats as 1)", () => {
    expect(computeAttemptFactor(0)).toBe(1.0);
  });
});

describe("computeScoreV2", () => {
  it("computes base score for easy challenge with no penalties", () => {
    // baseScore=1000, easy=1.0, timeFactor=1.0, attemptFactor=1.0
    expect(computeScoreV2(1000, "easy", 0, 30, 1)).toBe(1000);
  });

  it("applies difficulty multiplier (clamped at 1000)", () => {
    // medium: baseScore=1000, multiplier=1.25, clamped at 1000
    expect(computeScoreV2(1000, "medium", 0, 30, 1)).toBe(1000);
    // hard: baseScore=1000, multiplier=1.5, clamped at 1000
    expect(computeScoreV2(1000, "hard", 0, 30, 1)).toBe(1000);
    // Use a lower baseScore to see multiplier effect without clamping
    expect(computeScoreV2(800, "medium", 0, 30, 1)).toBe(1000);
    expect(computeScoreV2(600, "medium", 0, 30, 1)).toBe(750);
  });

  it("applies time decay (floored at 0.7)", () => {
    // baseScore=1000, easy=1.0, timeFactor=0.7 (floored), attempts=1.0 -> 700
    expect(computeScoreV2(1000, "easy", 900000, 30, 1)).toBe(700);
    // Shorter time, above floor: 300000ms / 1800000ms = 0.167, timeFactor = 0.833
    expect(computeScoreV2(1000, "easy", 300000, 30, 1)).toBe(833);
  });

  it("applies attempt penalty", () => {
    // baseScore=1000, easy=1.0, time=1.0, attempts=2 -> attemptFactor=0.95 -> 950
    expect(computeScoreV2(1000, "easy", 0, 30, 2)).toBe(950);
  });

  it("clamps to 1000 maximum", () => {
    // easy=1.0, multiplier would exceed 1000
    expect(computeScoreV2(1000, "hard", 0, 30, 1)).toBe(1000);
  });

  it("clamps to 0 minimum", () => {
    // baseScore=0, anything * 0 = 0
    expect(computeScoreV2(0, "easy", 0, 30, 1)).toBe(0);
  });

  it("combines all factors", () => {
    // baseScore=800, medium=1.25, timeFactor=0.7 (floored), attempts=3 (attemptFactor=0.90)
    // 800 * 1.25 * 0.7 * 0.90 = 630
    expect(computeScoreV2(800, "medium", 900000, 30, 3)).toBe(630);
  });

  it("handles unknown difficulty (defaults to 1.0)", () => {
    expect(computeScoreV2(1000, "unknown", 0, 30, 1)).toBe(1000);
  });
});
