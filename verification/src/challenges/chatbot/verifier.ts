import type { Locator, Page } from 'playwright';
import type { ChallengeVerifier, VerifierContext } from '../../core/verifier.ts';
import { CheckFailed } from '../../core/types.ts';
import type { Check } from '../../core/types.ts';
import {
  findButton,
  findTextInput,
  pageText,
  waitForNewText
} from '../../core/ui.ts';

/**
 * Chatbot challenge verifier.
 *
 * Contract (see specs/chatbot.md): a chat UI with a message input and a send
 * control; sending a message shows the user message and produces an assistant
 * response within the timeout, repeatedly (conversation continuity). The
 * response is detected by content diffing, not DOM structure assumptions.
 */

interface ChatState {
  page: Page | null;
  input: Locator | null;
  send: Locator | null;
}

interface ReplyRecord {
  user: string;
  userShown: boolean;
  reply: string | null;
  ms: number;
}

async function settle(page: Page): Promise<void> {
  await page
    .waitForLoadState('networkidle', { timeout: 8_000 })
    .catch(() => undefined);
  await page.waitForTimeout(250);
}

export const chatbotVerifier: ChallengeVerifier = {
  meta: {
    id: 'chatbot',
    name: 'Chatbot',
    description:
      'Chatbot UI that responds to user messages (SPE-55 challenge 5)',
    specPath: 'specs/chatbot.md'
  },

  async buildChecks(ctx: VerifierContext): Promise<readonly Check[]> {
    const state: ChatState = { page: null, input: null, send: null };
    const responseLog: ReplyRecord[] = [];

    /** Sends a message; returns visibility of the echo and of a bot reply. */
    async function sendMessage(
      message: string,
      timeoutMs: number
    ): Promise<ReplyRecord> {
      const { page, input, send } = state;
      if (page === null || input === null) {
        throw new CheckFailed('No page or input');
      }
      const base = await pageText(page);
      const started = Date.now();
      await input.fill(message);
      if (send !== null) {
        await send.click();
      } else {
        await input.press('Enter');
      }

      let userShown = false;
      const userDeadline = Date.now() + 5_000;
      while (Date.now() < userDeadline) {
        if ((await pageText(page)).includes(message)) {
          userShown = true;
          break;
        }
        await page.waitForTimeout(200);
      }
      if (!userShown) {
        return { user: message, userShown: false, reply: null, ms: Date.now() - started };
      }

      const reply = await waitForNewText(page, base, message, timeoutMs);
      return {
        user: message,
        userShown: true,
        reply,
        ms: Date.now() - started
      };
    }

    return [
      {
        id: 'chat-page-loads',
        name: 'Chatbot page loads',
        severity: 'required',
        run: async () => {
          const page = await ctx.session.newPage();
          state.page = page;
          const response = await page.goto(ctx.targetUrl, {
            waitUntil: 'domcontentloaded'
          });
          if (response === null || response.status() >= 400) {
            throw new CheckFailed(
              `Target returned HTTP ${response === null ? 'unknown' : response.status()}`
            );
          }
          await settle(page);
          await ctx.session.screenshot(page, '01-loaded.png');
        }
      },
      {
        id: 'chat-input-discoverable',
        name: 'Message input and send control are discoverable',
        severity: 'required',
        requires: ['chat-page-loads'],
        run: async () => {
          const page = state.page;
          if (page === null) {
            throw new CheckFailed('No page');
          }
          const input =
            (await findTextInput(page, {
              prefer: /message|chat|ask|say|type|prompt/i
            })) ??
            (await findTextInput(page, {}));
          if (input === null) {
            throw new CheckFailed(
              'No message input found (expected a visible text input or textarea)'
            );
          }
          state.input = input;
          state.send = await findButton(
            page,
            /^(send|submit|reply|>|→|➤|send message)$/i
          );
        }
      },
      {
        id: 'chat-user-message-appears',
        name: 'Sent message appears in the chat',
        severity: 'required',
        requires: ['chat-input-discoverable'],
        run: async () => {
          const message = ctx.rand.phrase();
          const result = await sendMessage(message, 5_000);
          if (!result.userShown) {
            const page = state.page;
            if (page !== null) {
              await ctx.session.screenshot(page, '02-no-user-message.png');
            }
            throw new CheckFailed(
              `Typed message "${message}" never appeared in the chat after sending`
            );
          }
        }
      },
      {
        id: 'chat-bot-responds',
        name: 'Bot responds to the first message',
        severity: 'required',
        requires: ['chat-input-discoverable'],
        run: async () => {
          const message = `Hello, are you working? ${ctx.rand.phrase()}`;
          const result = await sendMessage(message, 30_000);
          if (result.reply === null) {
            const page = state.page;
            if (page !== null) {
              await ctx.session.screenshot(page, '03-no-reply.png');
            }
            throw new CheckFailed(
              `No bot response appeared within 30s of sending "${message}"`
            );
          }
          responseLog.push(result);
          await ctx.evidence.saveJson('03-replies.json', responseLog);
        }
      },
      {
        id: 'chat-continuity',
        name: 'Bot keeps responding in an ongoing conversation',
        severity: 'required',
        requires: ['chat-bot-responds'],
        run: async () => {
          const message = `Second question: what is ${ctx.rand.int(2, 9)} plus ${ctx.rand.int(2, 9)}?`;
          const result = await sendMessage(message, 30_000);
          if (result.reply === null) {
            const page = state.page;
            if (page !== null) {
              await ctx.session.screenshot(page, '04-no-second-reply.png');
            }
            throw new CheckFailed(
              'No bot response to the second message within 30s (conversation broke after first reply)'
            );
          }
          responseLog.push(result);
          await ctx.evidence.saveJson('03-replies.json', responseLog);
        }
      },
      {
        id: 'chat-fast-response',
        name: 'Responses arrive within 5 seconds (bonus capability probe)',
        severity: 'bonus',
        requires: ['chat-continuity'],
        run: async () => {
          const slow = responseLog.filter((entry) => entry.ms > 5_000);
          if (slow.length > 0) {
            throw new CheckFailed(
              `${slow.length} response(s) took longer than 5s (${slow
                .map((s) => `${s.ms}ms`)
                .join(', ')})`
            );
          }
        }
      },
      {
        id: 'chat-no-console-errors',
        name: 'No console errors during the session',
        severity: 'required',
        run: async () => {
          const page = state.page;
          if (page !== null) {
            await ctx.session.screenshot(page, '05-final.png');
          }
          ctx.session.assertNoConsoleErrors();
        }
      }
    ];
  }
};
