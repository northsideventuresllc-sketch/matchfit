# Northside AI Vault (default for all projects)

Match Fit and sibling repos (Hermes, NI Brain agents, future Northside apps) use a **single AI provider chain** stored in Postgres `platform_secrets` (the **AI Vault**).

## Provider order (mandatory)

1. **Claude (Anthropic)** — primary. Auto-select model by task complexity:
   - `simple` → `claude-haiku-4-5`
   - `standard` → `claude-sonnet-4-6`
   - `complex` → `claude-opus-4-6`
2. **Gemini primary** — `GEMINI_API_KEY` (typically `AIza...`)
3. **Gemini backup** — `GEMINI_API_KEY_BACKUP` (typically `AQ....`)

Only after all three fail should a feature surface a generation error.

## Vault keys (`platform_secrets`)

| Key | Purpose |
|-----|---------|
| `ANTHROPIC_API_KEY` | Claude primary |
| `GEMINI_API_KEY` | Gemini primary fallback |
| `GEMINI_API_KEY_BACKUP` | Gemini secondary fallback |
| `GEMINI_MODEL` | Default `gemini-2.5-flash` (falls back through 2.5-flash-lite, 2.0-flash) |

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
