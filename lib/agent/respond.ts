import type { Brain, ChatMessage } from "../brain";
import type { Company } from "../company";
import { extractFields } from "./extract";
import { buildSystemPrompt, type PromptMode } from "./prompts";
import {
  findAsk,
  isLeadComplete,
  isAskSatisfied,
  merge,
  nextAsk,
  type Collected,
  type ConversationState,
} from "./checklist";

export type RespondInput = {
  brain: Brain;
  company: Company;
  /** Prior turns, oldest first. Excludes the message being handled now. */
  history: ChatMessage[];
  state: ConversationState;
  customerMessage: string;
};

export type RespondResult = {
  reply: string;
  /** Carry this into the next call. */
  state: ConversationState;
  /** True once every REQUIRED detail is present (phone is optional). */
  complete: boolean;
  /** Fields discovered in this specific turn — handy for logging. */
  learned: Collected;
  /** What the agent chose to do, for debugging the flow. */
  mode: PromptMode["kind"];
};

/**
 * The core of the agent. Channel-agnostic on purpose: the web widget,
 * Telegram, email, and the simulator all call this same function.
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
  const { brain, company, history, state, customerMessage } = input;

  const previousAsk = findAsk(state.lastAskId);

  const learned = await extractFields(brain, customerMessage, {
    askedFor: previousAsk?.label ?? null,
    alreadyHave: state.collected,
  });
  const collected = merge(state.collected, learned);

  // Two reasons to ask for nothing this turn.
  //
  // First: they opened with nothing to go on. Someone who says only "hi"
  // should be greeted and helped, not asked for an email address. But if
  // their opening message already told us what they need, we have earned
  // enough to ask one thing straight away — waiting a turn just to seem
  // polite wastes their time.
  const openedWithNothing =
    history.length === 0 && !collected.description?.trim();

  // Second: we asked last turn and they did not answer. Pushing again is
  // badgering. Help instead, and try once more later.
  const ignoredLastAsk =
    previousAsk !== null && !isAskSatisfied(previousAsk, collected);

  const ask =
    openedWithNothing || ignoredLastAsk
      ? null
      : nextAsk(collected, state.attempts);

  const mode: PromptMode =
    ask !== null
      ? { kind: "ask", ask }
      : isLeadComplete(collected)
        ? { kind: "wrap-up" }
        : { kind: "answer-only" };

  const attempts = { ...state.attempts };
  if (ask) attempts[ask.id] = (attempts[ask.id] ?? 0) + 1;

  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(company, collected, mode) },
    ...history.slice(-8),
    { role: "user", content: customerMessage },
  ];

  // 160 tokens is roughly three or four sentences. Capping it enforces the
  // brevity the prompt asks for, and generation time scales with length.
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
    state: { collected, attempts, lastAskId: ask?.id ?? null },
    complete: isLeadComplete(collected),
    learned,
    mode: mode.kind,
  };
}
