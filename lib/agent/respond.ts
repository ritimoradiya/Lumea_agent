import type { Brain, ChatMessage } from "../brain";
import type { Company } from "../company";
import { extractFields } from "./extract";
import { buildSystemPrompt, type PromptMode } from "./prompts";
import {
  engagedWith,
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
  /**
   * Looks a customer up by email once one becomes known.
   *
   * Injected rather than called directly so this function stays pure and
   * testable — it never touches the database itself. The lookup has to happen
   * BEFORE the ask is chosen, or a returning customer gets asked for the name
   * we already have on file.
   */
  recogniseBy?: (email: string) => Promise<Collected | null>;
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
  /** True when this turn matched them to an existing contact. */
  recognised: boolean;
};

/**
 * The core of the agent. Channel-agnostic on purpose: the web widget,
 * The web widget, Telegram and email all call this same function.
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
  let collected = merge(state.collected, learned);

  /**
   * A returning customer, recognised the moment they give an address we have
   * seen on any channel. Merged first-write-wins, so anything they said in
   * this conversation still beats what we knew before.
   */
  let recognised = false;

  /**
   * Fires on any known address, not only a newly typed one.
   *
   * The condition used to be "an email was learned this turn AND we did not
   * already have one", which quietly excluded every email conversation: the
   * address arrives from the envelope before the first reply, so it is never
   * newly learned. A customer who had told us his skin was oily on the website
   * replied to his routine email an hour later and was treated as a stranger -
   * the alert read "no concern given".
   *
   * The gap check keeps this cheap: once a name and a concern are on file
   * there is nothing left to look up, so it stops.
   */
  const address = collected.email?.trim();
  const somethingToLearn =
    !collected.firstName?.trim() || !collected.description?.trim();

  if (input.recogniseBy && address && somethingToLearn) {
    const known = await input.recogniseBy(address);
    if (known) {
      const before = JSON.stringify(collected);
      collected = merge(collected, known);
      recognised = JSON.stringify(collected) !== before;
    }
  }

  // Two reasons to ask for nothing this turn.
  //
  // First: they opened with nothing to go on. Someone who says only "hi"
  // should be greeted and helped, not asked for an email address. But if
  // their opening message already told us what they need, we have earned
  // enough to ask one thing straight away — waiting a turn just to seem
  // polite wastes their time.
  const openedWithNothing =
    history.length === 0 && !collected.description?.trim();

  // Second: we asked last turn and they did not answer at all. Pushing
  // again is badgering — help instead and try once more later.
  //
  // Partly answering is NOT ignoring. Someone who gives their name but not
  // their email is engaged, and going quiet on them is worse than asking:
  // they are mid-handover and expect the next question. So we only back off
  // when this turn supplied nothing from the ask at all.
  const ignoredLastAsk =
    previousAsk !== null &&
    !isAskSatisfied(previousAsk, collected) &&
    !engagedWith(previousAsk, learned);

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

  // Brevity is enforced by the prompt, not by this cap. The cap exists only
  // as a backstop — set too low it truncates mid-sentence, which reads as a
  // broken product, and that is far worse than a reply running one sentence
  // long. Generation time does scale with length, so it stays modest.
  let reply = "";
  for await (const token of brain.stream(messages, {
    maxTokens: 240,
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
    recognised,
  };
}
