# ADR-003: Use Fastify for Backend API

**Status:** Accepted
**Date:** 2025-12-30
**Decision Makers:** Architecture Team

---

## Context

ThreatForge needs a backend API server for:
- REST API endpoints
- WebSocket support (real-time collaboration)
- Authentication handling
- Database operations (Prisma)
- AI provider integrations

We need a Node.js framework that:
- Has excellent TypeScript support
- Is performant for real-time features
- Supports WebSockets natively or easily
- Works well with Prisma ORM
- Has good plugin/middleware ecosystem

---

## Options Considered

### Option 1: Fastify

**Description:** Fast and low overhead web framework for Node.js.

**Pros:**
- Fastest Node.js framework (benchmarks)
- First-class TypeScript support
- Schema-based validation (JSON Schema)
- Plugin architecture
- Built-in logging (pino)
- WebSocket support via @fastify/websocket
- Active development
- Good documentation

**Cons:**
- Smaller ecosystem than Express
- Different plugin model to learn
- Less Stack Overflow answers than Express

### Option 2: Express.js

**Description:** Minimal and flexible Node.js web framework.

**Pros:**
- Most popular Node.js framework
- Huge ecosystem
- Simple to learn
- Massive community

**Cons:**
- Performance is lower than Fastify (~2x slower)
- TypeScript support is okay but not first-class
- Middleware pattern can get messy
- Error handling less structured
- Aging architecture

### Option 3: NestJS

**Description:** Progressive Node.js framework built with TypeScript.

**Pros:**
- Excellent TypeScript support
- Angular-like structure (decorators)
- Built-in dependency injection
- WebSocket gateway
- OpenAPI generation

**Cons:**
- Heavy framework (learning curve)
- More opinionated
- Overkill for our API size
- Decorator-based (some dislike)
- Performance overhead

### Option 4: Hono

**Description:** Small, simple, and ultrafast web framework.

**Pros:**
- Extremely fast
- Works on edge (Cloudflare Workers)
- Small bundle

**Cons:**
- Newer, less mature
- Smaller ecosystem
- Edge-focused (we need Node.js)

### Option 5: tRPC

**Description:** End-to-end typesafe APIs made easy.

**Pros:**
- End-to-end type safety
- No API layer generation
- Great DX

**Cons:**
- Tightly coupled to TypeScript
- Less suitable for public APIs
- WebSocket support less mature
- Would need REST alongside for integrations

---

## Decision

**We choose Fastify.**

---

## Rationale

1. **Performance:** Fastest mainstream Node.js framework (~65k req/s vs Express ~35k req/s)
2. **TypeScript:** First-class support with typed routes
3. **Validation:** Built-in JSON Schema validation
4. **WebSockets:** @fastify/websocket integrates cleanly
5. **Logging:** Built-in structured logging with Pino
6. **Plugin system:** Clean, encapsulated plugin architecture
7. **Modern:** Active development, good practices
8. **Prisma:** Works seamlessly with Prisma ORM

---

## Implementation

### Server Setup

```typescript
// server/src/index.ts
import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';

const app = Fastify({
  logger: true,
});

await app.register(cors, { origin: true });
await app.register(websocket);

// Type-safe routes
app.get<{
  Params: { id: string };
  Reply: ThreatModel;
}>('/api/threat-models/:id', async (request) => {
  const { id } = request.params;
  return prisma.threatModel.findUnique({ where: { id } });
});

await app.listen({ port: 4000 });
```

### Plugin Pattern

```typescript
// server/src/api/threat-models.ts
import { FastifyPluginAsync } from 'fastify';

const threatModelsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', listThreatModels);
  app.get('/:id', getThreatModel);
  app.post('/', createThreatModel);
  app.put('/:id', updateThreatModel);
  app.delete('/:id', deleteThreatModel);
};

export default threatModelsRoutes;
```

---

## Consequences

### Positive
- High performance API
- Clean, typed code
- Great developer experience
- Built-in request validation
- Structured logging out of the box

### Negative
- Team needs to learn Fastify patterns
- Smaller ecosystem than Express
- Some Express middleware needs adaptation

### Mitigations
- Most plugins have Fastify equivalents
- Community is growing

---

## References

- [Fastify Documentation](https://fastify.dev/)
- [Fastify vs Express Benchmarks](https://fastify.dev/benchmarks/)
- [Fastify TypeScript](https://fastify.dev/docs/latest/Reference/TypeScript/)
