# ADR-008: Keep the legacy AI analysis pipeline beside the agent chain

**Status:** Accepted (2026-10-09)

## Context
Threat analysis has two implementations. The agent chain
(`agentic-analysis-v2.ts`, `expert-analysis-v2.ts`, `jobs/suggest-threats-v2*`)
runs the stages registered in the built-in `threat-analysis-v2` prompt
pipeline. The original pipeline (`agentic-analysis.ts`, `expert-analysis.ts`,
`micro-analysis/pipeline.ts`) runs the same steps as hard-wired code.

`services/ai/agent-chain-flag.ts` chooses between them per organization. The
agent chain is the default. The legacy path runs only when an organization sets
`features.agentChainV2: false`, or when the built-in pipeline has not been
seeded (`npm run seed:pipelines`), so an unseeded install keeps working.

The comparison tests (`server/src/test/parity-*.test.ts`) record both paths
against the same replayed model output and require the agent chain to produce
the same threats. Several v2 stages are deliberate ports of legacy code for
that reason, which is why some duplication between the two remains.

## Decision
Keep both paths for now. The legacy pipeline is the reference the agent chain
is measured against and the fallback for unseeded installs. New analysis work
goes into the agent-chain stages only; the legacy code is changed only to keep
the comparison tests meaningful.

## Consequences
- Two implementations of the same analysis remain, and some code is
  intentionally duplicated between them (excluded from refactoring).
- Removing the legacy path is a separate decision. It needs the seed step to
  run on every install (so the fallback is not needed) and a different
  baseline for the comparison tests, such as recorded expected outputs.
