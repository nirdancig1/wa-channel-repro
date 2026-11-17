# What the chat shows while Ella works

Between the text of a reply, the chat shows the work behind it as quiet lines: the steps Ella took, the helpers she used, her to-do list, any permission she asked for and the pages she read, then a line under the reply. Only a permission prompt needs an answer. Questions and plans have their own cards (`building/chat-with-ella.md`).

## Steps

- **One line per step, worded for where it stands**: **Updating the "Dashboard" page** while it runs, **Updated the "Dashboard" page** once it's done, **Couldn't update the "Dashboard" page** (in red) if it failed.
  - Reading is **Looking at** / **Looked at** / **Couldn't look at**; a web search is **Searching the web for "…"**, then **Searched the web for "…"**.
  - A command shows Ella's own short description of it, and **Failed: …** if it failed. Without a description it reads **Running a command** / **Ran a command** / **Command failed**.
  - Ella's thinking isn't a step and isn't counted. While she thinks between steps, the chat says **Thinking** (see below) and nothing stays behind. The one exception is the start of a reply: thinking before she says or does anything shows as one line, **Thinking**: it opens while her thinking appears, then closes to **Thought** a moment later. Click it to read the thinking again. If the thinking had no text, no line is left.
  - A step with no wording of its own shows its plain name, such as **Sync app**, and **Sync app failed** if it failed.
- **Several steps in a row share one line.** While Ella works, the line reads **Working** (**Thinking** while she thinks between steps) and stays open, so each step shows under it as it happens. A single step shows a **Thinking** line under it instead. When she's done it closes to a count: **9 steps**, or **9 steps, 1 failed**. Click the line to open or close the list. A single step stands alone, with no count.
- **Under the last message, while Ella works**, one shimmering line says so where her reply doesn't already: **Thinking** before she has written anything, a setup step such as **Just a moment, setting things up…** while it runs, else **Working**.
- **Steps in a row on the same thing are grouped too**: several changes to one page show as one line, **Updated the "Dashboard" page** with **3 steps** beside it. Open it for each one, named for what it did to the file (**Edited …**, **Wrote …**).
- **A step that never finished** keeps its "in progress" wording, with a faded icon and the reason beside it: **Stopped** (the reply was stopped before the step finished, even a step you had allowed), **Denied** (you refused it permission) or **Not answered** (it asked for permission and got no answer).

## Helpers

Ella hands parts of the work to helpers (`building/chat-with-ella.md`). Each helper is a line of its own in the reply, never folded into a step count, with a spinner while it works, a check once it's done, and an alert if it failed: what the helper is doing, then the task Ella gave it (**Designing the app: Build the stats page**). Under it, a second line says where it stands:

- **While it works**, how many steps it has taken so far, then what it is doing right now: at first its latest step (**2 steps · Updating the "stats" page**), then on the **Claude Code** engine a short summary, updated about every 30 seconds. The summary isn't kept in the chat history.
- **When it's done**, its step count and time when the engine reports them (**6 steps · 1m 13s**), or nothing.
- **Stopped** if the reply was stopped while it worked, **Run failed** (in red) if it failed.

**Designing the app** is the helper that builds the app's screens and their look; the other helpers read **Building actions**, **Building chat elements**, **Setting up data**, **Testing** and **Recording a demo** (any other helper reads **Working on it**). These are Ella's helpers, not agents: an agent is something you build in your app. The line stays closed while the helper works and after it finishes. Click it to see what the helper did: its own short messages between steps ("Now writing the shared components."), in the reply's own text color, and where it wrote none, its thinking as one quiet **Thought** line with its first sentence (click it to read the whole thought); its closing report to Ella, when it is long, as one **Report** line that opens to it; and its steps, each one line like Ella's (a command reads as the helper's short description of it). Files it writes one after another fold into one line, **Updated 3 files** (**Updating 3 files** while it works); click it to see each file. If it failed, opening it shows why. It stays open until you close it.

## Opening a step

Click a step to see its details. A step with nothing more to show doesn't open.

- **A command**: the command and what it printed, with a copy button.
- **A file Ella read or wrote**: its code, with line numbers. **A file she edited**: the change, as added and removed lines.
- **A web search**: the pages it found, as links that open in a new tab.
- **A failed step**: the error. When the error points at the app's files, each one is listed with its line; the app's pages and components open in the code editor at that line. Lines from libraries are folded behind a count, such as **3 library frames**.
- **A step you denied**: what Ella asked to do. It isn't shown as an error: the line already says **Denied**.
- **Any other step**: what it was given (**Parameters**) and what came back (**Result**, or **Error**).

## Ella's to-do list

On a bigger job Ella keeps a to-do list. It shows once in the reply and updates in place: **3 to do** (open, with the item she's on spinning while she works) and **2 completed** (also open). Click either to fold it.

## Permission prompts

When Ella needs your permission for a step, the chat shows **Allow this step?** with what she wants to do (the command she wants to run, or the file she wants to change) and two buttons, **Deny** and **Allow**. She waits for your answer.

- **Allow** runs the step. After **Deny** the step reads **Denied** and Ella is told you declined.
- A prompt that can no longer be answered (you sent a new message instead, or the chat is paused: `building/troubleshooting.md`) shows as a line with a faded icon, marked **Not answered**.

## After a reply

- **Read 1 page** / **Read N pages**: shown after a reply Ella read web pages for. Click it to list them; each opens in a new tab.
- **The version line**: after a reply that changed the app, a thin line with the version's title, a **Live** or **Draft** badge when it is the live version or the current draft, and one button: **Make live** on the current draft, **Restore** on an older version. Both ask before they run (`building/versions-and-publishing.md`).
- **Under the reply**: a copy button (**Copy response**), the time, and how long Ella worked (**Worked for 2m 24s**, for anything that took a second or more). A reply that didn't finish also says **Stopped** or **Run failed**; when it ended before Ella wrote anything, this line is all that shows under your message.
  - The latest reply always shows this line. Older replies show it when you hover them (always on a touch screen); one marked **Stopped** or **Run failed** keeps it in view.
- Code in a reply sits in a block named for its language, with a copy button.
