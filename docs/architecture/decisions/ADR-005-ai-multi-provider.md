# ADR-005: Multi-Provider AI Architecture

**Status:** Accepted
**Date:** 2025-12-30
**Decision Makers:** Architecture Team

---

## Context

ThreatForge uses AI for:
- Threat suggestions based on architecture
- Mitigation recommendations
- Chat-based security assistance
- Architecture analysis

We need to support multiple AI providers because:
- Users have different provider preferences
- Enterprise customers may require specific providers
- Local/self-hosted options for privacy
- Redundancy if a provider is down
- Cost optimization

---

## Options Considered

### Option 1: Single Provider (Anthropic/Claude)

**Description:** Lock into one provider.

**Pros:**
- Simpler implementation
- Optimized prompts for one model

**Cons:**
- Vendor lock-in
- Some enterprises can't use specific providers
- No fallback if provider is down
- Privacy concerns for some users

### Option 2: LangChain.js

**Description:** Framework for LLM application development.

**Pros:**
- Multi-provider abstraction
- Rich ecosystem
- Chains and agents
- Memory management

**Cons:**
- Heavy dependency
- Abstraction may hide provider specifics
- Some overhead
- Fast-moving, breaking changes

### Option 3: Custom Provider Interface

**Description:** Build our own provider abstraction.

**Pros:**
- Tailored to our needs
- Minimal dependencies
- Full control
- Can optimize per provider

**Cons:**
- More development effort
- Need to maintain each provider

### Option 4: Vercel AI SDK

**Description:** SDK for building AI-powered apps.

**Pros:**
- Multi-provider
- Streaming support
- React hooks

**Cons:**
- Tied to Vercel ecosystem
- Less flexible

---

## Decision

**We choose Custom Provider Interface with direct SDK integrations.**

---

## Rationale

1. **Control:** We can optimize prompts per provider
2. **Minimal deps:** Only add SDKs we need
3. **Flexibility:** Easy to add new providers
4. **Transparency:** Clear what's happening with each call
5. **Performance:** No abstraction overhead
6. **Security:** Full control over data handling

---

## Implementation

### Provider Interface

```typescript
// server/src/types/ai.ts
interface AIProviderClient {
  id: string;
  name: string;

  // Core methods
  generateCompletion(
    messages: Message[],
    options?: CompletionOptions
  ): Promise<CompletionResult>;

  generateCompletionStream(
    messages: Message[],
    options?: CompletionOptions
  ): AsyncIterable<StreamChunk>;

  // Health check
  checkHealth(): Promise<HealthStatus>;

  // Model listing (for local providers)
  listModels?(): Promise<ModelInfo[]>;
}
```

### Supported Providers

| Provider | Type | SDK | Status |
|----------|------|-----|--------|
| Anthropic (Claude) | Cloud | @anthropic-ai/sdk | ✅ Working |
| OpenAI | Cloud | openai | ✅ Working |
| Google (Gemini) | Cloud | @google/generative-ai | ✅ Working |
| Ollama | Local | ollama-js | ✅ Working |
| LM Studio | Local | OpenAI-compatible | ✅ Working |
| Azure OpenAI | Cloud | @azure/openai | Planned |

### Provider Manager

```typescript
// server/src/services/ai/provider-manager.ts
class ProviderManager {
  private providers: Map<string, AIProviderClient> = new Map();

  register(provider: AIProviderClient): void {
    this.providers.set(provider.id, provider);
  }

  get(id: string): AIProviderClient {
    const provider = this.providers.get(id);
    if (!provider) throw new Error(`Provider ${id} not found`);
    return provider;
  }

  async checkAllHealth(): Promise<HealthReport> {
    const results = await Promise.all(
      Array.from(this.providers.values()).map(p =>
        p.checkHealth().catch(e => ({ status: 'error', error: e.message }))
      )
    );
    return results;
  }

  // Fallback to next provider if primary fails
  async withFallback<T>(
    fn: (provider: AIProviderClient) => Promise<T>,
    providerIds: string[]
  ): Promise<T> {
    for (const id of providerIds) {
      try {
        return await fn(this.get(id));
      } catch (error) {
        console.warn(`Provider ${id} failed, trying next`);
      }
    }
    throw new Error('All providers failed');
  }
}
```

### Provider Factory

```typescript
// server/src/services/ai/providers/factory.ts
function createProvider(config: AIProviderConfig): AIProviderClient {
  switch (config.type) {
    case 'ANTHROPIC':
      return new AnthropicProvider(config);
    case 'OPENAI':
      return new OpenAIProvider(config);
    case 'GOOGLE':
      return new GeminiProvider(config);
    case 'OLLAMA':
      return new OllamaProvider(config);
    case 'LMSTUDIO':
      return new LMStudioProvider(config);
    default:
      throw new Error(`Unknown provider type: ${config.type}`);
  }
}
```

---

## Security Considerations

1. **API Key Encryption:** All API keys encrypted at rest (AES-256-GCM)
2. **Key Isolation:** Per-organization encryption keys
3. **Input Sanitization:** Prevent prompt injection
4. **Data Privacy:** Option to anonymize data before sending
5. **Audit Logging:** Log all AI interactions
6. **Rate Limiting:** Per-user and per-org limits

---

## Consequences

### Positive
- Users can choose preferred provider
- Privacy option with local providers
- Fallback for reliability
- Optimized prompts per model

### Negative
- More code to maintain
- Each provider has quirks
- Testing across providers

### Mitigations
- Comprehensive test suite per provider
- Abstract common patterns
- Document provider-specific behaviors

---

## References

- [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript)
- [OpenAI SDK](https://github.com/openai/openai-node)
- [Ollama API](https://github.com/ollama/ollama/blob/main/docs/api.md)
- [LM Studio API](https://lmstudio.ai/docs/api)
