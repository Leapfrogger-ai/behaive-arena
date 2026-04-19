// Persona definitions — ported from workspaces/{proposer,responder}/SOUL.md.
//
// Each persona produces *deterministic* decisions from a game state, which
// is what lets the mock provider run the full arena loop without any LLM
// API keys. When MODEL_PROVIDER=anthropic the worker switches to the real
// Claude adapter (TODO: W7) and the persona moves into the prompt instead.

export type ProposerPersona = "fair" | "egalitarian" | "shark" | "rational" | "punisher";
export type ResponderPersona = "fair" | "egalitarian" | "shark" | "rational" | "punisher";

export interface ProposerDecision {
  offer: number; // whole-dollar offer, 0..endowment
  rationale: string;
}

export interface ResponderDecision {
  accept: boolean;
  rationale: string;
}

export function proposerOffer(
  persona: ProposerPersona,
  endowment: number,
  round: number,
  rng: () => number,
): ProposerDecision {
  // round is 1-indexed; later rounds let personas adapt slightly (reduce noise).
  const jitter = (p: number) => Math.max(0, Math.min(endowment, Math.round(p + (rng() - 0.5) * (round === 1 ? 1 : 0.5))));
  switch (persona) {
    case "fair":
      return {
        offer: jitter(endowment * 0.5),
        rationale: "A 50/50 split is what I'd accept myself; I offer the same.",
      };
    case "egalitarian":
      return {
        offer: jitter(endowment * 0.45),
        rationale: "A little less than half — I need to take something home, but I want you treated decently.",
      };
    case "rational":
      return {
        offer: jitter(endowment * 0.3),
        rationale: "Game-theoretically you should accept any positive amount. I'll offer the minimum you plausibly won't reject.",
      };
    case "shark":
      return {
        offer: jitter(endowment * 0.15),
        rationale: "Small offer. If you reject, we both get zero — odds say you take it.",
      };
    case "punisher":
      // punisher as proposer is unusual; behaves nearly fair but signals reciprocity.
      return {
        offer: jitter(endowment * 0.45),
        rationale: "I punish unfairness in others and won't ask you to accept what I wouldn't.",
      };
  }
}

export function responderDecision(
  persona: ResponderPersona,
  offer: number,
  endowment: number,
  round: number,
  rng: () => number,
): ResponderDecision {
  const share = offer / endowment;
  // Small probabilistic region near each persona's threshold so runs aren't
  // trivially identical under the same seed.
  const noise = (rng() - 0.5) * 0.05;
  switch (persona) {
    case "rational": {
      const accept = offer >= 1; // any positive offer
      return {
        accept,
        rationale: accept
          ? "Positive amount beats zero. Accepted."
          : "Zero offer — nothing to lose by rejecting.",
      };
    }
    case "fair":
    case "egalitarian": {
      const accept = share + noise >= 0.35;
      return {
        accept,
        rationale: accept
          ? `Offer of ${share.toFixed(2)} is close enough to fair. Accepted.`
          : `Offer of ${share.toFixed(2)} is too skewed. Rejected — fairness matters.`,
      };
    }
    case "punisher": {
      // Accept only generous splits; punish low offers even at personal cost.
      // Punisher also gets slightly harsher over rounds if treated poorly.
      const threshold = 0.4 + Math.max(0, (round - 1) * 0.02);
      const accept = share + noise >= threshold;
      return {
        accept,
        rationale: accept
          ? `Acceptable split. Your offer respects reciprocity.`
          : `Rejecting. Your offer was unfair; punishment is worth the cost.`,
      };
    }
    case "shark": {
      // Self-serving responder accepts anything non-zero.
      const accept = offer > 0;
      return {
        accept,
        rationale: accept
          ? "Better than nothing. Accepted."
          : "You offered zero. Rejected out of spite.",
      };
    }
  }
}

// Grading rubric — each agent scores its counterparty on fairness after
// every round. Score is -100..100 to fit ReputationRegistry's int8 range.
export function grade(
  persona: ProposerPersona | ResponderPersona,
  context: { offer: number; endowment: number; accepted: boolean; perspective: "proposer" | "responder" },
): { score: number; rationale: string } {
  const share = context.offer / context.endowment;
  if (context.perspective === "responder") {
    // Responder grades the proposer on fairness of the offer.
    if (share >= 0.45) return { score: 80, rationale: "Generous and close to fair." };
    if (share >= 0.35) return { score: 40, rationale: "Acceptable, if a bit stingy." };
    if (share >= 0.2) return { score: -20, rationale: "Low-ball. Reluctantly accepted or rejected." };
    return { score: -70, rationale: "Exploitative offer." };
  }
  // Proposer grades the responder on rationality / cooperativeness.
  if (context.accepted) return { score: 40, rationale: "Cooperative. Took the deal." };
  if (share < 0.25) return { score: -10, rationale: "Rejected a low offer — defensible." };
  return { score: -60, rationale: "Rejected a reasonable offer — irrational or spiteful." };
}
