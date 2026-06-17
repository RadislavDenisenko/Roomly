export const ICEBREAKERS = [
  "What's your move-in timeline?",
  "Early bird or night owl?",
  "Which neighborhoods are you considering?",
  "What's your ideal monthly budget?",
  "Any dealbreakers I should know about?",
];

export function pickIcebreakers(n = 3): string[] {
  return ICEBREAKERS.slice(0, Math.min(n, ICEBREAKERS.length));
}
