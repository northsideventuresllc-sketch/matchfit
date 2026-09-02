---
name: nvg-graph-engineering
description: POINTER ONLY (2026-09-02). Graph engineering — who does what, in what order, who checks — is the DEFAULT shape for every non-trivial NVG task. The rule lives in the golden skill `graph-engineering` (nv-vault); the full topology, roster and failure modes live in nv-vault `Workflows & SOPs/Graph Engineering — NVG Agent Topology.md`. Trigger on: spawn, subagent, parallel, delegate, fan out, orchestrate, any plan with more than three steps.
---

# nvg-graph-engineering → pointer

One-line rule: **fan out for looking, stay single for deciding, verify with a different agent, depth ≤ 2, Haiku/Sonnet for lanes, never delegate anything that leaves the building.**

- Skill (golden, always-on): `graph-engineering` in nv-vault.
- Full reference: nv-vault `Workflows & SOPs/Graph Engineering — NVG Agent Topology.md` (five shapes, context contract, verification topology, failure modes, sources).

This repo used to carry a 243-line copy that drifted from the vault; it was replaced by this pointer in the 2026-09-02 Agentic OS audit so there is one home.
