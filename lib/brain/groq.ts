import Groq from "groq-sdk";
import type { Brain, ChatMessage, CompleteOptions } from "./index";

/**
 * Cloud brain. Free tier, no card, and the fastest inference available.
 *
 * Groq's free tier caps tokens per DAY as well as per minute, and that cap is
 * per model — so when the primary is exhausted a second model still has its
 * own budget. Falling back doubles the effective daily allowance and, more
 * importantly, means a demo degrades to a slightly smaller model instead of
 * showing the customer an apology.
 */
export class GroqBrain implements Brain {
  readonly name: string;
  private client: Groq;
  private model: string;
  private fallbackModel: string | null;

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GROQ_API_KEY is missing from .env.local — get one at console.groq.com/keys"
      );
    }
    this.model = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";
    this.fallbackModel =
      process.env.GROQ_FALLBACK_MODEL ?? "openai/gpt-oss-20b";
    if (this.fallbackModel === this.model) this.fallbackModel = null;

    this.client = new Groq({ apiKey, maxRetries: 1 });
    this.name = `groq:${this.model}`;
  }

  /** Groq answers 429 for both the per-minute and the per-day ceiling. */
  private isRateLimited(error: unknown): boolean {
    return (error as { status?: number })?.status === 429;
  }

  private supportsReasoningEffort(model: string): boolean {
    // Only the gpt-oss family accepts it; qwen returns a 400.
    return model.includes("gpt-oss");
  }

  private streamBody(
    model: string,
    messages: ChatMessage[],
    options: CompleteOptions
  ) {
    return {
      model,
      messages,
      stream: true as const,
      max_tokens: options.maxTokens ?? 400,
      temperature: options.temperature ?? 0.6,
      ...(this.supportsReasoningEffort(model)
        ? { reasoning_effort: options.reasoningEffort ?? ("low" as const) }
        : {}),
    };
  }

  async *stream(
    messages: ChatMessage[],
    options: CompleteOptions = {}
  ): AsyncIterable<string> {
    let completion;
    try {
      completion = await this.client.chat.completions.create(
        this.streamBody(this.model, messages, options)
      );
    } catch (error) {
      if (!this.isRateLimited(error) || !this.fallbackModel) throw error;
      console.warn(
        `[groq] ${this.model} is rate limited; falling back to ${this.fallbackModel}`
      );
      completion = await this.client.chat.completions.create(
        this.streamBody(this.fallbackModel, messages, options)
      );
    }

    for await (const chunk of completion) {
      const token = chunk.choices[0]?.delta?.content;
      if (token) yield token;
    }
  }

  private completeBody(
    model: string,
    messages: ChatMessage[],
    options: CompleteOptions
  ) {
    return {
      model,
      messages,
      max_tokens: options.maxTokens ?? 400,
      // Extraction wants determinism; conversation wants a little warmth.
      temperature: options.temperature ?? (options.json ? 0 : 0.6),
      ...(this.supportsReasoningEffort(model)
        ? { reasoning_effort: options.reasoningEffort ?? ("low" as const) }
        : {}),
      ...(options.json
        ? { response_format: { type: "json_object" as const } }
        : {}),
    };
  }

  async complete(
    messages: ChatMessage[],
    options: CompleteOptions = {}
  ): Promise<string> {
    try {
      const done = await this.client.chat.completions.create(
        this.completeBody(this.model, messages, options)
      );
      return done.choices[0]?.message?.content ?? "";
    } catch (error) {
      if (!this.isRateLimited(error) || !this.fallbackModel) throw error;
      console.warn(
        `[groq] ${this.model} is rate limited; falling back to ${this.fallbackModel}`
      );
      const done = await this.client.chat.completions.create(
        this.completeBody(this.fallbackModel, messages, options)
      );
      return done.choices[0]?.message?.content ?? "";
    }
  }
}
