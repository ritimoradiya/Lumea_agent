/**
 * The brain interface.
 *
 * Everything above this layer is brain-agnostic. Swapping Groq for a
 * local Ollama model means adding one file that satisfies `Brain` —
 * no other code changes.
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
};

export interface Brain {
  /** Human-readable id, e.g. "groq:llama-3.3-70b-versatile". */
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
 * Dynamic imports keep the unused provider out of the bundle — so
 * running in groq mode never loads the Ollama client, and vice versa.
 */
export async function getBrain(): Promise<Brain> {
  const choice = (process.env.BRAIN ?? "groq").toLowerCase();

  switch (choice) {
    case "groq": {
      const { GroqBrain } = await import("./groq");
      return new GroqBrain();
    }
    case "ollama": {
      const { OllamaBrain } = await import("./ollama");
      return new OllamaBrain();
    }
    default:
      throw new Error(
        `Unknown BRAIN "${choice}" in .env.local. Expected "groq" or "ollama".`
      );
  }
}
