/**
 * The brain interface.
 *
 * Everything above this layer is brain-agnostic: nothing outside this folder
 * knows which provider answers. Adding one means adding one file that
 * satisfies `Brain` and a case below, and changing nothing else.
 *
 * A local Ollama adapter existed here and was removed. It satisfied the
 * interface and typechecked, but it had never once been executed - which made
 * the README's offer of offline inference a claim nobody had checked. An
 * untested path that only exists to illustrate a design point is worth less
 * than not making the claim.
 */

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type CompleteOptions = {
  /** Ask the model to return strict JSON. Used by the extraction pass. */
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
  /** Reasoning models (gpt-oss) think before answering; "low" keeps
   *  latency usable for live chat. Ignored by non-reasoning models. */
  reasoningEffort?: "none" | "low" | "medium" | "high";
};

export interface Brain {
  /** Human-readable id, e.g. "groq:openai/gpt-oss-120b". */
  readonly name: string;

  /** Stream a reply token by token. Used for customer-facing replies. */
  stream(
    messages: ChatMessage[],
    options?: CompleteOptions
  ): AsyncIterable<string>;

  /** Get a whole reply at once. Used for background field extraction. */
  complete(messages: ChatMessage[], options?: CompleteOptions): Promise<string>;
}

/**
 * Picks a brain from the BRAIN env var.
 *
 * Still a switch on one case, and still a dynamic import, so adding a
 * provider stays a local change and an unused one stays out of the bundle.
 */
export async function getBrain(): Promise<Brain> {
  const choice = (process.env.BRAIN ?? "groq").toLowerCase();

  switch (choice) {
    case "groq": {
      const { GroqBrain } = await import("./groq");
      return new GroqBrain();
    }
    default:
      throw new Error(
        `Unknown BRAIN "${choice}" in .env.local. Expected "groq".`
      );
  }
}
