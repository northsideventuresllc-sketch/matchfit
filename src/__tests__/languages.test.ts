import { describe, expect, it } from "vitest";
import { z } from "zod";
import { LANGUAGE_IDS } from "@/lib/trainer-match-questionnaire";
import {
  LEGACY_QUESTIONNAIRE_LANGUAGE_TO_CODE,
  normalizeSpokenLanguageIds,
  SPOKEN_LANGUAGE_CODES,
  SPOKEN_LANGUAGE_LABELS,
} from "@/lib/languages";

describe("SPOKEN_LANGUAGE_CODES", () => {
  it("is the planned superset (~30 ISO 639-1 codes plus 'other') with no duplicates", () => {
    expect(SPOKEN_LANGUAGE_CODES).toHaveLength(32);
    expect(new Set(SPOKEN_LANGUAGE_CODES).size).toBe(SPOKEN_LANGUAGE_CODES.length);
    for (const required of [
      "en", "es", "fr", "pt", "zh", "de", "it", "nl", "ru", "ar", "hi", "bn",
      "ur", "ja", "ko", "vi", "th", "id", "ms", "tl", "tr", "pl", "uk", "ro",
      "el", "sv", "no", "da", "fi", "he", "sw", "other",
    ]) {
      expect(SPOKEN_LANGUAGE_CODES).toContain(required);
    }
    for (const code of SPOKEN_LANGUAGE_CODES) {
      expect(code === "other" || /^[a-z]{2}$/.test(code)).toBe(true);
    }
  });

  it("works with z.enum for the §1.4 client-preferences contract", () => {
    const schema = z.array(z.enum(SPOKEN_LANGUAGE_CODES)).default([]);
    expect(schema.parse(["en", "ja"])).toStrictEqual(["en", "ja"]);
    expect(schema.parse(undefined)).toStrictEqual([]);
    expect(() => schema.parse(["english"])).toThrow();
  });

  it("has a non-empty label for every code", () => {
    for (const code of SPOKEN_LANGUAGE_CODES) {
      expect(SPOKEN_LANGUAGE_LABELS[code]?.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("LEGACY_QUESTIONNAIRE_LANGUAGE_TO_CODE", () => {
  it("maps exactly the plan's legacy pairs", () => {
    expect(LEGACY_QUESTIONNAIRE_LANGUAGE_TO_CODE).toStrictEqual({
      english: "en",
      spanish: "es",
      french: "fr",
      portuguese: "pt",
      mandarin: "zh",
      other: "other",
    });
  });

  it("covers every live questionnaire LANGUAGE_IDS entry and maps into the code list", () => {
    for (const legacyId of LANGUAGE_IDS) {
      const mapped = LEGACY_QUESTIONNAIRE_LANGUAGE_TO_CODE[legacyId];
      expect(mapped, `legacy id "${legacyId}" must map`).toBeTruthy();
      expect(SPOKEN_LANGUAGE_CODES).toContain(mapped);
    }
  });
});

describe("normalizeSpokenLanguageIds", () => {
  it("maps legacy ids to codes", () => {
    expect(normalizeSpokenLanguageIds(["english", "mandarin"])).toStrictEqual(["en", "zh"]);
  });

  it("passes through valid codes", () => {
    expect(normalizeSpokenLanguageIds(["ja", "sw", "other"])).toStrictEqual(["ja", "sw", "other"]);
  });

  it("dedupes across legacy ids and codes, preserving first-seen order", () => {
    expect(normalizeSpokenLanguageIds(["english", "en", "spanish", "es", "english"])).toStrictEqual([
      "en",
      "es",
    ]);
  });

  it("drops unknowns, blanks, and prototype-chain traps", () => {
    expect(
      normalizeSpokenLanguageIds(["klingon", "", "  ", "constructor", "toString", "en"]),
    ).toStrictEqual(["en"]);
    expect(normalizeSpokenLanguageIds([])).toStrictEqual([]);
  });

  it("trims and lowercases input", () => {
    expect(normalizeSpokenLanguageIds([" English ", "JA"])).toStrictEqual(["en", "ja"]);
  });
});
