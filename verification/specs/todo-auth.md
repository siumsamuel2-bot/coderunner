# Verification spec: Todo app with auth

Challenge: "Build a todo app with user login, create/read/update/delete todos" (SPE-55 #2).

## What "working" means

A submission passes when **all required checks below pass** against the live URL. All flows are driven through the UI only - forms, buttons, links - so any stack qualifies. The harness registers two fresh random users per run; no pre-existing accounts are needed.

## The contract (discovery rules)

- **Registration**: the app must allow creating an account with an **email and password** (optional extra fields are allowed but the flow must succeed with only these two filled). Registration may live on the same page as login, behind a tab, or behind a "Sign up" link (one navigation level is followed automatically). Auto-login after registration is supported but not required.
- **Login/logout**: a login form with email + password, and a logout control (button or link matching "Log out"/"Sign out").
- **Todo creation**: a text input (placeholder/label hinting todo/task/item preferred) submitted via Enter or an Add button.
- **Completion**: toggling is detected via checkbox state, `aria-checked`, completion class, or strikethrough style. Apps that toggle by clicking the item text are supported.
- **Deletion**: a delete control (text/icon matching delete/remove/trash/x) within the todo item, or at page level.
- **Persistence**: todos must survive a page reload.
- **Isolation**: one user's todos must never be visible to another user or to logged-out visitors.

## Required checks

| id | passes when |
|---|---|
| `todo-page-loads` | Target URL returns HTTP < 400 |
| `todo-register-userA` | User A can register (and reach a logged-in state) |
| `todo-create` | User A's newly created todo text is visible |
| `todo-toggle` | The todo can be marked complete (state signal detected) |
| `todo-persistence` | Both todos are still present (and toggled state intact) after reload |
| `todo-delete` | A todo can be deleted and stays gone after reload |
| `todo-isolation` | Logged out: no todos visible. User B (fresh account): cannot see A's todos. Back as A: A's todos present, B's absent |
| `todo-no-console-errors` | Zero `console.error` / uncaught page errors during the session |

## Bonus checks (do not affect the verdict)

| id | passes when |
|---|---|
| `todo-edit-text` | Todo text can be edited via an edit control or double-click |

## Notes

- Credentials are randomly generated per run (`runner-a-<token>@runner-verification.test`), so a submission that only fakes one hard-coded account fails isolation.
- Browser `confirm`/`alert` dialogs are auto-accepted.
- The edit check is a capability probe: it fails (bonus) when no affordance exists; that does not change the verdict.
