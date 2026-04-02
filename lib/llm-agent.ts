/**
 * Provider-agnostic agentic loop.
 *
 * Switch providers with LLM_PROVIDER env var:
 *   LLM_PROVIDER=gemini    → Gemini 3.1 Flash Lite Preview  (default)
 *   LLM_PROVIDER=anthropic → Claude Sonnet 4.6
 */
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI, FunctionCallingConfigMode } from '@google/genai'
import type { Schema as GeminiSchema } from '@google/genai'

// ── Public types ────────────────────────────────────────────────────────────

/** Provider-agnostic tool definition. Parameters use standard JSON Schema (lowercase types). */
export interface ToolDef {
  name: string
  description: string
  /** JSON Schema object (type: 'object', properties, required). */
  parameters: Record<string, unknown>
}

export interface FnCall {
  id: string
  name: string
  args: unknown
}

export interface AgentOptions {
  /** System prompt passed to the model. */
  system: string
  /** First user message that starts the conversation. */
  userMessage: string
  /** All tools available to the model, including the terminal tool. */
  tools: ToolDef[]
  /**
   * When the model calls this tool name the loop stops and returns its args.
   * Tool results are NOT sent back to the model for this call.
   */
  terminalTool: string
  maxTokens?: number
  maxTurns?: number
  /**
   * Called with all non-terminal tool calls in a single batch.
   * Return one result per call, in the same order.
   */
  onTool: (calls: FnCall[]) => Promise<Array<{ id: string; name: string; result: string }>>
  /** Optional: called at the start of each turn for logging. */
  onTurn?: (turn: number) => void
  /** Optional label shown in log lines, e.g. "Search" or "CollectionsPreview". */
  label?: string
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getProvider(): 'anthropic' | 'gemini' {
  const v = process.env.LLM_PROVIDER?.toLowerCase()
  return v === 'anthropic' ? 'anthropic' : 'gemini'
}

async function withRetry<T>(fn: () => Promise<T>, label: string, maxAttempts = 4): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const status = (err as { status?: number }).status
      const retryable = status === 429 || status === 503 || status === 529
      if (!retryable || attempt === maxAttempts) throw err
      const delay = Math.pow(2, attempt) * 1000
      console.log(`[${label}] HTTP ${status} — retry ${attempt}/${maxAttempts - 1} in ${delay / 1000}s…`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw new Error('unreachable')
}

/** Recursively converts JSON Schema (lowercase types) → Gemini Schema (uppercase). */
function toGeminiSchema(schema: unknown): GeminiSchema {
  const s = schema as Record<string, unknown>
  const TYPE: Record<string, string> = {
    object: 'OBJECT', string: 'STRING', array: 'ARRAY',
    number: 'NUMBER', integer: 'INTEGER', boolean: 'BOOLEAN',
  }
  const out: Record<string, unknown> = {}
  if (s.type)        out.type = TYPE[s.type as string] ?? String(s.type).toUpperCase()
  if (s.description) out.description = s.description
  if (s.enum)        out.enum = s.enum
  if (s.required)    out.required = s.required
  if (s.properties)  out.properties = Object.fromEntries(
    Object.entries(s.properties as Record<string, unknown>).map(([k, v]) => [k, toGeminiSchema(v)])
  )
  if (s.items) out.items = toGeminiSchema(s.items)
  return out as unknown as GeminiSchema
}

// ── Anthropic loop ───────────────────────────────────────────────────────────

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6'

async function runAnthropicLoop(opts: AgentOptions, maxTurns: number, maxTokens: number) {
  const client = new Anthropic()

  const tools: Anthropic.Tool[] = opts.tools.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as Anthropic.Tool['input_schema'],
  }))

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: opts.userMessage },
  ]

  for (let turn = 0; turn < maxTurns; turn++) {
    opts.onTurn?.(turn + 1)

    const response = await withRetry<Anthropic.Message>(
      () => client.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: maxTokens,
        system: opts.system,
        tools,
        tool_choice: { type: 'any' },
        messages,
      }),
      'Anthropic',
    )

    const tag = opts.label ? `Anthropic/${opts.label}` : 'Anthropic'
    console.log(`[${tag}] Turn ${turn + 1} — stop=${response.stop_reason}, in=${response.usage.input_tokens} out=${response.usage.output_tokens}`)
    messages.push({ role: 'assistant', content: response.content })

    if (response.stop_reason === 'end_turn') return null

    const toolBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    )
    if (toolBlocks.length === 0) return null

    const terminalBlock = toolBlocks.find(b => b.name === opts.terminalTool)
    if (terminalBlock) return { args: terminalBlock.input }

    const calls: FnCall[] = toolBlocks.map(b => ({ id: b.id, name: b.name, args: b.input }))
    const results = await opts.onTool(calls)

    messages.push({
      role: 'user',
      content: results.map(r => ({
        type: 'tool_result' as const,
        tool_use_id: r.id,
        content: r.result,
      })),
    })
  }

  return null
}

// ── Gemini loop ──────────────────────────────────────────────────────────────

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.1-flash-lite-preview'

async function runGeminiLoop(opts: AgentOptions, maxTurns: number, maxTokens: number) {
  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY })

  const functionDeclarations = opts.tools.map(t => ({
    name: t.name,
    description: t.description,
    parameters: toGeminiSchema(t.parameters),
  }))

  const contents: object[] = [
    { role: 'user', parts: [{ text: opts.userMessage }] },
  ]

  for (let turn = 0; turn < maxTurns; turn++) {
    opts.onTurn?.(turn + 1)

    const response = await withRetry(
      () => ai.models.generateContent({
        model: GEMINI_MODEL,
        contents,
        config: {
          maxOutputTokens: maxTokens,
          systemInstruction: opts.system,
          tools: [{ functionDeclarations }],
          toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY } },
        },
      }),
      'Gemini',
    )

    const fnCalls = response.functionCalls ?? []
    const tag = opts.label ? `Gemini/${opts.label}` : 'Gemini'
    console.log(`[${tag}] Turn ${turn + 1} — ${fnCalls.length} call(s)`)

    if (response.candidates?.[0]?.content) {
      contents.push(response.candidates[0].content)
    }

    if (fnCalls.length === 0) return null

    const terminalCall = fnCalls.find(c => c.name === opts.terminalTool)
    if (terminalCall) return { args: terminalCall.args }

    const calls: FnCall[] = fnCalls.map(c => ({
      id: (c.id ?? c.name) as string,
      name: (c.name ?? '') as string,
      args: c.args,
    }))
    const results = await opts.onTool(calls)

    contents.push({
      role: 'user',
      parts: results.map(r => ({
        functionResponse: {
          name: r.name,
          id: r.id,
          response: { result: r.result },
        },
      })),
    })
  }

  return null
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Run a multi-turn agentic loop until the model calls `terminalTool`.
 * Returns the terminal tool's args, or null if the loop ended without it.
 */
export async function runAgentLoop(opts: AgentOptions): Promise<{ args: unknown } | null> {
  const maxTurns  = opts.maxTurns  ?? 20
  const maxTokens = opts.maxTokens ?? 4096
  const provider  = getProvider()
  console.log(`[Agent] Provider: ${provider}`)
  return provider === 'anthropic'
    ? runAnthropicLoop(opts, maxTurns, maxTokens)
    : runGeminiLoop(opts, maxTurns, maxTokens)
}
