# Verification spec: Chatbot

Challenge: "Build a simple chatbot UI that responds to user messages" (SPE-55 #5).

## What "working" means

A submission passes when **all required checks below pass** against the live URL. The harness chats with the app like a user would; responses are detected by content diffing, not DOM structure.

## The contract (discovery rules)

- The app must expose a visible **text input or textarea** for composing messages (placeholder/label hinting message/chat/ask preferred, but any visible text input qualifies).
- Sending works via a button matching `send`/`submit`/`reply` (or arrow icons); if no such button exists, pressing **Enter** in the input is used.
- After a message is sent, the message text must appear in the chat, and a **new response** must appear within **30 seconds**: any content that was not on the page before and is not just the user message echoed back. A reply that embeds or contains the user text (e.g. "You said: ...") qualifies; a response byte-identical to the user message cannot be distinguished from the echo and does not qualify.

## Required checks

| id | passes when |
|---|---|
| `chat-page-loads` | Target URL returns HTTP < 400 |
| `chat-input-discoverable` | Message input found (and send control or Enter fallback) |
| `chat-user-message-appears` | Sent message text becomes visible in the chat |
| `chat-bot-responds` | A bot response appears within 30s of the first message |
| `chat-continuity` | A second message also receives a response within 30s |
| `chat-no-console-errors` | Zero `console.error` / uncaught page errors during the session |

## Bonus checks (do not affect the verdict)

| id | passes when |
|---|---|
| `chat-fast-response` | All recorded responses arrived within 5 seconds |

## Anti-mock design

Messages are randomized phrases generated from the harness seed. An "assistant" that merely re-renders static canned UI with no new text per message fails the content-diff detection; each distinct user message must produce new visible response content.
