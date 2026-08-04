---
name: nvg-graph-engineering
description: >-
  How to shape agent → subagent work for NVG. Read this BEFORE planning any
  multi-agent, multi-step or parallel job across Northside Ventures — the four
  daily workflows, content generation, lead finding, the nightly health scan,
  or builds across the matchfit, northside-intelligence, axon and nv-vault
  repos. Covers when to fan out vs stay single-threaded, how deep to nest, what
  each subagent must be told, where verification belongs, which agents exist and
  what they are allowed to touch, and the actions that can never be delegated to
  any agent. Trigger on: "spawn", "subagent", "parallel", "delegate", "fan out",
  "orchestrate", "run these at once", "who should do what", or any plan with
  more than three steps.
---

# GRAPH ENGINEERING — NVG AGENT TOPOLOGY

**Plain English:** "graph engineering" = deciding **who does what, in what order, and who checks it.**
The graph is the shape of the work. Get the shape wrong and more agents makes it worse, not better.

> **The one-line rule:** *Fan out for looking. Stay single for deciding. Always verify with a different agent. Never delegate anything that leaves the building.*

---

## 1 — THE FIVE SHAPES (and when each is right)

| Shape | What it is | Use it for | Don't use it for |
|---|---|---|---|
| **Single thread** | One agent, one context, start to finish | Anything with a shared resource or a shared decision | Wide research |
| **Pipeline** | A → B → C, each step feeds the next | Generate → crop → upload → publish | Independent work |
| **Orchestrator + workers** | One boss splits the job, workers run in parallel, boss merges | Lead finding, health scan, research | Anything where workers must agree with each other |
| **Map-reduce (barrier)** | Fan out N identical jobs, **wait for all**, then combine | Nightly scan roll-up, daily brief | Work where one slow item blocks value |
| **Blackboard** | Post the need on a shared board, whoever can help picks it up | Big messy search across unknown territory | Small, known tasks |

**NVG default = orchestrator + workers, depth 2, barrier before JB sees anything.**

---

## 2 — DEPTH: HOW MANY LAYERS

- **Layer 0 — JB.** Human. Only he approves anything that leaves the building.
- **Layer 1 — one orchestrator per run.** Owns the plan, the batch, the ping. **Does not do the work.**
- **Layer 2 — workers and verifiers.** Do the work. Report facts.
- **Layer 3 — banned for NVG.**

**Why depth 3 is banned here:**
- A subagent starts with **only the prompt string it was handed** — no parent history. Every hop is a lossy re-telling.
- Two hops of re-telling is where the locked rules (white frame, no geography, approve-only) quietly get dropped.
- The boss can't steer something two levels down; it just waits.

Claude Code allows nested subagents up to 3 layers by default. **For NVG, set it to 1** (`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1`) unless the orchestrator explicitly needs a worker to spawn a verifier — then 2. Never more.

---

## 3 — WHAT FANS OUT vs WHAT STAYS SINGLE

**Fan out (parallel) when all three are true:**
- The pieces **don't need to agree** with each other
- They **don't share a resource** (one browser, one Instagram session, one file)
- You can write **one sentence per lane** saying exactly what that lane owns

**Stay single-threaded when any of these is true:**
- **Shared resource** — the browser, the Mac mini, the Android emulator, the publishing page
- **Shared contract** — a DB schema, a shared component, a caption that must match across platforms
- **Naturally sequential** — generate → crop → upload → post
- **One writer rule** — if two agents could edit the same thing, only one may.

**Fan-out sizing:**
- Simple lookup → **1 agent**
- Compare 2–4 things → **1 agent per thing**
- Wide research or scan → **up to 6 lanes** (hard cap for NVG)
- More than 6 → you have not split it properly. Split by *noun*, not by *verb*.

**Barrier vs pipeline:**
- **Barrier** (wait for all, then act) → anything JB will read. He gets **one batch, not ten pings.**
- **Pipeline** (each item flows on its own) → machine-to-machine work with no human at the end.

---

## 4 — THE CONTEXT CONTRACT (every delegation, no exceptions)

A subagent gets **nothing** but what you write in the prompt. No parent history, no earlier tool results.
So every delegation carries all seven:

1. **Goal** — one sentence.
2. **Done means** — the artifact that proves it (file path, commit SHA, DB row id, live URL, screenshot).
3. **Inputs** — absolute paths, IDs, URLs. Never "the file we looked at".
4. **Constraints that apply** — paste them. Don't say "follow the rules".
5. **Output format** — exactly what to hand back.
6. **Out of scope** — name the neighbouring lanes so it doesn't wander into them.
7. **Budget** — max tool calls / max time, so it can't loop forever.

**Miss #6 and you get duplicated work. Miss #4 and you get drift. Miss #2 and you get "done" with nothing behind it.**

---

## 5 — VERIFICATION TOPOLOGY

**Hard rule: the agent that made the thing never grades the thing.**
Models rate their own output higher because it *reads familiar* to them, not because it's better. Self-grading is not verification; it's a mirror.

**Three checkers, all read-only, all separate from the producer:**

- **`proof-check`** — takes each claim and finds the artifact. No artifact = the claim is false. Tools: Read, Grep, Glob, DB read, fetch URL. **No write, no Bash-that-mutates.**
- **`brand-gate`** — content only. Checks: white frame cropped out, format unchanged (a carousel stays a carousel), Instagram crop = Original, hashtags are real high-volume tags, **Match Fit has zero geography anywhere**, AI label on.
- **`blast-radius`** — reads every proposed action and sorts it into *act* vs *needs JB*. Runs **before** the batch is shown to JB, never after.

**Cap the loop.** Producer → checker → one fix → re-check. If it fails twice, it goes to JB as a problem, not a third rewrite.

---

## 6 — THE NVG AGENT ROSTER

### Layer 1 — orchestrator (exactly one per run)

**`nvg-day`** — the day runner.
- Owns: the plan, the fan-out, the barrier, the single batched ping to JB, the approval queue.
- Never generates content, never touches a browser, never sends anything.
- Holds JB's approval gate. **A worker must never ask JB anything directly** — it returns a proposal, `nvg-day` batches it.

### Layer 2 — workers

| Agent | Owns | Can touch | Must never |
|---|---|---|---|
| **`mf-content`** | Match Fit posts: carousel + static + video prompts, captions, hashtags | Match Fit Admin Portal content calendar, matchfit repo | Post. Touch NI anything. Use geography. |
| **`ni-content`** | NI posts, on the NI content schedule | NI Content Machine, northside-intelligence repo | Post. Touch Match Fit anything. |
| **`mf-leads`** | 5 Instagram + 5 email leads, online/virtual coaches **nationwide** | Match Fit Outreach HQ (draft rows only) | Send, DM, follow, comment. Write a city or a radius. |
| **`ni-leads`** | 5 LinkedIn + 5 email leads | NI Outreach HQ (draft rows only) | Send, DM, connect, follow. |
| **`media-hands`** | Browser hands: Gemini generation → crop white frame → download → upload to publishing page | Browser, Desktop Commander, publishing page | **Run in parallel with itself.** One browser, one session — always single-threaded. |
| **`repo-build:<repo>`** | One per repo: `matchfit`, `northside-intelligence`, `axon`, `nv-vault` | That repo only | Edit another repo. Change a shared contract alone. |
| **`health-scan`** | Nightly read-only sweep: crons, deploys, DB, **both Resend accounts**, queue depth | Read everything | Fix anything. It reports; `nvg-day` decides. |

### Layer 2 — verifiers
`proof-check` · `brand-gate` · `blast-radius` (section 5).

### Enforce by tools, not by words
**Instructions drift across hops. Tool lists don't.**
If an agent must not post, **don't give it the posting tool.** If it must not delete, no delete tool. A missing tool is silent and absolute; a rule in a prompt is a suggestion two hops down.

---

## 7 — WIRING THE REAL NVG WORK

### The four daily workflows
```
nvg-day
├─ (parallel, barrier)  mf-content   ni-content   mf-leads   ni-leads
├─ brand-gate + blast-radius  ← on the merged batch
├─ ONE ping to JB → JB edits → JB approves        ◄── HARD STOP
└─ (sequential, single-threaded)  media-hands → JB approves → JB posts / JB sends
```
- **Generation fans out. Publishing never does.**
- The four workflows **never mix**. Four lanes, four destinations, no cross-writes.
- JB's approval is a **barrier held by `nvg-day`**. It is never delegated, never inferred, never "already given last time".

### Content generation
- Fan out by **post type** (video / static / carousel) — they're independent.
- **Do not** fan out by platform — the caption and image set must stay consistent across Facebook, Threads, Instagram, TikTok, LinkedIn, Reddit. One writer.

### Outreach lead finding
- Fan out by **source**, one lane each, each lane told what the other lanes own.
- Dedupe at the barrier, not inside the lanes.
- Lanes produce **drafts only**. Every DM, email, comment and follow is JB's.

### Nightly health scan
- Classic map-reduce: 4–6 read-only lanes → barrier → one roll-up.
- **Always include a "silent failure" lane.** NVG's known one: NI mail sent with the Match Fit Resend key **fails without an error**. A scan that only looks for errors will call that healthy.
- Scan **never** fixes. Read-only tools. Findings go to `nvg-day`.

### Repo builds (4 repos)
- **Repo-local change → fan out**, one `repo-build` per repo, in parallel.
- **Cross-repo change (shared schema, shared contract, an API both sides use) → ONE agent, single thread.** Two agents guessing at the same interface produce two halves that don't fit.
- Merge and deploy are **not** hard stops. Ship them.

---

## 8 — THE FAILURE MODES (what actually goes wrong)

Ranked by how much damage they do to NVG.

1. **Instruction drift / bad spec** — the biggest single bucket in the research (~42% of observed multi-agent failures). The locked rules get thinner at every hop until a post goes out with a white frame in it. **Fix: paste constraints into every prompt, and remove the tool instead of trusting the rule.**
2. **Weak verification** (~21%) — stopping early, calling it done, checking the wrong thing. Made worse by self-grading. **Fix: separate `proof-check`, artifact or it didn't happen.**
3. **Duplicated / conflicting work** — vague lanes mean two agents research the same thing, or build two halves that don't fit together. **Fix: name what each lane owns AND what it doesn't.**
4. **Silent partial failure** — the run "succeeds" and nothing happened. The Resend key case. **Fix: assert the positive artifact, never the absence of an error.**
5. **Lost in the middle / context rot** — models reliably lose information buried in the middle of a long input, and get worse as input grows. **Fix: put the constraint and the ask at the top and the bottom of a delegation, never buried.**
6. **Cost blowup** — multi-agent runs burn roughly **15× the tokens** of a plain chat. **Fix: only fan out for high-value work; use a small model for classify/extract/format lanes.**

---

## 9 — NEVER DELEGATED. NOT TO ANY AGENT, AT ANY DEPTH.

These are JB's. An agent may **prepare** them and **queue** them. It may never **fire** them.

- **Reaches a person** — DM, email, comment, follow, connect request
- **Goes public** — post, ad, listing
- **Spends money**
- **Permanent delete with no undo**
- **Billing, payment, or live customer-facing prices**

**Enforcement, in order:**
1. The tool is not in the subagent's tool list.
2. `blast-radius` re-classifies the batch before JB sees it.
3. `nvg-day` holds the gate and pings once.

Everything else — browser, code, commit, **merge to main, deploy to production**, DB reads, additive migrations, generating, cropping, uploading to a review page — **act by default. Don't ask.**

---

## 10 — PRE-FLIGHT (run this before spawning anything)

- [ ] Can one agent do this? → **then use one agent.**
- [ ] Do the lanes need to agree with each other? → **then don't parallelise.**
- [ ] Does every lane have a one-sentence "you own this, not that"?
- [ ] Does every prompt carry all seven contract items (§4)?
- [ ] Is the verifier a **different** agent from the producer?
- [ ] Does any lane hold a tool that could leave the building? → **strip it.**
- [ ] Is there a barrier before JB, so he gets **one batch**?
- [ ] Is depth ≤ 2?

---

## SOURCES (verified July 2026)

- Anthropic — [Building Effective Agents](https://www.anthropic.com/research/building-effective-agents): prompt chaining, routing, parallelisation, orchestrator-workers, evaluator-optimizer; "add complexity only when simpler solutions fall short"; separate guardrail instance beats one call doing both.
- Anthropic — [How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system): ~15× token cost; fan-out sizing (1 agent / 2–4 / 10+); avoids cascading agent structures because they bottleneck and block steering; duplicated work from vague instructions; LLM-as-judge rubric.
- Cemri et al. — [Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657) (MAST, NeurIPS 2025): 14 failure modes; specification issues 41.8%, inter-agent misalignment 36.9%, verification 21.3%; multi-level verification gave +15.6% absolute.
- Cognition — [Don't Build Multi-Agents](https://cognition.com/blog/dont-build-multi-agents): share full traces not messages; parallel agents make conflicting implicit decisions; single-threaded linear agent as default.
- Liu et al. — [Lost in the Middle](https://arxiv.org/abs/2307.03172) (TACL 2024): retrieval accuracy drops for information in the middle of long inputs.
- Chroma — [Context Rot](https://research.trychroma.com/context-rot): model performance degrades as input length grows, even on simple tasks.
- Wataoka et al. — [Self-Preference Bias in LLM-as-a-Judge](https://arxiv.org/html/2410.21819v1): judges over-reward low-perplexity (familiar-to-them) text — a producer grading itself is biased by construction.
- Anthropic — [Claude Agent SDK: Subagents](https://code.claude.com/docs/en/agent-sdk/subagents): fresh context per subagent, only the Agent-tool prompt is passed in, only the final message comes back; per-agent tool restriction and model override; nesting default 3 layers, adjustable via `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`.
- Microsoft — [AI agent orchestration patterns](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns): sequential / concurrent / group chat / handoff / magentic; group chat capped at ≤3 agents; validate output between stages; cheaper models for simple lanes.
- [LLM-based Multi-Agent Blackboard System](https://arxiv.org/abs/2510.01285): blackboard beats master-slave assignment when capabilities are unknown or overlapping (13–57% relative task-success gain in their benchmarks).
- [Scaling LangGraph Agents](https://aipractitioner.substack.com/p/scaling-langgraph-agents-parallelization): Send API map-reduce, state reducers for concurrent writes, `defer=True` as an explicit barrier.
- [openai/swarm](https://github.com/openai/swarm): "Swarm is now replaced by the OpenAI Agents SDK" — Swarm is educational only; handoff primitive lives on in the Agents SDK.

### Honest read on frameworks
- **Claude Agent SDK** — strongest **context isolation** and **per-agent tool restriction**. Best fit for NVG because safety is enforced by the tool list, not by prose.
- **LangGraph** — explicit graph/state machine, real barriers and map-reduce. Best when you need the topology written down and replayable. Heavier.
- **CrewAI** — role-based crews, fastest to prototype, weaker production observability.
- **AutoGen** — conversational group chat and debate; research-leaning.
- **OpenAI Swarm** — deprecated; its handoff idea survives in the Agents SDK.
- *Unverified:* market-share percentages for these frameworks circulate in vendor blogs with no primary source. Ignore them.
