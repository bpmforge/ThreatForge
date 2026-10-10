/**
 * Database-backed Prompt Executor
 *
 * Handles execution of prompts stored in the database.
 * All executions use the universal system prompt with anti-injection guardrails.
 * Per-template systemPrompt is used only as a task-specific addendum.
 */
import type {
  AIProviderClient,
  ThreatModelContext,
  AISuggestedThreat,
  AISuggestedMitigation,
} from "../../types/ai.js";
import {
  getBuiltInPrompt,
  preparePrompt,
  preparePromptFromDocument,
  interpolatePrompt,
  logExecution,
} from "./prompt-service.js";
import {
  getUniversalSystemPrompt,
  getUserWritingStyle,
} from "./universal-system-prompt.js";
import {
  parseThreatsFromResponse,
  parseMitigationsFromResponse,
} from "./response-parsers.js";

export interface ExecutionContext {
  client: AIProviderClient;
  provider: string;
  model?: string;
  userId?: string;
  organizationId?: string;
}

/** Execute a prompt from the database by its ID. */
export async function executePromptFromDB(
  promptId: string,
  variables: Record<string, unknown>,
  context: ExecutionContext,
): Promise<{ content: string; promptName: string }> {
  const startTime = Date.now();
  const prepared = await preparePrompt(promptId, variables);

  if (!prepared) {
    throw new Error(`Prompt not found: ${promptId}`);
  }

  try {
    const writingStyle = context.userId
      ? await getUserWritingStyle(context.userId)
      : undefined;
    const systemPrompt = getUniversalSystemPrompt(
      prepared.systemPrompt || undefined,
      writingStyle,
    );

    const response = await context.client.complete({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prepared.userPrompt },
      ],
      temperature: prepared.temperature,
      maxTokens: prepared.maxTokens,
    });

    if (context.userId) {
      await logExecution({
        promptId: prepared.promptId,
        promptName: prepared.promptName,
        userId: context.userId,
        organizationId: context.organizationId,
        inputVariables: variables,
        outputResult: response.content,
        status: "COMPLETED",
        durationMs: Date.now() - startTime,
        provider: context.provider,
        model: context.model,
      });
    }

    return { content: response.content, promptName: prepared.promptName };
  } catch (err) {
    if (context.userId) {
      await logExecution({
        promptId: prepared.promptId,
        promptName: prepared.promptName,
        userId: context.userId,
        organizationId: context.organizationId,
        inputVariables: variables,
        status: "FAILED",
        durationMs: Date.now() - startTime,
        provider: context.provider,
        model: context.model,
        errorMessage: err instanceof Error ? err.message : "Unknown error",
      });
    }
    throw err;
  }
}

/** Extract architecture from document using database-backed prompts. */
export async function extractArchitectureWithDBPrompts(
  documentContent: string,
  context: ExecutionContext,
): Promise<{
  content: string;
  documentType: string;
  promptName: string;
} | null> {
  const startTime = Date.now();

  const prepared = await preparePromptFromDocument(
    documentContent,
    {},
    context.organizationId,
  );

  if (!prepared) {
    return null;
  }

  try {
    const systemPrompt = getUniversalSystemPrompt(
      prepared.prepared.systemPrompt || undefined,
    );

    const response = await context.client.complete({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prepared.prepared.userPrompt },
      ],
      temperature: prepared.prepared.temperature,
      maxTokens: prepared.prepared.maxTokens,
    });

    if (context.userId) {
      await logExecution({
        promptId: prepared.prepared.promptId,
        promptName: prepared.prepared.promptName,
        documentTypeId: prepared.documentType.id,
        documentTypeName: prepared.documentType.name,
        userId: context.userId,
        organizationId: context.organizationId,
        inputDocument: documentContent.slice(0, 5000),
        outputResult: response.content,
        status: "COMPLETED",
        durationMs: Date.now() - startTime,
        provider: context.provider,
        model: context.model,
      });
    }

    return {
      content: response.content,
      documentType: prepared.documentType.name,
      promptName: prepared.prepared.promptName,
    };
  } catch (err) {
    if (context.userId) {
      await logExecution({
        promptId: prepared.prepared.promptId,
        promptName: prepared.prepared.promptName,
        documentTypeId: prepared.documentType.id,
        documentTypeName: prepared.documentType.name,
        userId: context.userId,
        organizationId: context.organizationId,
        inputDocument: documentContent.slice(0, 5000),
        status: "FAILED",
        durationMs: Date.now() - startTime,
        provider: context.provider,
        model: context.model,
        errorMessage: err instanceof Error ? err.message : "Unknown error",
      });
    }
    throw err;
  }
}

/** Build context variables for threat analysis. */
function buildThreatContextVariables(
  threatContext: ThreatModelContext,
): Record<string, string> {
  const components =
    threatContext.components.length > 0
      ? threatContext.components
          .map(
            (c) =>
              `- **${c.name}** (${c.type})${c.description ? `: ${c.description}` : ""}`,
          )
          .join("\n")
      : "No components defined yet.";

  const connections =
    threatContext.connections.length > 0
      ? threatContext.connections
          .map(
            (c) =>
              `- ${c.source} → ${c.target}${c.label ? ` [${c.label}]` : ""}${c.protocol ? ` (${c.protocol})` : ""}${c.encrypted ? " [encrypted]" : ""}`,
          )
          .join("\n")
      : "No data flows defined yet.";

  const boundaries =
    threatContext.boundaries.length > 0
      ? threatContext.boundaries
          .map((b) => `- ${b.name}${b.trustLevel ? ` (${b.trustLevel})` : ""}`)
          .join("\n")
      : "No trust boundaries defined yet.";

  return {
    systemName: threatContext.name || "Unnamed System",
    components,
    connections,
    boundaries,
  };
}

type BuiltInPrompt = NonNullable<Awaited<ReturnType<typeof getBuiltInPrompt>>>;

/**
 * Run a built-in prompt with the user's writing style for `styleKind`,
 * log the execution, and parse the response. Returns null on any failure.
 */
async function runStyledPrompt<T>(
  prompt: BuiltInPrompt,
  variables: Record<string, unknown>,
  styleKind: "threats" | "mitigations",
  context: ExecutionContext,
  startTime: number,
  parse: (content: string) => T,
): Promise<T | null> {
  try {
    const writingStyle = context.userId
      ? await getUserWritingStyle(context.userId, styleKind)
      : undefined;
    const taskAddendum = interpolatePrompt(prompt.systemPrompt, variables);
    const systemPrompt = getUniversalSystemPrompt(
      taskAddendum || undefined,
      writingStyle,
    );
    const userPrompt = interpolatePrompt(prompt.userPromptTemplate, variables);

    const response = await context.client.complete({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: prompt.temperature,
      maxTokens: prompt.maxTokens,
    });

    if (context.userId) {
      await logExecution({
        promptId: prompt.id,
        promptName: prompt.name,
        userId: context.userId,
        organizationId: context.organizationId,
        inputVariables: variables,
        outputResult: response.content,
        status: "COMPLETED",
        durationMs: Date.now() - startTime,
        provider: context.provider,
        model: context.model,
      });
    }

    return parse(response.content);
  } catch (err) {
    if (context.userId) {
      await logExecution({
        promptId: prompt.id,
        promptName: prompt.name,
        userId: context.userId,
        organizationId: context.organizationId,
        inputVariables: variables,
        status: "FAILED",
        durationMs: Date.now() - startTime,
        provider: context.provider,
        model: context.model,
        errorMessage: err instanceof Error ? err.message : "Unknown error",
      });
    }
    return null;
  }
}

/** Suggest threats using database-backed prompts. */
export async function suggestThreatsWithDBPrompts(
  threatContext: ThreatModelContext,
  context: ExecutionContext,
): Promise<AISuggestedThreat[] | null> {
  const startTime = Date.now();

  const prompt = await getBuiltInPrompt("threat-analysis");
  if (!prompt) {
    return null;
  }

  const variables = buildThreatContextVariables(threatContext);

  return runStyledPrompt(
    prompt,
    variables,
    "threats",
    context,
    startTime,
    parseThreatsFromResponse,
  );
}

/** Suggest mitigations using database-backed prompts. */
export async function suggestMitigationsWithDBPrompts(
  threat: { title: string; description: string; category: string },
  threatContext: ThreatModelContext | undefined,
  context: ExecutionContext,
): Promise<AISuggestedMitigation[] | null> {
  const startTime = Date.now();

  const prompt = await getBuiltInPrompt("mitigation-suggestions");
  if (!prompt) {
    return null;
  }

  const contextText = threatContext
    ? `System "${threatContext.name}" with ${threatContext.components.length} components, ${threatContext.connections.length} data flows, and ${threatContext.boundaries.length} trust boundaries.`
    : "No additional system context available.";

  const variables = {
    threatTitle: threat.title,
    threatDescription: threat.description,
    category: threat.category,
    context: contextText,
  };

  return runStyledPrompt(
    prompt,
    variables,
    "mitigations",
    context,
    startTime,
    parseMitigationsFromResponse,
  );
}
