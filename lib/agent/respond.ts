import type { Brain, ChatMessage } from "../brain";
import type { Company } from "../company";
import { extractFields } from "./extract";
import { buildSystemPrompt } from "./prompts";
import { isComplete, merge, nextField, type Collected } from "./checklist";

export type RespondInput = {
  brain: Brain;
  /** The company this agent is representing. */
  company: Company;
  /** Prior turns, oldest first. Excludes the message being handled now. */
  history: ChatMessage[];
  collected: Collected;
  customerMessage: string;
};

export type RespondResult = {
  reply: string;
  collected: Collected;
  complete: boolean;
  /** Fields discovered in this specific turn — handy for logging. */
  learned: Collected;
};

/**
 * The core of the agent. Channel-agnostic on purpose: the web widget,
 * Telegram, email, and the simulator all call this same function, which
 * is what makes adding a channel a small job.
 *
 * Extraction runs BEFORE the reply rather than in the background. It
 * costs a few hundred milliseconds, but it means we can never ask a
 * customer for the email address they just gave us — a far worse
 * experience than a slightly slower reply.
 */
export async function respond(
  input: RespondInput,
  onToken?: (token: string) => void
): Promise<RespondResult> {
  const { brain, company, history, customerMessage } = input;

  // What we asked for last turn — lets extraction read a bare reply
  // like "Riti" as a first name rather than as noise.
  const asking = nextField(input.collected);

  const learned = await extractFields(brain, customerMessage, {
    asking,
    alreadyHave: input.collected,
  });
  const collected = merge(input.collected, learned);

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: buildSystemPrompt(company, collected, nextField(collected)),
    },
    ...history.slice(-8),
    { role: "user", content: customerMessage },
  ];

  // 160 tokens is roughly four sentences. Capping it enforces the brevity
  // the prompt asks for, and is the single biggest lever on latency —
  // generation time scales with how much the model writes.
  let reply = "";
  for await (const token of brain.stream(messages, {
    maxTokens: 160,
    reasoningEffort: "low",
  })) {
    reply += token;
    onToken?.(token);
  }

  return {
    reply: reply.trim(),
    collected,
    complete: isComplete(collected),
    learned,
  };
}
