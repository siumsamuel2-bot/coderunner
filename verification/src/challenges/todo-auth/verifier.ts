import type { Locator, Page } from 'playwright';
import type { Dialog } from 'playwright';
import type { ChallengeVerifier, VerifierContext } from '../../core/verifier.ts';
import { CheckFailed } from '../../core/types.ts';
import type { Check } from '../../core/types.ts';
import { findButton, findLink, findTextInput, pageText } from '../../core/ui.ts';

/**
 * Todo app with auth challenge verifier.
 *
 * Contract (see specs/todo-auth.md): the app must support account
 * registration (email + password; extra optional fields allowed), login and
 * logout, and per-user todo CRUD, with todos hidden from logged-out and other
 * users. All flows are driven through the UI only (forms, buttons, links) -
 * no API shape is assumed. Credentials and todo texts are randomized per run.
 */

interface Credentials {
  readonly email: string;
  readonly password: string;
}

interface TodoState {
  page: Page | null;
  userA: Credentials | null;
  userB: Credentials | null;
  todoA1: string;
  todoA2: string;
  todoB1: string;
}

const REGISTER_TEXT = /(register|sign[\s-]?up|create\s+(an\s+)?account)/i;
const LOGIN_TEXT = /(log[\s-]?in|sign[\s-]?in)/i;
const LOGOUT_TEXT = /(log[\s-]?out|sign[\s-]?out)/i;
const ADD_TEXT = /^(add|create|new|\+)$/i;
const TODO_INPUT_HINT = /todo|task|item|thing|what/i;

/** Waits for any form submit / SPA transition to settle. */
async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined);
  await page.waitForTimeout(250);
}

/** Finds the first visible password input on the page (or null). */
async function passwordField(page: Page): Promise<Locator | null> {
  const fields = page.locator('input[type="password"]');
  const count = await fields.count();
  for (let i = 0; i < count; i += 1) {
    const field = fields.nth(i);
    if (await field.isVisible().catch(() => false)) {
      return field;
    }
  }
  return null;
}

/** True when the page currently exposes any visible password input. */
async function hasLoginForm(page: Page): Promise<boolean> {
  return (await passwordField(page)) !== null;
}

/** Fills every visible password input with the given password. */
async function fillPasswords(page: Page, password: string): Promise<void> {
  const fields = page.locator('input[type="password"]');
  const count = await fields.count();
  for (let i = 0; i < count; i += 1) {
    const field = fields.nth(i);
    if (await field.isVisible().catch(() => false)) {
      await field.fill(password);
    }
  }
}

/** Finds a visible email input (by type or identity), or the first text input. */
async function emailField(page: Page): Promise<Locator | null> {
  const typed = page.locator('input[type="email"]');
  const typedCount = await typed.count();
  for (let i = 0; i < typedCount; i += 1) {
    const field = typed.nth(i);
    if (await field.isVisible().catch(() => false)) {
      return field;
    }
  }
  const hinted = page.locator('input:not([type]), input[type="text"]').filter({
    has: page.locator('..', { hasText: /mail/i })
  });
  if ((await hinted.count()) > 0) {
    return hinted.first();
  }
  const input = await findTextInput(page, { prefer: /mail|user|name|email/i });
  return input;
}

/**
 * Navigates to a page offering a registration form: either the current page,
 * a toggled form (via a register link that flips the form mode), or a register
 * page one navigation away.
 */
async function ensureRegisterForm(page: Page): Promise<void> {
  // Already showing a register-affirmative submit button?
  if (
    (await passwordField(page)) !== null &&
    (await findButton(page, REGISTER_TEXT)) !== null
  ) {
    return;
  }
  const link = await findLink(page, REGISTER_TEXT);
  if (link !== null) {
    await link.click();
    await settle(page);
  }
  if ((await passwordField(page)) === null) {
    throw new CheckFailed(
      'No registration form found: no password input on the page and no register/sign-up link'
    );
  }
}

/** Navigates to a login form (current page, via link, or via mode toggle). */
async function ensureLoginForm(page: Page): Promise<void> {
  if (
    (await passwordField(page)) !== null &&
    (await findButton(page, LOGIN_TEXT)) !== null
  ) {
    return;
  }
  const link = await findLink(page, LOGIN_TEXT);
  if (link !== null) {
    await link.click();
    await settle(page);
  }
  if ((await passwordField(page)) === null) {
    throw new CheckFailed(
      'No login form found: no password input on the page and no login/sign-in link'
    );
  }
}

/** Fills email + password fields on the current form and submits it. */
async function submitCredentials(
  page: Page,
  credentials: Credentials,
  intent: 'register' | 'login'
): Promise<void> {
  const email = await emailField(page);
  if (email === null) {
    throw new CheckFailed(`No email/username input found for ${intent} form`);
  }
  await email.fill(credentials.email);
  await fillPasswords(page, credentials.password);

  const submit =
    (await findButton(page, intent === 'register' ? REGISTER_TEXT : LOGIN_TEXT)) ??
    (await findButton(page, intent === 'register' ? LOGIN_TEXT : REGISTER_TEXT)) ??
    (await findButton(page, /submit|continue|next|go/i));
  if (submit !== null) {
    await submit.click();
  } else {
    const password = await passwordField(page);
    if (password === null) {
      throw new CheckFailed(`No submit button found for ${intent} form`);
    }
    await password.press('Enter');
  }
  await settle(page);
}

/** Registers a fresh user; tolerates auto-login after registration. */
async function registerUser(
  page: Page,
  ctx: VerifierContext,
  credentials: Credentials
): Promise<void> {
  await ensureRegisterForm(page);
  await submitCredentials(page, credentials, 'register');
  if (await hasLoginForm(page)) {
    // Registration succeeded but did not auto-login: log in explicitly.
    await ensureLoginForm(page);
    await submitCredentials(page, credentials, 'login');
  }
  if (await hasLoginForm(page)) {
    throw new CheckFailed(
      'Still showing a login form after registering (registration may have failed)'
    );
  }
}

/** Types a todo and submits it (Enter or add button). */
async function createTodo(page: Page, text: string): Promise<void> {
  const input = await findTextInput(page, { prefer: TODO_INPUT_HINT });
  if (input === null) {
    throw new CheckFailed('No todo input field found');
  }
  await input.fill(text);
  const addButton = await findButton(page, ADD_TEXT);
  if (addButton !== null) {
    await addButton.click();
  } else {
    await input.press('Enter');
  }
  await settle(page);
  await page.waitForTimeout(300);
}

/** Finds the closest todo item container for the given todo text. */
async function findItemContainer(
  page: Page,
  text: string
): Promise<Locator | null> {
  const target = page.getByText(text, { exact: true }).first();
  if ((await target.count()) === 0) {
    return null;
  }
  return target;
}

/** Reads whether the item currently signals completion. */
async function readCompletionState(
  page: Page,
  text: string
): Promise<boolean> {
  return page.evaluate((todoText: string): boolean => {
    const el = Array.from(document.querySelectorAll('body *')).find(
      (n) => (n.textContent ?? '').trim() === todoText
    );
    if (el === undefined) {
      return false;
    }
    const item = el.closest('li, [class*="item"], [class*="todo"]');
    if (item === null) {
      return false;
    }
    const box = item.querySelector('input[type="checkbox"]');
    const checked =
      box !== null &&
      ((box as HTMLInputElement).checked ||
        box.getAttribute('aria-checked') === 'true');
    const struck =
      /complete|done|checked|finished/i.test(item.className ?? '') ||
      /line-through/.test(item.className ?? '') ||
      (getComputedStyle(item).textDecorationLine ?? '').includes('line-through');
    return checked || struck;
  }, text);
}

/** Reads a change-detection signature (class/style/aria) for the item. */
async function readItemSignature(page: Page, text: string): Promise<string> {
  return page.evaluate((todoText: string): string => {
    const el = Array.from(document.querySelectorAll('body *')).find(
      (n) => (n.textContent ?? '').trim() === todoText
    );
    const item = el === undefined ? null : el.closest('li, [class*="item"], [class*="todo"]');
    if (item === null) {
      return '';
    }
    return [
      item.className ?? '',
      getComputedStyle(item).textDecorationLine ?? '',
      item.getAttribute('aria-checked') ?? ''
    ].join('|');
  }, text);
}

/** Clicks logout if a control exists; throws when it does not. */
async function logout(page: Page): Promise<void> {
  const control =
    (await findButton(page, LOGOUT_TEXT)) ?? (await findLink(page, LOGOUT_TEXT));
  if (control === null) {
    throw new CheckFailed('No logout control found while logged in');
  }
  await control.click();
  await settle(page);
}

/** The todo item's container element (li, or a class-marked wrapper). */
async function itemWrapper(page: Page, text: string): Promise<Locator> {
  const leaf = page.getByText(text, { exact: true }).first();
  const li = leaf.locator('xpath=ancestor-or-self::li[1]');
  if ((await li.count()) > 0) {
    return li.first();
  }
  const marked = leaf.locator(
    'xpath=ancestor-or-self::*[contains(@class,"item") or contains(@class,"todo") or contains(@data-testid,"todo")][1]'
  );
  if ((await marked.count()) > 0) {
    return marked.first();
  }
  return leaf;
}

export const todoAuthVerifier: ChallengeVerifier = {
  meta: {
    id: 'todo-auth',
    name: 'Todo app with auth',
    description:
      'Todo app with user login and create/read/update/delete todos (SPE-55 challenge 2)',
    specPath: 'specs/todo-auth.md'
  },

  async buildChecks(ctx: VerifierContext): Promise<readonly Check[]> {
    const state: TodoState = {
      page: null,
      userA: null,
      userB: null,
      todoA1: '',
      todoA2: '',
      todoB1: ''
    };

    return [
      {
        id: 'todo-page-loads',
        name: 'Todo app page loads',
        severity: 'required',
        run: async () => {
          const page = await ctx.session.newPage();
          page.on('dialog', (dialog: Dialog) => {
            void dialog.accept();
          });
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
        id: 'todo-register-userA',
        name: 'User A can register an account (email + password)',
        severity: 'required',
        requires: ['todo-page-loads'],
        run: async () => {
          const page = state.page;
          if (page === null) {
            throw new CheckFailed('No page');
          }
          const creds: Credentials = {
            email: ctx.rand.email('runner-a'),
            password: ctx.rand.password()
          };
          state.userA = creds;
          state.todoA1 = ctx.rand.phrase();
          state.todoA2 = ctx.rand.phrase();
          await registerUser(page, ctx, creds);
          await ctx.session.screenshot(page, '02-user-a-registered.png');
        }
      },
      {
        id: 'todo-create',
        name: 'User A can create a todo',
        severity: 'required',
        requires: ['todo-register-userA'],
        run: async () => {
          const page = state.page;
          if (page === null) {
            throw new CheckFailed('No page');
          }
          await createTodo(page, state.todoA1);
          const text = await pageText(page);
          if (!text.includes(state.todoA1)) {
            throw new CheckFailed(
              `Created todo "${state.todoA1}" is not visible after adding it`
            );
          }
          await ctx.session.screenshot(page, '03-todo-created.png');
        }
      },
      {
        id: 'todo-toggle',
        name: 'User A can mark a todo as complete',
        severity: 'required',
        requires: ['todo-create'],
        run: async () => {
          const page = state.page;
          if (page === null) {
            throw new CheckFailed('No page');
          }
          const item = await findItemContainer(page, state.todoA1);
          if (item === null) {
            throw new CheckFailed(`Todo "${state.todoA1}" not visible for toggle`);
          }
          const wrapper = await itemWrapper(page, state.todoA1);
          const checkbox = wrapper.locator('input[type="checkbox"]');
          let toggled = false;
          if ((await checkbox.count()) > 0) {
            await checkbox.first().click();
            await page.waitForTimeout(300);
            toggled = await readCompletionState(page, state.todoA1);
          }
          if (!toggled) {
            // Fallback: some apps toggle by clicking the item text.
            const before = await readItemSignature(page, state.todoA1);
            await item.click();
            await page.waitForTimeout(300);
            const after = await readItemSignature(page, state.todoA1);
            toggled = before !== after && (await readCompletionState(page, state.todoA1));
          }
          if (!toggled) {
            throw new CheckFailed(
              `Could not toggle "${state.todoA1}" to complete (no checkbox, click, class or style change detected)`
            );
          }
          await ctx.session.screenshot(page, '04-todo-toggled.png');
        }
      },
      {
        id: 'todo-persistence',
        name: 'Todos persist after a page reload',
        severity: 'required',
        requires: ['todo-toggle'],
        run: async () => {
          const page = state.page;
          if (page === null) {
            throw new CheckFailed('No page');
          }
          await createTodo(page, state.todoA2);
          await page.reload({ waitUntil: 'domcontentloaded' });
          await settle(page);
          const text = await pageText(page);
          if (!text.includes(state.todoA1)) {
            throw new CheckFailed(
              `Todo "${state.todoA1}" disappeared after reload (not persisted)`
            );
          }
          if (!text.includes(state.todoA2)) {
            throw new CheckFailed(
              `Todo "${state.todoA2}" disappeared after reload (not persisted)`
            );
          }
          await ctx.session.screenshot(page, '05-after-reload.png');
        }
      },
      {
        id: 'todo-delete',
        name: 'User A can delete a todo',
        severity: 'required',
        requires: ['todo-persistence'],
        run: async () => {
          const page = state.page;
          if (page === null) {
            throw new CheckFailed('No page');
          }
          const wrapper = await itemWrapper(page, state.todoA2);
          const deleteButton = wrapper.locator(
            'button, [role="button"], a'
          ).filter({
            hasText: /^(delete|remove|del|trash|×|✕|x|✖)$/i
          });
          let control = (await deleteButton.count()) > 0 ? deleteButton.first() : null;
          if (control === null) {
            const pageLevel = await findButton(
              page,
              /^(delete|remove|trash)$/i
            );
            control = pageLevel;
          }
          if (control === null) {
            throw new CheckFailed(
              `No delete control found for todo "${state.todoA2}"`
            );
          }
          await control.click();
          await settle(page);
          await page.waitForTimeout(400);
          const text = await pageText(page);
          if (text.includes(state.todoA2)) {
            throw new CheckFailed(
              `Todo "${state.todoA2}" is still visible after deleting it`
            );
          }
          await ctx.session.screenshot(page, '06-after-delete.png');
        }
      },
      {
        id: 'todo-edit-text',
        name: 'User A can edit a todo text (bonus capability probe)',
        severity: 'bonus',
        requires: ['todo-persistence'],
        run: async () => {
          const page = state.page;
          if (page === null) {
            throw new CheckFailed('No page');
          }
          const newText = `${state.todoA1} (edited)`;
          const wrapper = await itemWrapper(page, state.todoA1);
          const editButton = wrapper.locator('button, [role="button"]').filter({
            hasText: /^(edit|rename|pencil|✎)$/i
          });
          let edited = false;
          if ((await editButton.count()) > 0) {
            await editButton.first().click();
            await page.waitForTimeout(200);
            const editor = await findTextInput(page, { prefer: /todo|task|edit/i });
            if (editor !== null) {
              await editor.fill(newText);
              await editor.press('Enter');
              await settle(page);
              edited = (await pageText(page)).includes(newText);
            }
          } else {
            // Common alternative: double-click the item text to edit inline.
            const item = await findItemContainer(page, state.todoA1);
            if (item !== null) {
              await item.dblclick();
              await page.waitForTimeout(200);
              const editor = await findTextInput(page, {});
              if (editor !== null) {
                await editor.fill(newText);
                await editor.press('Enter');
                await settle(page);
                edited = (await pageText(page)).includes(newText);
              }
            }
          }
          if (!edited) {
            throw new CheckFailed(
              'No working text-edit affordance found (edit button or double-click)'
            );
          }
          state.todoA1 = newText;
        }
      },
      {
        id: 'todo-isolation',
        name: 'Todos are hidden when logged out and isolated per user',
        severity: 'required',
        requires: ['todo-persistence'],
        run: async () => {
          const page = state.page;
          if (page === null) {
            throw new CheckFailed('No page');
          }
          const userA = state.userA;
          if (userA === null) {
            throw new CheckFailed('User A missing');
          }

          // Logout: user A's todos must disappear.
          await logout(page);
          let text = await pageText(page);
          if (text.includes(state.todoA1)) {
            throw new CheckFailed(
              `User A's todo is visible to a logged-out visitor (auth gate missing)`
            );
          }
          await ctx.session.screenshot(page, '07-logged-out.png');

          // Register user B; B must not see A's todos.
          const credsB: Credentials = {
            email: ctx.rand.email('runner-b'),
            password: ctx.rand.password()
          };
          state.userB = credsB;
          state.todoB1 = ctx.rand.phrase();
          await registerUser(page, ctx, credsB);
          text = await pageText(page);
          if (text.includes(state.todoA1)) {
            throw new CheckFailed(
              `User B can see user A's todos (per-user isolation missing)`
            );
          }

          // B creates a todo; it must be visible to B.
          await createTodo(page, state.todoB1);
          text = await pageText(page);
          if (!text.includes(state.todoB1)) {
            throw new CheckFailed(`User B's own todo is not visible to B`);
          }
          await ctx.session.screenshot(page, '08-user-b.png');

          // Back to user A: A sees A's todos, not B's.
          await logout(page);
          await ensureLoginForm(page);
          await submitCredentials(page, userA, 'login');
          if (await hasLoginForm(page)) {
            throw new CheckFailed('Login as user A failed (form still shown)');
          }
          await settle(page);
          text = await pageText(page);
          if (!text.includes(state.todoA1)) {
            throw new CheckFailed(
              `User A's todo disappeared after logging back in (data loss)`
            );
          }
          if (text.includes(state.todoB1)) {
            throw new CheckFailed(
              `User A can see user B's todos (per-user isolation missing)`
            );
          }
          await ctx.session.screenshot(page, '09-user-a-again.png');
        }
      },
      {
        id: 'todo-no-console-errors',
        name: 'No console errors during the session',
        severity: 'required',
        run: async () => {
          const page = state.page;
          if (page !== null) {
            await ctx.session.screenshot(page, '10-final.png');
          }
          ctx.session.assertNoConsoleErrors();
        }
      }
    ];
  }
};
