# Northside AI Vault (default for all projects)

Match Fit and sibling repos (Hermes, NI Brain agents, future Northside apps) use a **single AI provider chain** stored in Postgres `platform_secrets` (the **AI Vault**). This is the ONE canonical tier order — binding, same in every NVG repo, per JB direct order 2026-08-20.

## Provider order (mandatory)

1. **AXON local** — AXON's free Mac-mini Ollama model (`axon-ornith:latest`), reached via the `nvg_mini_jobs` relay. Free, tried first, every time.
2. **RunPod AXON v1** — NVG's own fine-tuned model (base: `Qwen3-Coder-30B-A3B-Instruct`, per NI-Brain Decision #1261), hosted on RunPod. **Not deployed yet** as of 2026-08-20 — this tier is wired into the code and returns `null` immediately (no network call) until `RUNPOD_AXON_V1_ENDPOINT` / `RUNPOD_AXON_V1_KEY` are set, so it is currently a no-op that falls straight through to Gemini.
3. **Gemini primary** — `GEMINI_API_KEY` (typically `AIza...`)
4. **Gemini backup** — `GEMINI_API_KEY_BACKUP` (typically `AQ....`)
5. **Claude (Anthropic)** — last resort, paid. Only reached once every free tier above has failed. Auto-select model by task complexity:
   - `simple` → `claude-haiku-4-5`
   - `standard` → `claude-sonnet-4-6`
   - `complex` → `claude-opus-4-6`

Only after all five fail should a feature surface a generation error.

## Vault keys (`platform_secrets`)

| Key | Purpose |
|-----|---------|
| `RUNPOD_AXON_V1_ENDPOINT` | RunPod AXON v1 inference endpoint URL (not set yet — pod not deployed) |
| `RUNPOD_AXON_V1_KEY` | RunPod AXON v1 API key (not set yet — pod not deployed) |
| `GEMINI_API_KEY` | Gemini primary |
| `GEMINI_API_KEY_BACKUP` | Gemini backup |
| `GEMINI_MODEL` | Default `gemini-2.5-flash` (falls back through 2.5-flash-lite, 2.0-flash) |
| `ANTHROPIC_API_KEY` | Claude, last-resort paid fallback |

## Match Fit implementation

- Router: `src/lib/ai-vault/` — import `callMatchFitAi` from `@/lib/ai-vault`
- Hydration: `src/lib/hydrate-platform-env.ts` loads vault keys into `process.env`
- Seed script: `npm run seed:ai-vault` (requires `DATABASE_URL`)

## Hermes & other repos

Copy the `ai-vault` module pattern or depend on the same `platform_secrets` table. **Never** hardcode API keys in source. Always:

```ts
await hydratePlatformEnvFromDatabase();
const result = await callMatchFitAi({ system, user, kind: "creative", jsonMode: true });
if (!result.text) throw new Error(result.error ?? "AI failed");
```

## OpenAI

OpenAI is **not** in the text-generation fallback chain. `OPENAI_API_KEY` remains optional for DALL·E static images only.
