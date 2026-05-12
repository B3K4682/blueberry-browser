import type { RitualCandidate, RitualMetadata } from "@shared/ritual-types";

// Asks main to call OpenAI for the candidate and returns the parsed metadata
export async function generateMetadata(
  candidate: RitualCandidate
): Promise<RitualMetadata> {
  return window.ritualAPI.generateMetadata(candidate);
}

// Returns a deterministic Playwright script for the candidate's events
export async function generatePlaywrightScript(
  candidate: RitualCandidate,
  title: string
): Promise<string> {
  return window.ritualAPI.generatePlaywrightScript(candidate, title);
}
