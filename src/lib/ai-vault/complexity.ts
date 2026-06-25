import type { AiTaskComplexity, AiTaskKind } from "@/lib/ai-vault/types";

export function inferTaskComplexity(args: {
  system?: string;
  user: string;
  maxTokens?: number;
  kind?: AiTaskKind;
  complexity?: AiTaskComplexity;
}): AiTaskComplexity {
  if (args.complexity) return args.complexity;

  const combined = `${args.system ?? ""}\n${args.user}`.trim();
  const length = combined.length;
  const maxTokens = args.maxTokens ?? 2000;
  const kind = args.kind ?? "chat";

  if (kind === "classification" && length < 3500 && maxTokens <= 1500) {
    return "simple";
  }

  if (kind === "research" || maxTokens >= 6000 || length > 14_000) {
    return "complex";
  }

  if ((kind === "creative" || kind === "json") && (length > 7000 || maxTokens >= 4000)) {
    return "complex";
  }

  if (kind === "chat" && maxTokens >= 600) {
    return length > 9000 ? "complex" : "standard";
  }

  if (length < 2200 && maxTokens <= 1200) {
    return "simple";
  }

  return "standard";
}
