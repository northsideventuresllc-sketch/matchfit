export type AiTaskComplexity = "simple" | "standard" | "complex";

export type AiTaskKind = "chat" | "json" | "classification" | "creative" | "research";

export type AiVaultProviderId =
  | "axon-local"
  | "runpod-axon-v1"
  | "openrouter"
  | "anthropic"
  | "gemini-primary"
  | "gemini-backup";

export type MatchFitAiCallArgs = {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
  timeoutMs?: number;
  complexity?: AiTaskComplexity;
  kind?: AiTaskKind;
  /** Override auto-selected Claude model when set. */
  modelOverride?: string;
  /** Prior chat turns (Anthropic path only). */
  priorTurns?: Array<{ role: "user" | "assistant"; content: string }>;
  /** Anthropic-only tools (e.g. web_search). Not passed to Gemini fallback. */
  anthropicTools?: unknown[];
};

export type MatchFitAiAttempt = {
  provider: AiVaultProviderId | "anthropic-retry";
  model: string;
  error?: string;
};

export type MatchFitAiCallResult = {
  text: string | null;
  provider: AiVaultProviderId | null;
  model: string | null;
  complexity: AiTaskComplexity;
  usedFallback: boolean;
  error?: string;
  attempts: MatchFitAiAttempt[];
};

export type AiVaultStatus = {
  configured: boolean;
  anthropic: boolean;
  geminiPrimary: boolean;
  geminiBackup: boolean;
  message: string;
};
