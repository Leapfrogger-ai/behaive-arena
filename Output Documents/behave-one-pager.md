# behAIve: A Behavioral Economics Arena for Autonomous AI Agents

**Prepared for the Ethereum Foundation | February 2026**

---

## The Opportunity

The Ethereum Foundation's dAI team has laid remarkable groundwork for an agentic economy on Ethereum — ERC-8004 for agent identity and reputation, x402 for agent-native payments, EIP-4337 for smart account guardrails. With ~10,000 agents already registered on mainnet and Gartner forecasting 40% of enterprise apps embedding AI agents by end of 2026, this infrastructure is arriving at exactly the right moment.

As these agents begin to transact, coordinate, and compete at scale, a natural next question opens up: how will they actually behave? Not individually — that's the domain of AI alignment research — but collectively, as populations of autonomous economic actors interacting through Ethereum's protocols. When individually rational agents optimize locally, what dynamics emerge? Cooperation? Collusion? Tragedy of the commons?

We know from behavioral economics that humans consistently defy game-theoretic predictions — for example in the Ultimatum Game, where one player proposes how to split a sum of money and the other must accept or reject, with both getting nothing on rejection. Rational actors should accept any non-zero offer, yet humans reject offers below 30%, sacrificing their own gain to punish unfairness. These departures from theory shape how real economies function. We have no equivalent knowledge for agent economies, and the stakes of getting it wrong — systemic failures, collusive equilibria, extractive dynamics — grow with every agent that comes on-chain.

behAIve brings that empirical rigor to agent populations — built directly on the infrastructure the dAI team has created.

## What behAIve Is

behAIve is a controlled research arena where autonomous AI agents interact freely using real Ethereum infrastructure — on-chain identity, wallets, payments, DeFi, reputation — while researchers observe, measure, and learn from the outcomes.

Think of it as a behavioral economics lab, but for agents instead of humans.

Each experiment is a well-studied game from behavioral economics — games with decades of documented human results to benchmark against. The Ultimatum Game is the first. Public Goods Games, Prisoner's Dilemma, Trust Games, and auction mechanisms follow. Agents are given wallets, financial tools, and system prompts that define their strategies. They act autonomously. We study what emerges.

## Building on the dAI Roadmap

The dAI team's 2026 roadmap positions Ethereum as "the global decentralized settlement and coordination infrastructure for artificial intelligence." behAIve extends that vision into the research layer — generating empirical data about agent-to-agent dynamics that can inform how Ethereum's agent infrastructure evolves.

As Vitalik outlined in his crypto+AI framework, the most viable near-term application of AI on-chain is as "a player in a game." behAIve takes that literally and makes it observable:

- **How do agents respond to ERC-8004 reputation signals?** Empirical data on whether on-chain reputation drives cooperation, and under what conditions — directly useful for evolving the trust infrastructure.
- **What payment dynamics emerge with x402 at scale?** Do agents settle fairly, or do patterns like race-to-the-bottom pricing appear? This informs the economic coordination layer.
- **Do agent populations cooperate on public goods, or free-ride?** Findings here feed into retroactive public goods design and grant allocation frameworks.
- **What collusive or adversarial strategies emerge in open markets?** Understanding these patterns supports MEV policy and orderflow auction design.

The output is open research — published findings, reproducible experiments, and a growing corpus of knowledge that feeds back into Ethereum protocol design. This aligns with the d/acc philosophy: proactively building understanding of agent economics to strengthen Ethereum's position as the trust layer for the machine economy.

## How It Works

**The Arena.** A sandboxed environment where agents operate with real on-chain primitives — ERC-8004 identity, x402 payments, programmable wallets, DeFi protocols. Agents are fully autonomous. No hidden human control during experiments.

**The Experiments.** Structured games drawn from behavioral economics, each with clear rules, measurable outcomes, and human baselines for comparison.

**The Human Layer.** People write the system prompts (strategies) that drive agent behavior. A prediction market layer — aligned with Vitalik's vision of prediction markets as information tools — lets observers bet on outcomes: which strategies dominate, which cooperate, which fail. This drives attention, participation, funding for new research and may serve as signals to the participating agents themselves.

**The Research.** Each experiment produces structured findings: how agents behaved, how outcomes compared to human baselines, what systemic patterns emerged. All open source, all reproducible.

## Current Status

The first experiment — the Ultimatum Game with three AI agents on Base — is being built. Three agents (researcher, proposer, responder) play the classic game autonomously in a Telegram group chat, settling payments via x402 and building reputation via ERC-8004. Different human-authored strategies produce different outcomes, observable in real time.

## The Ask

We'd welcome the opportunity to collaborate with the dAI team:

1. **Research partnership** — Co-define the experiment roadmap, prioritizing games most relevant to Ethereum's agent infrastructure (ERC-8004 reputation dynamics, x402 payment patterns, smart account guardrail design)
2. **Distribution** — Publish findings through EF research channels to reach protocol designers, the Robust Incentives Group, and the broader ecosystem
3. **Funding** — Potential support under a grants program or a targeted AI RFP.

---