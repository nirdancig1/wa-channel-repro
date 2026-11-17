---
name: agent-mini-apps
description: Building or changing an agent mini-app — an `artifacts/app.json` miniApps item with `agent` (an agent route in your brief's ENTRY ROUTES) — its folder under src/routes/, the layout.tsx that IS the mini-app (AgentLayout from the agent-layout registry item), the redirect at index.tsx, the new-chat page at new.tsx, the threads/ pages, and the agent's own pages listed in the sidebar. Load this before touching any agent mini-app — creating one, adding a page to one, changing who sees what in it, or wiring its suggestions — even if pages-and-routing or blocks-client is already loaded; those tell you where files go, this tells you what goes in them.
user-invocable: false
---

# Agent mini-apps

An **agent mini-app** is one agent's space — the agent owns a whole job for the people who use it, like a colleague. It is a folder at its declared entry route whose shell is a conversations sidebar (the agent's persona, the agent's pages, "New chat", the live conversation index, the signed-in user's menu) beside the route content. The chat, the conversation list and feedback are built in; what you build are the agent's pages (below), designed for this agent's job from the brief's `MINI-APPS` paragraph.

Everything here comes from ONE registry item, `agent-layout` (it brings `agent-chat` along):

```bash
yes n | CI=1 pnpm dlx shadcn@4.23.0 add ./.blocks-registry/agent-layout.json -y
```

Then import from `@/components/ui/agent-layout` (`AgentLayout`, `AgentConversation`, `AgentViewport`, the parts) and `@/components/ui/agent-chat` (`AgentChatSimple`).

**Floating agent chat.** The layout's sidebar picks open the app's floating agent chat (`floating-agent-chat.tsx`, installed with the layout): the conversation in a panel over the page, in every mini-app. An app with an agent mini-app must have `FloatingAgentChatProvider` once in the layout that wraps the whole app (`src/root.tsx`, or a top-level `routes/layout.tsx`) — add it with the layout; without it, picks navigate. Give it `agents`, one entry per agent mini-app — `{ agent: <Name>Agent, agentChat: <Name>ChatAgentChat, entryRoute: '/<the mini-app's entryRoute>' }` (the handles from `@/product-types`, the route from `artifacts/app.json`) — and the platform's rail (the chat bubble on an agent's row) opens a new chat with any of those agents in the floating chat panel, from anywhere in the app. Every turn in the floating chat carries `urlContext` — the page's route params and search params (a repeated key as an array) — beside `chatContext`: the provider's own `chatContext` (the app's, for every floating conversation — a module-level constant, like `agents`) under the opener's (the layout's on a sidebar pick; `open`'s) — plus what the page itself tells the agent: its entity reads and `useAgentContext` (the `blocks-client` skill → agents.md).

## The layout IS the mini-app — nothing around it

`layout.tsx` returns the layout as the **entire** route element. No page header naming the agent above it (the layout carries the persona itself), no wrapping card, padding or height math, no second nav, no `h-screen`. The layout's sidebar already carries the user menu, theme mode and sign out, so an agent-only app needs no other chrome at all. The layout fills from where it starts to the bottom of the viewport on its own.

## The folder

Worked example — the brief's `ENTRY ROUTES` names `/support (SupportAgent)` and its `MINI-APPS` paragraph says: _"/support is SupportAgent's mini-app for the support managers (role SupportManager), who direct the agent; nobody else enters it. Its job: resolve every ticket from first message to closed. …"_ — and goes on to its data and what the managers do there. Every name below comes from that; substitute yours.

```text
src/routes/support/
├── layout.tsx            the mini-app's shell → <AgentLayout> (who sees it: below)
├── index.tsx             "/support"                     a plain redirect → <Navigate replace /> to the agent's work
├── new.tsx               "/support/new"                 the EMPTY NEW CHAT   → <AgentConversation suggestions />
├── threads/
│   ├── index.tsx         "/support/threads"             redirect to "/support/new"
│   └── [threadId].tsx    "/support/threads/:threadId"   one conversation     → <AgentConversation threadId />
└── tickets.tsx           "/support/tickets"             one of the agent's own pages, listed via `links` — which pages there are is your design
```

- `layout.tsx`, `index.tsx`, `new.tsx`, `threads/index.tsx` and `threads/[threadId].tsx` are **mandatory** — the sidebar navigates to these URLs.
- **`new` and `threads` are reserved.** Every other name is yours.
- **`index.tsx` is an ordinary redirect** — file-system routing decides where the mini-app opens, nothing else to declare. The page where its people follow the agent's work, the first of `links` — `<Navigate to="/support/tickets" replace />` — unless the brief says this agent has no work items and opens on the new chat: `<Navigate to="/support/new" replace />`. The persona header at the top of the sidebar navigates to the entry route, so it lands wherever `index.tsx` sends it.
- The rest of the folder follows the `pages-and-routing` rules as usual (flat files, fold into a folder at the second URL, `layout.tsx` only for shared chrome). An item the brief gives a link path for (an email, a notification or a workflow's message links to it) always gets its own `[id]` route at exactly that path — the link is already written, so the path is not yours to change — and a missing or unknown id redirects to the page that lists the items. Nested pages inherit the shell and their sidebar link stays lit (`/support/tickets/42` lights "Tickets").
- **Pages serve what the brief says this agent's people do here** — which pages, and how each one looks, is your design ("The agent's pages" below), plus any page the brief names. **Propose** in your report what you see missing — never build a page for something unbriefed. This folder holds the agent's pages, not the app's: when a briefed page reads as the app's rather than the agent's (records that aren't its work items, a screen several agents share, admin), say so in your report as a page-mini-app candidate — the orchestrator owns the split.

## `layout.tsx` — the shell, and who sees it

**Signed-in users only.** The layout lists the agent's conversations and is never rendered for an anonymous visitor (it throws). In a private app the platform's login already guarantees that, so `layout.tsx` is just the layout. In a **public** app, branch on `user.isAuthenticated` first and give guests a sign-in prompt (the `public-app` skill); the floating agent chat has the same gate, so call `open()` only for a signed-in user.

Anything narrower — some roles see the shell, others don't — is the app's ordinary decision, made here from what the brief says about who uses this mini-app, exactly like deciding who sees a button: the `roles-and-authentication` skill (deny in place, never a redirect). Not a rule of this skill. The orchestrator also lists those roles in the declaration's `roles`, so the platform's rail hides the mini-app from everyone else — but a direct URL still opens it, so this check stays. Neither is the agent's `adminRoles`, which only decides who gets the admin chat (feedback, the admin tools) inside the shell.

```tsx
// src/routes/support/layout.tsx
import { useAgentChat, useUser } from '@blocksdiy/blocks-client-sdk/reactSdk';
import { TicketIcon } from 'lucide-react';
import { Outlet } from 'react-router';
import { AgentLayout } from '@/components/ui/agent-layout';
import { SupportChatAgentChat } from '@/product-types';

export default function SupportLayout() {
  const agentChat = useAgentChat(SupportChatAgentChat); // the mini-app's own block, from the brief's AGENTS line — its artifact carries `"isAdmin": true`
  const user = useUser();

  // Public app only — in a private app the platform's login already keeps guests out; drop this branch.
  if (!user.isAuthenticated) return <SignInPrompt />; // yours to write — the public-app skill

  // Narrower than "everyone signed in" ONLY when the brief says so — an ordinary role check, e.g.
  // `if (user.role !== 'support_manager') return <NotForYourAccount />;` (roles-and-authentication skill)

  return (
    // "New chat", the conversation list and the user menu (theme, sign out) are the block's own;
    // `links` are only this mini-app's pages. `userMenuItems` only when the app needs an extra item.
    <AgentLayout
      agentChat={agentChat}
      links={[{ icon: TicketIcon, label: 'Tickets', path: '/support/tickets' }]}
    >
      <Outlet />
    </AgentLayout>
  );
}
```

When the brief wants people who don't get the shell to still chat with the agent at this route, render `AgentChatSimple` for them over **their own** agent-chat block (its own handle on the `AGENTS` line), inside `<AgentViewport>` so it fills to the viewport bottom: `<AgentViewport><AgentChatSimple agentChat={theirChat} className="min-h-0 flex-1" /></AgentViewport>` — no `<Outlet/>`, the chat is the whole mini-app for them. `AgentConversation` renders only under `AgentLayout`, never there. A handle you need but the brief doesn't name is a missing artifact: report it, never reuse the layout's handle for another surface. **That block's artifact carries `"isAdmin": false`** — only the block the layout itself is given is `true`. The two sit at the same route, so this is the easiest place to get it backwards.

## The conversation pages

Three files of a few lines each, importing from `react-router` and `@/components/ui/agent-layout`:

- `new.tsx` — `<AgentConversation suggestions={[…]} />`, the empty new chat.
- `threads/[threadId].tsx` — `const { threadId } = useParams()` → `<AgentConversation threadId={threadId} />`.
- `threads/index.tsx` — `<Navigate to="/support/new" replace />`: a thread URL without a thread is a new chat.

**Suggestions belong to `new.tsx` alone.** `AgentConversation` ignores them when `threadId` is set, and `threadId` is never optional on the thread page. Real prompts for this app, never placeholder copy.

`AgentConversation` renders **only** in `new.tsx` and `threads/[threadId].tsx`. A chat embedded in one of the mini-app's pages is `AgentChatSimple` over its own agent-chat block, never `AgentConversation`.

### Linking into a conversation — "talk to the agent about this"

A row an agent created or changed can link to the conversation it happened in, opened at the exact run (turn) that did it:

```tsx
import { threadHref } from '@/components/ui/agent-layout-context';

// created by the agent — the thread is on the row; the run comes from useEntityAttribution
threadHref('/support', task.createdByAgentThreadId, {
  runId: attribution?.createdByAgentRunId ?? undefined,
});
// its status changed by the agent — the column's own thread and run
threadHref('/support', attribution.columns.status.updatedByAgentThreadId, {
  runId: attribution.columns.status.updatedByAgentRunId ?? undefined,
});
// → "/support/threads/<threadId>?runId=<runId>"
```

`?runId=` scrolls the conversation to that run's first message and tints its messages briefly; the thread page passes nothing extra — `AgentConversation` reads it from the URL. A run that isn't in the thread opens the conversation normally. Navigate with the router (`<Link to>` / `navigate`), like any in-app link. Where the ids come from, and when a row has none: the `blocks-client` skill → entities.md → Agent attribution.

To open it beside the page instead, in the floating agent chat as the sidebar does: `useAgentLayout().openConversation({ chatThreadId })` (from `agent-layout-context`; never `useFloatingAgentChat().open` with the layout's handle).

- **Offer the link only when it can open:** the id's agent (`createdByAgentId` / `updatedByAgentId`) is THIS mini-app's agent — `useIsAgent(<Agent>ChatAgentChat).isAgent(id)`, never `=== <Agent>ChatAgentChat.agentId` (the row holds a block id, the handle a name; they never compare equal) — and the thread id is set.
- **The thread id alone is enough, wherever the conversation happened.** A conversation belongs to the agent, not to a chat block: a row the agent wrote from an action's SendAgentMessage node, a workflow (an email follow-up, a scheduled run), or a plain chat elsewhere carries a thread id that `threadHref(basePath, threadId, { runId })` opens and continues here.
- **Everyone who enters the mini-app sees all of the agent's conversations** unless the layout sets `private` (below) — linking doesn't widen who can see a thread; the layout's own access decision (above) still applies.

## The mini-app's pages

Every page is an ordinary route file in the folder with a matching `links` entry — one entry per page, one page per entry, `path` absolute and inside the folder. Pages render in the content column next to the sidebar, scroll on their own, and never wait on the chat runtime (they render instantly even while the conversations sidebar is still loading). Each brings its own header and padding (a `flex flex-col gap-6 p-6` column: title, one-line description and page actions, then the content) — keep it light and consistent across the mini-app.

Pages are data-backed (the app's tables and views, per the `blocks-client` skill) with their loading/error/empty branches; a page with nothing real behind it is not a page. The sidebar already takes people back ("New chat"; the persona header returns to the entry route) — no "back to chat" links of your own. Never nest a second `AgentLayout` inside a page.

**`links` list this mini-app's pages and nothing else**; linking to another mini-app follows the `app-layout` skill ("Mini-apps link like apps").

## The agent's pages — designed for its job

For an agent that handles work items, the brief's `MINI-APPS` paragraph says what its people come here to do — **follow the agent's work** (every item, where it stands, what the agent is doing on it) and **decide on one item** (its source, its context, what the agent did or recommends and why, what it prepared) — and names the data behind it: the work-item entity and its stages, the columns that say an item waits on a person and for what, the events entity, any metrics view, and the app action behind each step a person takes on a waiting item.

**The design is yours** (the `design` skill): which pages there are, what leads each one, how an item is opened, how a waiting item is marked. Start from this agent's job and the way its people work, never from another agent's mini-app. One thing is fixed: **human approval is the core.** Wherever people are in the mini-app, they can tell that something waits on them and what it wants. Design within the entities and actions the brief names; data a page needs that none of them holds is a missing artifact — report it, never invent it.

What holds whatever the design:

- **A waiting item changes only through the brief's app actions.** People add, edit and move items as ordinary table writes — except an item that waits on a person: its stage and its wait change only through the brief's app actions (Approve, reject), never a write from the page. When the brief names no action for such a step, leave the control out and say so in your report.
- **Approve** shows only while the item waits on a person with an action to approve (the brief's needed-action column is set), and runs the handle the brief pairs with that action via `useExecuteAction` (the `blocks-client` skill): the action performs the step, advances the stage and clears the wait, and the row updates over live sync. Disable it while it runs. A wait that is a question (the brief's question column) has no Approve: the person answers by asking the agent.
- **Asking the agent about an item** is `useAgentLayout().openConversation('new')` (from `@/components/ui/agent-layout-context`): the agent opens beside the page in the floating agent chat. The page's route params and its entity reads already reach the agent on every turn; for state they don't carry (the item open in a panel or dialog, which unlike an item on its own page is not in the URL; the selected draft; a computed total) the component that owns it calls `useAgentContext` (the `blocks-client` skill → agents.md). No chat embedded in the page, no second chat block. Correcting what the agent did on its own goes the same way: feedback is the conversation's, not a form of yours.
- **What changes is read from the table, never from a view.** Items, and counts over rows already loaded (how many wait on a person), come from the work-item table and stay live; a view doesn't update after a write (`refetch()` is a no-op), so the brief's view gives only aggregates over the whole table (value in play, won this month), refreshed when the page remounts. The same goes for a count in a `links` label, counted in `layout.tsx`, which stays mounted for the whole mini-app. Group rows client-side while the table stays small (hundreds of rows); for one that grows, load by `where` on the stage with `page: { size }` (the `blocks-client` skill → entities.md).
- **How the agent got there** is the dated notes of the brief's events entity; when a note or the row carries a thread id, link it to the conversation and run where the agent acted (`threadHref`, "Linking into a conversation" above).
- **Where a page speaks for the agent**, its name and photo are the persona from `useAgent(<Name>Agent)` (the `blocks-client` skill).
- **Every element that shows one item** spreads `itemAnchorProps(<Name>Entity, item.id)`, wherever the item appears, so people can comment on it and ask the agent about it (the `blocks-client` skill → entities.md → Tag what each element shows).

Never rebuild the chat, the conversation list or feedback on a page; the sidebar already holds them.

## Props

`AgentLayout` (the block):

| prop            | meaning                                                                                                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agentChat`     | `useAgentChat(<Agent>ChatAgentChat)` — the mini-app's own block; the persona comes from its agent                                                                                   |
| `links`         | `{ icon, label, path }[]` — this mini-app's own pages, in the nav in this order, with "New chat" last, right above the conversations (lucide icon, absolute path inside the folder) |
| `userMenuItems` | Extra `DropdownMenuItem`s in the user menu, when the app has a reason for one                                                                                                       |
| `chatContext`   | Extra context handed to the agent on every turn of every conversation (default; a conversation may override)                                                                        |
| `size`          | `'sm' \| 'md' \| 'lg'` chat density for the whole layout — transcript, composer, header rows, persona (default `md`)                                                                |
| `private`       | Show each signed-in user only their own conversations (default: all of the agent's). A display filter, not access control                                                           |
| `children`      | `<Outlet />`                                                                                                                                                                        |

`AgentLayoutRoot` (the parts form, below) takes `agentChat`, `chatContext`, `size`, `private` and `minimizeTo` plus plain `div` props (`className`, …); the sidebar goes in its `sidebar` prop and `<Outlet />` is its child, `links` become `<AgentLayoutNavLink>` rows in the order you place them with `<AgentLayoutNewChat>` last in the nav (it accepts `children` to relabel the row), `userMenuItems` the children of `<AgentLayoutUserMenu>`, and the first link's `path` is `minimizeTo`.

`AgentConversation`:

| prop          | meaning                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| `threadId`    | The `[threadId]` route param — always, on the thread page. Omit on `new.tsx` → the empty new chat       |
| `suggestions` | Starter prompts on the welcome hero; each sends as the first message. `new.tsx` only                    |
| `placeholder` | Composer placeholder                                                                                    |
| `size`        | `'sm' \| 'md' \| 'lg'` chat density; defaults to the layout's `size` — set only to make ONE page differ |
| `chatContext` | Replaces the layout's `chatContext` while this page is mounted (only when a page has a reason to)       |

`AgentViewport`: `div` props — the frame for a lone `AgentChatSimple` (above); it fills to the viewport bottom by itself, so there is no `h-[calc(100dvh-…)]` to get wrong. It is a **row** flex box: give the chat `className="min-h-0 flex-1"`.

## What the layout already does — don't rebuild it

- **The URL is the source of truth.** "New chat" navigates to `/support/new`, sidebar rows to `/support/threads/<id>`; the conversation pages select from the URL; Back/Forward and a deep link to a thread all work through the router. Never add your own thread state, selection, or "current conversation" store.
- **The empty new chat** lives at `new`: a draft conversation with the welcome hero (persona avatar, greeting, your suggestions). The first send turns it into a real thread and the layout swaps the URL to `threads/<id>` without interrupting the reply (`replace`, so Back doesn't return to a state that no longer exists). A deep link to an unknown id simply opens an empty conversation under that id — a plain empty transcript, no hero.
- **The entry route renders at once.** `index.tsx` is a redirect outside the chat runtime, so arriving at the mini-app never waits on the chat resolving — whatever it redirects to takes over.
- **The conversation list is the agent's, whole**: every conversation anyone in the account had with this agent — started here, in a plain chat elsewhere, or by a workflow run — one index, shared among everyone who enters the mini-app, each at its plain `threads/<id>`. `private` on `AgentLayout` narrows the list to each user's own conversations — a display filter, not access control; set it when users must not see each other's conversations (health data, HR, one client per user) and say plainly that it filters the UI rather than securing the data.
- **The sidebar** groups conversations by source (Chats / Workflows / Feedback — `source` is write-once, so a listed row stays in its group whatever the agent does on it — only a legacy `unknown` row moves, once, to its first known source) and marks each row with its status by shape (filled dot: waiting for a person; spinner: a run in progress; hollow ring: ended with an error; none: resting), with the status + source filter on the index's top label, rename, load more, live updates, a throttled refresh on window focus; below `md` it is a sheet, opened from the small-screen bar the content column renders above every page.
- **The chat root is mounted once** in the layout and re-pointed per conversation; switching threads never remounts it. `initialPrompt` is disabled there on purpose.
- **Picks on a page open the floating agent chat** beside the page (below `md`, or without the provider, they navigate); arriving on a conversation route of this agent folds it. The way back is built in too: at `md`+ with the provider, the conversation page's header has **Minimize to the floating chat** — the conversation moves into the floating chat, over the page its expand came from, else the first of `links`. Never add your own back-to-the-floating-chat control.
- **Feedback is built in — on the admin chat only.** When the layout's block carries `"isAdmin": true`, `AgentConversation` renders thumbs under each assistant turn for the agent's **admins** — users with build permission, plus the roles in the agent's `adminRoles` (every signed-in user when it lists none; see [agents](../app-artifacts/agents/agents.md)). No feedback UI shows on any other block, or to anyone else. A thumb opens **Send** / **Add comment**: Send records the rating on the conversation as it is (the agent reads it on its next turn there; no thread opens) and shows as a centred **Feedback sent** chip; Add comment sends a normal message about that reply, answered in the same conversation. There is no feedback button in the composer. The agent may propose a change to itself on a **Remember this rule?** card (a short summary of the change, with the full change under Show details, approved or rejected as is), and an approved change opens a feedback thread (`fb-…`) that appears in the sidebar under Feedback, with a `Feedback · From …` line above its transcript linking back. Never hand-build thumbs, ratings, or feedback forms.
- **Skeletons** cover the sidebar (and the conversation, on conversation routes) while the chat runtime resolves; pages never wait for it. If the agent can't be loaded, an error with a retry takes their place — nothing of yours to build.
- **Signed-in only** — the layout throws for an anonymous visitor.

## Composing your own shell (rarely)

`AgentLayout` is a block built from exported parts. When a mini-app genuinely needs a different sidebar (an extra group, a different order, no user menu because `root.tsx` has one), compose the same parts under `AgentLayoutRoot` instead of editing the component file — this is exactly what the block renders:

```tsx
<AgentLayoutRoot
  agentChat={agentChat}
  minimizeTo="/support/tickets"
  sidebar={
    <AgentLayoutSidebar>
      <AgentLayoutPersona />
      <AgentLayoutNav>
        <AgentLayoutNavLink to="/support/tickets" icon={TicketIcon}>
          Tickets
        </AgentLayoutNavLink>
        <AgentLayoutNewChat />
      </AgentLayoutNav>
      <AgentLayoutConversations action={<AgentLayoutThreadFilter />} />
      <AgentLayoutUserMenu />
    </AgentLayoutSidebar>
  }
>
  <Outlet />
</AgentLayoutRoot>
```

The sidebar is the `sidebar` prop and `<Outlet />` the only child — the root places each where it belongs (the content column is the root's own). `minimizeTo` is where a conversation page's **Minimize to the floating chat** goes when the floating chat's expand did not bring the person there — the first page link, as `AgentLayout` passes it; without it such a page has no minimize. Inside the sidebar, order and selection of parts are yours; every part takes `className`. Keep `action={<AgentLayoutThreadFilter />}` on `AgentLayoutConversations` unless you mean to drop the conversation filters.

## Report

Your final report names, for each agent mini-app you touched: the entry route, who sees what (the layout, a plain chat, the denial state), where it opens, and the pages built as `<Label> (<path>)` — plus any page you recommend adding and why. The orchestrator keeps the declaration and the brief in sync from that.
