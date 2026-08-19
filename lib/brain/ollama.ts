import type { Brain, ChatMessage, CompleteOptions } from "./index";

/**
 * Local brain. Runs entirely on this machine with no internet.
 *
 * Only loaded when BRAIN=ollama. Requires Ollama running locally:
 *   brew install ollama && ollama serve && ollama pull qwen2.5:3b
 */
export class OllamaBrain implements Brain {
  readonly name: string;
  private url: string;
  private model: string;

  constructor() {
    this.url = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
    this.model = process.env.OLLAMA_MODEL ?? "qwen2.5:3b";
    this.name = `ollama:${this.model}`;
  }

  private async post(messages: ChatMessage[], stream: boolean, options: CompleteOptions) {
    const response = await fetch(`${this.url}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream,
        ...(options.json ? { format: "json" } : {}),
        options: {
          temperature: options.temperature ?? (options.json ? 0 : 0.6),
          num_predict: options.maxTokens ?? 400,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Ollama returned ${response.status}. Is it running? Try: ollama serve`
      );
    }
    return response;
  }

  async *stream(
    messages: ChatMessage[],
    options: CompleteOptions = {}
  ): AsyncIterable<string> {
    const response = await this.post(messages, true, options);
    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      // Ollama streams newline-delimited JSON objects.
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const token = JSON.parse(line)?.message?.content;
          if (token) yield token;
        } catch {
          // Partial line; it will be completed on the next read.
        }
      }
    }
  }

  async complete(
    messages: ChatMessage[],
    options: CompleteOptions = {}
  ): Promise<string> {
    const response = await this.post(messages, false, options);
    const data = await response.json();
    return data?.message?.content ?? "";
  }
}
