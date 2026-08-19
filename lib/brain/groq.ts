import Groq from "groq-sdk";
import type { Brain, ChatMessage, CompleteOptions } from "./index";

/** Cloud brain. Free tier, no card, and the fastest inference available. */
export class GroqBrain implements Brain {
  readonly name: string;
  private client: Groq;
  private model: string;

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GROQ_API_KEY is missing from .env.local — get one at console.groq.com/keys"
      );
    }
    this.model = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
    this.client = new Groq({ apiKey });
    this.name = `groq:${this.model}`;
  }

  async *stream(
    messages: ChatMessage[],
    options: CompleteOptions = {}
  ): AsyncIterable<string> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages,
      stream: true,
      max_tokens: options.maxTokens ?? 400,
      temperature: options.temperature ?? 0.6,
    });

    for await (const chunk of completion) {
      const token = chunk.choices[0]?.delta?.content;
      if (token) yield token;
    }
  }

  async complete(
    messages: ChatMessage[],
    options: CompleteOptions = {}
  ): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages,
      max_tokens: options.maxTokens ?? 400,
      // Extraction wants determinism; conversation wants a little warmth.
      temperature: options.temperature ?? (options.json ? 0 : 0.6),
      ...(options.json ? { response_format: { type: "json_object" } } : {}),
    });

    return completion.choices[0]?.message?.content ?? "";
  }
}
