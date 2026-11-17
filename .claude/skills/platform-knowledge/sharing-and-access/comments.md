# Comments in apps

Team members can comment on anything inside an app, @mention each other, and @mention the app's agents to have them work on it, like comments in a shared document.

## Which apps have comments

- Comments may not be enabled for every account yet [flag: app-comments].
- **Comment** shows in apps that have the comments component. An app with agents gets it with its agent chat: apps built after comments arrived have it, and an older one gets it the next time chat changes its screens. Any other app gets it when you ask chat to add comments. In an app without agents, comments are between people only (there is no agent to mention).

## Who can comment

- Team members (admins and members of the account) who can open the app: everyone in the account when its general access is anything but **Private**, otherwise only the people the app is shared with.
- A comment on a record (a row in a list, a card, a record's page) is seen only by people allowed to see that record under the app's data permissions. See `sharing-and-access/data-permissions.md`.
- External users never see comments, and can't be mentioned.

## Commenting

- Comments are inside Blocks only, not at the app's own URL or in the mobile app.
- Open the app and select **Comment** (speech-bubble icon) at the top right of the app's top bar. It's there only while using the app, not while building: to comment while building, switch to using the app first (⌘B). Switching to building ends comment mode, and coming back leaves it off. It turns blue while it's on. Select it again, or press **Esc**, to stop; inside the app, **Esc** first closes an open thread, then stops. There is no keyboard shortcut to turn it on.
- While it's on, pins show on what people commented on, each with the faces of everyone in its thread (up to three, then +N), and pointing at something outlines it. Click anything to comment on it. Over text the pointer becomes a text cursor: drag across some words (buttons and links included) to comment on just those; a drag stays within the record (or the item) it started in. On a phone, select text first, then tap.
- Type the comment; type **@** to pick one of the app's agents (listed first, then a divider) or a person. Only the agents whose mini-apps your role shows you are offered, the same ones as in the left rail (for a builder, those of the role picked in **View as role**). Picked names show highlighted (agents in the app's main color); **Backspace** right after one removes it whole. **Enter** sends (or the arrow button), **Shift+Enter** starts a new line.
- Comments take markdown: `**bold**`, `_italic_`, `` `code` ``, lists and links show formatted once sent.
- When there's an agent you can mention, the line under the text reads **Send to <agent>**, with the agent's picture and a checkbox: it's checked when the comment mentions that agent. Checking it adds the mention, unchecking removes it; with several agents, select the agent's name to pick another from a list (each with its picture; a check marks the chosen one).
- Select a pin to open its thread; a pin with several threads (a count on it) first lists them, each with who started it and its first comment, to pick one. It opens at the newest comment and follows new ones while you're at the bottom. Reply, delete your own comments (the **⋯** beside one; deleting a thread's only remaining comment deletes the whole thread, while a thread that still has an agent's reply stays and shows "Comment deleted"), **Resolve** it when done (the check at the top of the thread, beside what it's about), **Reopen** to bring it back (a resolved thread says **Resolved** there).
- The top of an open comment says what it's about on one line: the words it's on, in quotes; when there are no words, what the thing is (a component's name, or Image, Icon, Video, Field); otherwise the page. Who is in the thread shows on its pin, not at the top of the comment.
- A pin stands at the top corner of what its comment is on (top right; top left in a right-to-left app), just outside it, its point touching that corner, so it doesn't cover it; for a comment on selected words, above the first selected line at its end. An open comment is placed so it doesn't cover what it's about either: beside its pin, or below or above the element when there's no room beside.
- An open comment always shows its pin beside it, also for a resolved comment while **Hide resolved** is chosen; a new comment you haven't sent yet shows a pin with your own picture.
- With a comment open (a thread, a new comment, or a pin's list of threads), clicking elsewhere on the page only closes it; it doesn't start a new comment. Click again to comment there. If you've typed something you haven't sent, the comment stays open and you can keep typing, so the text isn't lost: send it, or close it with **Esc** or the **×** to discard it. Selecting another pin opens that pin's comment instead.
- A comment you've sent stays with what it's on: scroll the page and its pin and the open comment move with that element, out of sight when it leaves the screen and back when you scroll to it again. A new comment you haven't sent yet stays where you opened it while you scroll. While an open comment is out of sight, a click starts a new comment (the other one closes) and **Esc** stops commenting; but if you'd typed something in it that you haven't sent, the click or **Esc** takes you back to it instead, so nothing is lost.
- While it's on, pins show only open comments whose text is unchanged, and the small arrow beside **Comment** has two options, one always chosen (a check marks it): **Hide resolved**, the default, and **Show resolved**. With **Show resolved**, resolved comments show too (a muted pin with a check, **Reopen** inside) and so do outdated ones (a dashed pin). It stays as set while the app is open.
- Comments belong to the page they were made on; each page shows its own pins.

## When the app changes

- **Out of date**: the text a comment was about has changed (for example a record's value was updated). Its pin shows only with **Show resolved**, dashed, and the thread shows what the text says now.
- Not on the page: what the comment pointed at isn't shown right now (a filtered list, another page of a list, a closed dialog, another tab), so it has no pin. Its notification still opens it, and the thread says **Not showing on this page right now**.
- A link to a comment that was deleted, on a record that was deleted, or that you aren't allowed to see, opens to **This comment isn't available.** A link to a comment on another page of the app opens that page with the thread open.
- A comment on a record stays with that record when the list is sorted, filtered or paged, when the app marks its records (chat does this for lists and cards it builds; older apps may need chat to rebuild the page).

## Asking an agent

- @mention one of the app's agents (the agents of its agent mini-apps) in a comment or a reply. The agent starts working on it right away: its face shows on the pin with a small spinner on it, and your chat with the agent opens in the app's chat panel (when the app has one) so you can watch. The chat shows your comment as your own message, with what it's on above it and "From a comment" under it, and **Open** there to go back to the thread. These links back to the comment (**Open**, and **Open comment** below) show while using the app, not while building.
- In the thread the agent's reply reads "<agent> · via <you>": "Working…" (or what it's doing) while it works, then its answer. In the chat, a finished answer usually ends with a short note that the reply is in the thread.
- The agent is told what the comment points at, that record's data as you can see it, and every comment in the thread you can see. It works with your access to the app's data, and its reply shows in the thread: what it's working on, a question for you (the agent asks only here in the thread, never in the chat, so you answer it in the thread or from its notification), a request to approve something in the chat (**View in chat**: approvals are the one thing answered in the chat), its answer, or that it couldn't finish. Under its reply, **View in chat** opens the conversation the comment started with the agent, in every state. The person who asked can keep talking to the agent there; anyone else who can see the comment, and anyone who builds or manages the app, can read it, but not write in it (the chat says it was started from someone else's comment and offers **Open comment**). Someone's conversation about a comment you can't see says **This conversation isn't available.** To ask the agent yourself, mention it in a comment. The conversation is titled with the agent's own name, not its internal name.
- Its answer is visible to everyone who can see the thread, right away. The agent works with your access, so it sticks to what the comment points at.
- When the agent asks a question in the thread, your next comment in that thread (one that mentions nobody) goes to the agent. The question stays where it is; your answer goes below it, and the agent's next reply comes after your answer.
- An agent resolves the thread only when your comment asks it to ("…and resolve this"), once the rest of what you asked is done, and says so in its reply. Otherwise it leaves the thread open, and its answer ends by saying you can resolve the thread once you've read it. If someone wrote in the thread while it worked, the thread stays open.

## Notifications

- People you @mention get a notification: "<name> mentioned you in <app>". People already in a thread get "<name> replied in <app>" for new replies. You're never notified about your own comments.
- When an agent you asked answers, asks you something or can't finish, you get a notification too, named by the agent's own name ("Olive answered you in <app>"). When the agent couldn't start at all, the notification uses the agent's internal name instead.
- Opening the notification opens the app on that page with the thread open. In a HIPAA workspace a phone alert opens just the app; the same notification in the bell opens the thread.
- You can reply right from the notification (the bell, a desktop alert or your phone); the reply is posted in the thread as yours. Replying to an agent's question this way goes to the agent. See `navigation/notifications.md`.
- In a HIPAA workspace, phone and desktop alerts show only a short generic line ("New mention", "New reply"); elsewhere they can show the comment itself. The full text is always in the bell and the app.
- New comments and replies show up live for everyone who has comment mode on.
