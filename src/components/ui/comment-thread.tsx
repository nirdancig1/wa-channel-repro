import {
  COMMENT_AGENT_MENTION_PATTERN,
  COMMENT_BODY_MAX_LENGTH,
  COMMENT_USER_MENTION_PATTERN,
  type CommentDto,
  type CommentMenuState,
  type CommentThreadDto,
  type CommentThreadLoadState,
  type ComposerAgent,
  initials,
  type MentionableUserDto,
  type MentionNames,
  useCommentMenu,
  useMentionComposer,
  useThreadScroll,
} from '@blocksdiy/react-common/comments';
import { format } from 'date-fns';
import {
  ArrowUp,
  Check,
  ChevronDown,
  MoreHorizontal,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import * as React from 'react';
import { createPortal } from 'react-dom';
import { Streamdown } from 'streamdown';

import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { pagePickIgnoreProps } from '@/components/ui/page-pick';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

/*
 * One comment thread: its comments, the agent replies in it, and the composer with @mentions of
 * people and of the app's agents. Rendered by `Comments` beside a pin, or as a sheet on a phone.
 *
 * It reads like a conversation: on top one muted line saying what the thread is about (the words
 * in quotes, else what the element is, else its page), with the thread's actions (Resolve or
 * Reopen, Close) at its end and, under it, only the state that applies (out of date, not showing);
 * then each comment as its author's face, name and time with the text indented under the name, an
 * agent's reply as "<Agent> · via <asker>", and the composer last. The comments scroll between the
 * two, opening at the newest. Esc anywhere in it closes it (an open menu first). A thread that
 * can't be shown says why (not available, or didn't load) and offers no composer. Parts carry
 * `data-slot` (`comment-thread`, `comment-thread-header`, `comment-thread-subject`,
 * `comment-thread-comments`, `comment-thread-missing`, `comment`, `comment-time`, `comment-menu`,
 * `comment-menu-content`, `comment-agent-reply`, `comment-reply-note`, `comment-working-note`,
 * `comment-composer`, `comment-mention-menu`, `comment-send-to`, `comment-send-to-menu`,
 * `comment-send-to-trigger`, `comment-send-to-menu-content`, `comment-send-to-item`,
 * `comment-thread-unavailable`, `comment-thread-load-error`) for an app's own styling.
 *
 * The menus here (a comment's ⋯, the @ menu, the agent picker) are drawn in the thread itself, not
 * as the app's portalled DropdownMenu or Popover: those open on the page's body, beneath the
 * comments layer and outside what the page picker leaves alone, so a click in them would pick the
 * page instead.
 */

/** An agent that can be mentioned: one of the app's floating-chat agents. */
export interface CommentAgentOption {
  id: string;
  name: string;
  photoUrl?: string;
}

/** "now", "4m", "3h", "2d", then the date: a comment's time, at a glance. */
const shortTime = (iso: string) => {
  const date = new Date(iso);
  const seconds = Math.max(0, (Date.now() - date.getTime()) / 1000);
  if (seconds < 60) {
    return 'now';
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m`;
  }
  if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)}h`;
  }
  if (seconds < 7 * 86400) {
    return `${Math.floor(seconds / 86400)}d`;
  }
  return format(date, 'MMM d');
};

export interface CommentTimeProps extends Omit<
  React.ComponentProps<'time'>,
  'children'
> {
  /** When, as an ISO string. */
  iso: string;
  /** Text after the short time (` · edited`). */
  suffix?: string;
}

/** A comment's time: short on the row, the full date and time on hover and for assistive tech. */
function CommentTime({ iso, suffix, className, ...props }: CommentTimeProps) {
  const full = format(new Date(iso), 'PPp');
  return (
    <time
      {...props}
      data-slot="comment-time"
      dateTime={iso}
      title={full}
      className={cn('shrink-0 text-xs text-muted-foreground', className)}
    >
      {shortTime(iso)}
      {suffix}
    </time>
  );
}

export type CommentIconActionProps = Omit<
  React.ComponentProps<typeof Button>,
  'aria-label' | 'title'
> & {
  /** Its accessible name and tooltip. */
  label: string;
};

/** The thread's icon-only actions: the app's ghost Button, named by a label and a tooltip. */
function IconAction({ label, className, ...props }: CommentIconActionProps) {
  return (
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      aria-label={label}
      title={label}
      className={className}
      {...props}
    />
  );
}

/**
 * A comment menu's open content: portalled to the comments' layer (`useCommentMenu`'s
 * `container`), fixed where the menu stands, out of the page picker's reach.
 */
function CommentMenuContent({
  menu,
  slot,
  className,
  children,
}: {
  menu: CommentMenuState;
  slot: string;
  className?: string;
  children: React.ReactNode;
}) {
  return menu.container
    ? createPortal(
        <div
          {...menu.menuProps}
          {...pagePickIgnoreProps}
          data-slot={slot}
          className={cn(
            'pointer-events-auto fixed z-[2147483001] w-max rounded-lg border bg-popover p-1 text-popover-foreground shadow-md duration-100 animate-in fade-in-0 zoom-in-95 motion-reduce:animate-none',
            className,
          )}
        >
          {children}
        </div>,
        menu.container,
      )
    : null;
}

/** Room the ⋯ menu needs below its button; less than this, it opens above. */
const COMMENT_MENU_ROOM_PX = 56;

/**
 * A comment's ⋯: its own actions (Delete), in a small menu sized to its item. The menu is drawn
 * on the comments' own layer (not inside the thread, whose scroll area would clip it, nor as the
 * app's DropdownMenu, which opens beneath that layer), below its button's end or above it when
 * the window has no room. Opening it moves focus to its item; a pick, Esc or Tab (focus back on
 * ⋯), a click away or a scroll closes it. The behaviour is react-common's `useCommentMenu`.
 */
export interface CommentMenuProps extends Omit<
  React.ComponentProps<'div'>,
  'children' | 'ref' | 'onBlur' | 'onKeyDown'
> {
  /** Delete comment: the menu's one item. */
  onDelete: () => void;
}

/** A comment's ⋯ and its menu (see above). */
function CommentMenu({ onDelete, className, ...props }: CommentMenuProps) {
  const menu = useCommentMenu({ align: 'end', height: COMMENT_MENU_ROOM_PX });
  return (
    <div
      {...props}
      {...menu.rootProps}
      data-slot="comment-menu"
      className={className}
    >
      <IconAction {...menu.triggerProps} label="More">
        <MoreHorizontal />
      </IconAction>
      <CommentMenuContent
        menu={menu}
        slot="comment-menu-content"
        className="min-w-32"
      >
        <button
          type="button"
          role="menuitem"
          tabIndex={-1}
          // The app's destructive menu item: red text and icon, a light red fill when
          // highlighted.
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm whitespace-nowrap text-destructive outline-none hover:bg-destructive/10 focus:bg-destructive/10 dark:hover:bg-destructive/20 dark:focus:bg-destructive/20 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-destructive"
          onClick={() => {
            menu.close();
            onDelete();
          }}
        >
          <Trash2 aria-hidden />
          Delete comment
        </button>
      </CommentMenuContent>
    </div>
  );
}

/**
 * The DS Loader arc sits at radius 9 of its 24 box: this stroke takes its outside to the box's
 * edge, so at the badge's 8px the spinner is an 8px ring with a 2px line (the platform rail's
 * running agent mark).
 */
const WORKING_SPINNER_STROKE_WIDTH = 6;

/**
 * A face in comments: the photo, else initials. While its agent works, the app's avatar badge at
 * its bottom-end corner holds a spinner in the primary colour, on the surface's own colour
 * (`badgeClassName`, the background by default) so it is cut out of the photo — the same mark on
 * a pin and on the agent's reply. The name is always beside or on it: to assistive tech the face
 * is decoration.
 */
export interface CommentAvatarProps {
  /** Whose face: the initials when there is no photo. */
  name: string;
  /** Their photo, if any. */
  photoUrl?: string | null;
  /** An agent at work on it: the spinner badge. */
  isWorking?: boolean;
  /** Merged last onto the avatar. */
  className?: string;
  /** Merged last onto the initials (sized for the default 24px face): a bigger face sets a bigger size. */
  fallbackClassName?: string;
  /** The badge's fill and halo, in the colour of what is around it. */
  badgeClassName?: string;
}

export function CommentAvatar({
  name,
  photoUrl,
  isWorking = false,
  className,
  fallbackClassName,
  badgeClassName,
}: CommentAvatarProps) {
  return (
    <Avatar
      aria-hidden
      data-working={isWorking ? '' : undefined}
      className={cn('size-6', className)}
    >
      {photoUrl ? <AvatarImage src={photoUrl} alt="" /> : null}
      <AvatarFallback className={cn('text-[10px]', fallbackClassName)}>
        {initials(name)}
      </AvatarFallback>
      {isWorking ? (
        <AvatarBadge
          className={cn(
            'size-2! bg-background ring-background',
            badgeClassName,
          )}
        >
          <Spinner
            aria-hidden
            strokeWidth={WORKING_SPINNER_STROKE_WIDTH}
            className="size-2! text-primary motion-reduce:animate-none"
          />
        </AvatarBadge>
      ) : null}
    </Avatar>
  );
}

/** Markdown's own characters in a name, escaped so the name reads as text (here and in the chat). */
export const escapeMarkdown = (text: string) =>
  text.replace(/[\\`*_{}[\]()#+\-.!|<>~]/g, '\\$&');

const MENTION_HREF = '#blocks-mention-';

/**
 * A stored body as markdown: each mention token a link the renderer draws as a name chip, and each
 * line break kept (markdown would fold a single one into a space).
 */
const bodyMarkdown = (body: string, names: MentionNames) =>
  body
    .replace(/([^\n])\n(?!\n)/g, '$1  \n')
    .replace(
      new RegExp(COMMENT_USER_MENTION_PATTERN.source, 'g'),
      (_token, id: string) =>
        `[@${escapeMarkdown(names.users.get(Number(id)) ?? 'someone')}](${MENTION_HREF}user)`,
    )
    .replace(
      new RegExp(COMMENT_AGENT_MENTION_PATTERN.source, 'g'),
      (_token, agentId: string) =>
        `[@${escapeMarkdown(names.agents.get(agentId) ?? 'an agent')}](${MENTION_HREF}agent)`,
    );

/**
 * A mention's chip in the composer, a tinted run under the textarea's own text: people's neutral,
 * agents' in the primary tint. Only a fill, so the run is set exactly as the textarea's text is
 * (a weight of its own would widen it and drift every run after it on the line).
 */
const mentionChipClassName = (kind: 'user' | 'agent') =>
  cn(
    'rounded-sm shadow-[0_0_0_2px]',
    kind === 'agent'
      ? 'bg-primary/15 shadow-primary/15'
      : 'bg-muted shadow-muted',
  );

// In sent text a mention is coloured text; the composer keeps its chips.
const commentMarkdownComponents = {
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) =>
    href?.startsWith(MENTION_HREF) ? (
      <span className="font-medium text-primary">{children}</span>
    ) : (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-primary underline underline-offset-2"
      >
        {children}
      </a>
    ),
};

/**
 * A comment's text: markdown, with its mentions in colour, each paragraph set in its own
 * direction (a Hebrew comment in an English app reads right to left, and the other way round).
 */
export interface CommentBodyProps {
  /** The stored body, mention tokens included. */
  body: string;
  /** The names its mention tokens read as. */
  names: MentionNames;
}

/** A comment's text (see above). */
function CommentBody({ body, names }: CommentBodyProps) {
  return (
    <Streamdown
      mode="static"
      dir="auto"
      components={commentMarkdownComponents}
      className="text-sm break-words [&_ol]:ps-5 [&_p]:my-1 [&_ul]:ps-5 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
    >
      {bodyMarkdown(body, names)}
    </Streamdown>
  );
}

/**
 * A comment's row: the author's face, name and time, an optional action at the row's end, and
 * what they said beneath, indented to the name so the faces make one column down the thread.
 */
export interface CommentItemProps extends Omit<
  React.ComponentProps<'div'>,
  'slot' | 'children'
> {
  /** Its `data-slot`: a person's comment or an agent's reply. */
  slot: 'comment' | 'comment-agent-reply';
  /** The author's face. */
  avatar: React.ReactNode;
  /** The author's name, on one line. */
  name: React.ReactNode;
  /** When (a `CommentTime`). */
  time: React.ReactNode;
  /** At the row's end (a comment's ⋯), shown on hover where a pointer can hover. */
  action?: React.ReactNode;
  /** What they said, indented to the name. */
  children?: React.ReactNode;
}

/** A comment's row (see above). */
function CommentRow({
  slot,
  avatar,
  name,
  time,
  action,
  children,
  className,
  ...props
}: CommentItemProps) {
  return (
    <div
      {...props}
      data-slot={slot}
      className={cn('flex flex-col gap-1', className)}
    >
      <div className="flex min-h-6 min-w-0 items-center gap-2 text-sm">
        {avatar}
        <span className="min-w-0 truncate font-medium">{name}</span>
        {time}
        {action ? (
          // Where a pointer can hover, a comment's ⋯ hides until the row is hovered, something in
          // it has focus or its menu is open; on touch it always shows. It adds no height.
          <div className="-my-1.5 ms-auto flex shrink-0 items-center transition-opacity duration-150 motion-reduce:transition-none [@media(hover:hover)]:[[data-slot=comment]:not(:hover)_&:not(:focus-within):not(:has([aria-expanded=true]))]:opacity-0">
            {action}
          </div>
        ) : null}
      </div>
      {children ? (
        <div className="flex min-w-0 flex-col items-start gap-1.5 ps-8">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** Typed props of the thread view; `Comments` passes them all. */
export interface CommentThreadViewProps extends Omit<
  React.ComponentProps<'div'>,
  'children' | 'onSubmit' | 'onClose' | 'className' | 'onKeyDown'
> {
  /** The thread with its comments; null while it loads and for a draft. No composer until it loads. */
  thread: CommentThreadDto | null;
  /** @deprecated Ignored: each comment shows its own author. Kept so 1.0.0 callers still compile. */
  authorId?: number | null;
  /**
   * Where the thread stands while `thread` is null: a spinner while `loading` (or unknown),
   * "This comment isn't available." with Close when `not_found` (deleted, or not the reader's to
   * see), "Couldn't load this thread." with Try again (`onRetryLoad`) when `failed`.
   */
  loadState?: CommentThreadLoadState;
  /** Loads the thread again: Try again, when it `failed`. */
  onRetryLoad?: () => void;
  /**
   * The words the thread is about (the picked words, else the element's text, however long): the
   * top line shows them in quotes, cut to the line.
   */
  quote?: string;
  /**
   * What the element is when there are no words: its component's name (`TaskCard`), else a plain
   * word for its kind (an image, an icon). The top line without a quote.
   */
  element?: string;
  /** The page the thread is on: the top line with neither. */
  page?: string;
  /**
   * The id the top line takes, for the panel's `aria-describedby`: assistive tech hears what the
   * comment is about with the panel's name.
   */
  subjectId?: string;
  /** What the anchored text says now, when it changed. */
  currentText?: string;
  /**
   * What it is on isn't on the page now (its row filtered out or on another page, a closed dialog,
   * deleted): a muted line in the header says so.
   */
  isMissing?: boolean;
  /** Who is reading: their comments get a ⋯ with Delete, and they aren't offered to mention. */
  currentUserId: number | null;
  /** Everyone who can be mentioned; their names and faces in the thread too. */
  people: MentionableUserDto[];
  /** Every agent of the app, so a reply from one names it. */
  agents: CommentAgentOption[];
  /** The agents the composer offers to mention (this person's); `agents` when absent. */
  mentionAgents?: CommentAgentOption[];
  /** The names mention tokens in a stored body read as. */
  names: MentionNames;
  /** A new thread: the composer only. */
  isDraft?: boolean;
  /** Sends the composer's body (mention tokens included); a rejection shows "Couldn't send". */
  onSubmit: (body: string) => Promise<unknown>;
  /** Close (× or Esc). */
  onClose: () => void;
  /**
   * Whether the composer holds something that would be sent (text, or a mention alone); false
   * again when it's sent, emptied or gone. `Comments` keeps the panel open on a click outside then.
   * Pass a stable function (`useCallback`): an inline one is called with false, then true, again on
   * every render.
   */
  onUnsentChange?: (hasUnsent: boolean) => void;
  /**
   * Takes the composer's textarea: `Comments` puts focus back in it when a click outside keeps the
   * panel open.
   */
  composerInputRef?: React.RefObject<HTMLTextAreaElement | null>;
  /** Resolve (true) or reopen (false) the thread; no ✓ without it. A rejection says so. */
  onResolve?: (resolved: boolean) => Promise<unknown>;
  /** Delete one of the reader's comments; no ⋯ without it. A rejection says so. */
  onDelete?: (commentId: number) => Promise<unknown>;
  /**
   * Opens an agent's conversation about the thread (a reply's `agentChatThreadId`): View in chat on
   * its replies — the asker's to continue, anyone else's to read.
   */
  onViewInChat?: (agentId: string, agentChatThreadId: string) => void;
  /** Merged last onto the thread's root. */
  className?: string;
}

export type CommentReplyNoteProps = React.ComponentProps<'p'>;

/** A muted line under an agent's reply header: where it stands. */
const ReplyNote = ({ className, ...props }: CommentReplyNoteProps) => (
  <p
    {...props}
    data-slot="comment-reply-note"
    className={cn('text-sm text-muted-foreground', className)}
  />
);

/** A light sweeping across text, in the app's own colours; still under reduced motion. */
const SHIMMER_CSS = `@keyframes blocks-comment-shimmer { from { background-position: 100% 0; } to { background-position: -100% 0; } }
.blocks-comment-shimmer { background-image: linear-gradient(90deg, var(--muted-foreground) 35%, var(--foreground) 50%, var(--muted-foreground) 65%); background-size: 200% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; animation: blocks-comment-shimmer 1.8s linear infinite; }
@media (prefers-reduced-motion: reduce) { .blocks-comment-shimmer { animation: none; background: none; color: var(--muted-foreground); } }`;

/**
 * While an agent works: its latest progress line (or "Working…"), shimmering, announced politely.
 * The ring spinning around the agent's face says who is working; this line says what it's doing,
 * so the two read as one state and there is no second spinner beside the text.
 */
export type CommentWorkingNoteProps = React.ComponentProps<'p'>;

/** An agent's progress line, shimmering (see above). */
const WorkingNote = ({
  children,
  className,
  ...props
}: CommentWorkingNoteProps) => (
  <p
    {...props}
    data-slot="comment-working-note"
    role="status"
    className={cn('text-sm text-muted-foreground', className)}
  >
    {/* React hoists it to the head once, however many replies are working. */}
    <style href="blocks-comment-shimmer" precedence="default">
      {SHIMMER_CSS}
    </style>
    <span className="blocks-comment-shimmer">{children}</span>
  </p>
);

/**
 * An agent's reply: its face, "<Agent> · via <asker>" and the time, then by state — its latest
 * progress line or "Working…", its question, a wait in the chat, the answer, or that it couldn't
 * finish. Everyone who sees the thread reads it, and opens its conversation (View in chat).
 */
export interface CommentAgentReplyProps {
  /** The reply: a comment by an agent, with its `agentReply`. */
  comment: CommentDto;
  /** The agent, for its name and face; else its name from `names`. */
  agent: CommentAgentOption | undefined;
  /** Who asked for it: "via <asker>". */
  askerName: string;
  /** Who is reading: the asker gets the calls to action. */
  currentUserId: number | null;
  /** The names mention tokens read as. */
  names: MentionNames;
  /** View in chat: opens the reply's conversation. */
  onViewInChat?: (agentId: string, agentChatThreadId: string) => void;
}

/** An agent's reply (see above). */
function AgentReply({
  comment,
  agent,
  askerName,
  currentUserId,
  names,
  onViewInChat,
}: CommentAgentReplyProps) {
  const reply = comment.agentReply!;
  const agentId = comment.author.type === 'agent' ? comment.author.agentId : '';
  const agentName = agent?.name ?? names.agents.get(agentId) ?? agentId;
  // The reader asked for this reply: its conversation is theirs to continue.
  const isAsker =
    comment.author.type === 'agent' &&
    comment.author.requestedByUserId === currentUserId;
  const isWorking = reply.state === 'working';
  // Everyone who sees the reply may read its conversation; only the asker writes in it.
  const canViewInChat = !!reply.agentChatThreadId && !!onViewInChat;
  const openChat = () => onViewInChat?.(agentId, reply.agentChatThreadId!);

  const content = (() => {
    switch (reply.state) {
      case 'working':
        return <WorkingNote>{comment.body || 'Working…'}</WorkingNote>;
      case 'needs_input':
        return (
          <>
            {comment.body ? (
              <CommentBody body={comment.body} names={names} />
            ) : null}
            <ReplyNote>
              {isAsker
                ? 'Waiting for your reply'
                : `Waiting for ${askerName}'s reply`}
            </ReplyNote>
          </>
        );
      case 'waiting_in_chat':
        // The chat is where it waits: for the asker, View in chat is the call to action here.
        return (
          <>
            <ReplyNote>
              {isAsker
                ? 'Needs you in the chat'
                : `Needs ${askerName} in the chat`}
            </ReplyNote>
            {canViewInChat && isAsker ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={openChat}
              >
                View in chat
              </Button>
            ) : null}
          </>
        );
      case 'failed':
        return (
          <ReplyNote>
            Couldn't finish this
            {comment.body ? `: ${comment.body}` : ''}
          </ReplyNote>
        );
      default:
        return comment.body ? (
          <CommentBody body={comment.body} names={names} />
        ) : null;
    }
  })();

  return (
    <CommentRow
      slot="comment-agent-reply"
      avatar={
        // While it works, its face carries the spinner badge its pin has.
        <CommentAvatar
          name={agentName}
          photoUrl={agent?.photoUrl}
          isWorking={isWorking}
          badgeClassName="bg-popover ring-popover"
        />
      }
      name={
        <>
          {agentName}
          <span className="font-normal text-muted-foreground">
            {' '}
            · via {askerName}
          </span>
        </>
      }
      time={<CommentTime iso={comment.createdAt} />}
    >
      {content}
      {/* The conversation, otherwise: a quiet link under the reply, to watch it work or read the
          whole turn (read-only for anyone but the asker). */}
      {canViewInChat && !(isAsker && reply.state === 'waiting_in_chat') ? (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto cursor-pointer p-0 text-xs font-normal text-muted-foreground underline underline-offset-4 hover:text-foreground"
          onClick={openChat}
        >
          View in chat
        </Button>
      ) : null}
    </CommentRow>
  );
}

/**
 * The room the agent picker asks for: each agent's row (a 36px face, the size of the platform's
 * agent faces, and its padding), and the menu's padding and border.
 */
const SEND_TO_ITEM_PX = 48;
const SEND_TO_MENU_CHROME_PX = 10;

/**
 * The composer's "Send to" agent, to pick another: a trigger (the agent's face, its name, a
 * chevron, in the line's muted colour) and a menu of the agents, each a face and a name, the
 * chosen one checked. Built as a comment's ⋯ menu is (react-common's `useCommentMenu`): drawn on
 * the comments' own layer, fixed below its trigger or above it when the window has no room (a
 * sheet on a phone). Opening it (a click, Enter, Space, ↓ or ↑) moves focus to the chosen agent;
 * ↑ ↓ Home End move, Enter or Space chooses (`onChoose`, which puts focus back in the text), Esc,
 * Tab or Shift+Tab close it alone (focus back on the trigger); a click away, a scroll or a resize
 * closes it.
 */
export interface CommentSendToMenuProps extends Omit<
  React.ComponentProps<'div'>,
  'children' | 'onChange' | 'ref' | 'onBlur' | 'onKeyDown'
> {
  /** The agents to choose from. */
  agents: readonly ComposerAgent[];
  /** The agent "Send to" names now. */
  chosen: ComposerAgent;
  /** An agent picked: the menu has closed. */
  onChoose: (agentId: string) => void;
}

/** The "Send to" agent as the composer's line names it: its face and name. */
const SendToAgentLabel = ({ agent }: { agent: ComposerAgent }) => (
  <>
    <CommentAvatar
      name={agent.name}
      photoUrl={agent.photoUrl}
      className="size-4 shrink-0"
    />
    <span className="truncate">{agent.name}</span>
  </>
);

/** The agent picker (see above). */
function SendToMenu({
  agents,
  chosen,
  onChoose,
  className,
  ...props
}: CommentSendToMenuProps) {
  const menu = useCommentMenu({
    align: 'start',
    height: agents.length * SEND_TO_ITEM_PX + SEND_TO_MENU_CHROME_PX,
  });
  return (
    <div
      {...props}
      {...menu.rootProps}
      data-slot="comment-send-to-menu"
      className={cn('flex min-w-0', className)}
    >
      <button
        {...menu.triggerProps}
        type="button"
        data-slot="comment-send-to-trigger"
        aria-label={`Agent to send to: ${chosen.name}`}
        className="-ms-1 flex h-6 min-w-0 items-center gap-1 rounded-sm px-1 outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=open]:bg-muted"
      >
        <SendToAgentLabel agent={chosen} />
        <ChevronDown aria-hidden className="size-3 shrink-0" />
      </button>
      <CommentMenuContent
        menu={menu}
        slot="comment-send-to-menu-content"
        className="max-w-72 min-w-48 overflow-y-auto"
      >
        {agents.map((agent) => {
          const isChosen = agent.id === chosen.id;
          return (
            <button
              key={agent.id}
              type="button"
              role="menuitemradio"
              tabIndex={-1}
              aria-checked={isChosen}
              data-slot="comment-send-to-item"
              data-state={isChosen ? 'checked' : 'unchecked'}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-start text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
              onClick={() => {
                menu.close();
                onChoose(agent.id);
              }}
            >
              <CommentAvatar
                name={agent.name}
                photoUrl={agent.photoUrl}
                className="size-9 shrink-0"
                fallbackClassName="text-sm"
              />
              <span className="min-w-0 flex-1 truncate">{agent.name}</span>
              <Check
                aria-hidden
                className={cn('size-4 shrink-0', !isChosen && 'invisible')}
              />
            </button>
          );
        })}
      </CommentMenuContent>
    </div>
  );
}

/** The @ menu's tallest, and how far it keeps from the window's edges. */
const MENTION_MENU_MAX_HEIGHT_PX = 240;
const MENTION_MENU_COLLISION_PX = 8;

/**
 * The composer, like a chat's prompt input: the text with its mentions drawn as chips (a tinted run
 * behind the textarea's own text, so the caret and selection stay native), markdown typed as text,
 * and inside the same box the "Send to <agent>" line and the send button. "Send to" and the text
 * are one thing: checked exactly when the text mentions that agent; checking it mentions the agent,
 * unchecking removes its mentions. The logic is react-common's `useMentionComposer`.
 *
 * The box wears the app's input chrome (`border-input`, `dark:bg-input/30`) and its focus ring
 * while the text has focus; the checkbox, the agent and Send ring on their own. Typing `@` opens a
 * listbox the text controls (`aria-activedescendant`): ↑ ↓ move, Enter or Tab picks, Esc closes
 * it (and only it: the thread's own Esc closes the thread). "Send to" shows the agent's face and
 * name; with several agents they are a menu button to pick another (`CommentSendToMenu`).
 */
export interface CommentComposerProps extends Omit<
  React.ComponentProps<'div'>,
  'children' | 'placeholder' | 'autoFocus' | 'onSubmit'
> {
  /** Who can be mentioned. */
  people: MentionableUserDto[];
  /** The agents it offers to mention and to send to. */
  agents: CommentAgentOption[];
  /** Who is writing: not offered to mention. */
  currentUserId: number | null;
  /** The textarea's placeholder and accessible name. */
  placeholder: string;
  /** Focus the text on mount. */
  autoFocus?: boolean;
  /** Sends the body (mention tokens included); a rejection shows "Couldn't send". */
  onSubmit: (body: string) => Promise<unknown>;
  /**
   * Whether it holds something that would be sent; false again when sent, emptied or unmounted.
   * Pass a stable function (`useCallback`): an inline one is called with false, then true, again on
   * every render.
   */
  onUnsentChange?: (hasUnsent: boolean) => void;
  /** Takes the textarea, for a caller that puts focus back in it; its own ref otherwise. */
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
}

/** The composer (see above). */
function Composer({
  people,
  agents,
  currentUserId,
  placeholder,
  autoFocus,
  onSubmit,
  onUnsentChange,
  inputRef,
  className,
  ...props
}: CommentComposerProps) {
  const ownTextareaRef = React.useRef<HTMLTextAreaElement>(null);
  const textareaRef = inputRef ?? ownTextareaRef;
  const layerRef = React.useRef<HTMLDivElement>(null);
  const composer = useMentionComposer({
    people,
    agents,
    currentUserId,
    textareaRef,
  });
  const [isSending, setIsSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const hasUnsent = composer.body !== '';
  React.useEffect(() => {
    onUnsentChange?.(hasUnsent);
    return () => onUnsentChange?.(false);
  }, [hasUnsent, onUnsentChange]);
  const sendTo = composer.sendToAgent;
  const listboxId = React.useId();
  const sendToId = React.useId();
  const optionId = (index: number) => `${listboxId}-option-${index}`;
  const activeOptionId = composer.isMenuOpen
    ? optionId(composer.highlighted)
    : undefined;

  // The @ menu opens above the box, or below it when the window has more room there (a thread near
  // the top of the page), never taller than that room: it scrolls inside instead.
  const boxRef = React.useRef<HTMLDivElement>(null);
  const [menuPlacement, setMenuPlacement] = React.useState<{
    side: 'top' | 'bottom';
    maxHeight: number;
  }>({ side: 'top', maxHeight: MENTION_MENU_MAX_HEIGHT_PX });
  const optionCount = composer.options.length;
  React.useLayoutEffect(() => {
    const box = boxRef.current;
    if (!composer.isMenuOpen || !box) {
      return;
    }
    const rect = box.getBoundingClientRect();
    const roomAbove = rect.top - MENTION_MENU_COLLISION_PX;
    const roomBelow =
      window.innerHeight - rect.bottom - MENTION_MENU_COLLISION_PX;
    const side =
      roomAbove >= MENTION_MENU_MAX_HEIGHT_PX || roomAbove >= roomBelow
        ? 'top'
        : 'bottom';
    const maxHeight = Math.max(
      0,
      Math.min(
        MENTION_MENU_MAX_HEIGHT_PX,
        side === 'top' ? roomAbove : roomBelow,
      ),
    );
    setMenuPlacement((current) =>
      current.side === side && current.maxHeight === maxHeight
        ? current
        : { side, maxHeight },
    );
  }, [composer.isMenuOpen, optionCount]);

  // Keys move the highlight past the menu's edge: it scrolls to keep it in view.
  React.useEffect(() => {
    if (activeOptionId) {
      document
        .getElementById(activeOptionId)
        ?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeOptionId]);

  const submit = async () => {
    const body = composer.body;
    if (!body || isSending) {
      return;
    }
    setIsSending(true);
    setError(null);
    try {
      await onSubmit(body);
      composer.reset();
    } catch {
      setError("Couldn't send. Try again.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      {...props}
      data-slot="comment-composer"
      className={cn('relative', className)}
    >
      {composer.isMenuOpen ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Mention"
          data-slot="comment-mention-menu"
          data-side={menuPlacement.side}
          style={{ maxHeight: menuPlacement.maxHeight }}
          className="absolute start-0 z-10 w-64 overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-md data-[side=bottom]:top-full data-[side=bottom]:mt-1 data-[side=top]:bottom-full data-[side=top]:mb-1"
        >
          {composer.options.map((option, index) => (
            <React.Fragment
              key={
                option.kind === 'user'
                  ? `u${option.userId}`
                  : `a${option.agentId}`
              }
            >
              {/* Agents first, then people: a divider between them. */}
              {index === composer.separatorBefore ? (
                <div aria-hidden className="-mx-1 my-1 h-px bg-border" />
              ) : null}
              <button
                id={optionId(index)}
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={index === composer.highlighted}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => composer.setHighlighted(index)}
                onClick={() => composer.pick(option)}
              >
                <CommentAvatar
                  name={option.name}
                  photoUrl={option.photoUrl}
                  className="size-5"
                />
                <span className="truncate">{option.name}</span>
                {option.kind === 'agent' ? (
                  <span className="ms-auto text-xs text-muted-foreground">
                    Agent
                  </span>
                ) : null}
              </button>
            </React.Fragment>
          ))}
        </div>
      ) : null}
      <div
        ref={boxRef}
        className="rounded-lg border border-input bg-transparent shadow-xs transition-[color,box-shadow] has-[textarea:focus]:border-ring has-[textarea:focus]:ring-[3px] has-[textarea:focus]:ring-ring/50 motion-reduce:transition-none dark:bg-input/30"
      >
        <div className="relative">
          {/* The chips: the same text, transparent, with each mention's run tinted — behind the
              textarea, in its exact box, scrolled with it. */}
          <div
            ref={layerRef}
            aria-hidden
            dir="auto"
            className="pointer-events-none absolute inset-0 overflow-hidden px-3 py-2 text-sm break-words whitespace-pre-wrap text-transparent"
          >
            {composer.segments.map((segment, index) =>
              segment.kind === 'mention' ? (
                <span
                  key={index}
                  className={mentionChipClassName(segment.mention.kind)}
                >
                  {segment.text}
                </span>
              ) : (
                <React.Fragment key={index}>{segment.text}</React.Fragment>
              ),
            )}
            {'​'}
          </div>
          <textarea
            ref={textareaRef}
            value={composer.text}
            autoFocus={autoFocus}
            maxLength={COMMENT_BODY_MAX_LENGTH}
            placeholder={placeholder}
            rows={2}
            dir="auto"
            aria-label={placeholder}
            aria-autocomplete="list"
            aria-controls={composer.isMenuOpen ? listboxId : undefined}
            aria-activedescendant={activeOptionId}
            className="relative block field-sizing-content max-h-[min(10rem,25vh)] min-h-14 w-full resize-none overflow-y-auto bg-transparent px-3 py-2 text-sm outline-none [scrollbar-width:none] placeholder:text-muted-foreground [&::-webkit-scrollbar]:hidden"
            onScroll={(event) => {
              if (layerRef.current) {
                layerRef.current.scrollTop = event.currentTarget.scrollTop;
              }
            }}
            onChange={(event) =>
              composer.onChange(event.target.value, event.target.selectionStart)
            }
            onKeyDown={(event) => {
              if (composer.isMenuOpen) {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault();
                  composer.moveHighlight(event.key === 'ArrowDown' ? 1 : -1);
                  return;
                }
                if (event.key === 'Enter' || event.key === 'Tab') {
                  event.preventDefault();
                  composer.pick(composer.options[composer.highlighted]!);
                  return;
                }
                if (event.key === 'Escape') {
                  // Handled: the thread's Esc leaves it open.
                  event.preventDefault();
                  composer.closeMenu();
                  return;
                }
              }
              if (event.key === 'Backspace') {
                // Right after a mention, it's selected whole and the key deletes it.
                composer.onBackspace(
                  event.currentTarget.selectionStart,
                  event.currentTarget.selectionEnd,
                );
                return;
              }
              if (
                event.key === 'Enter' &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                void submit();
              }
            }}
          />
        </div>
        <div className="flex items-center gap-2 ps-3 pe-2 pb-2">
          {sendTo ? (
            // The agent as "Send to" says it: its face and name, in the line's muted colour.
            <div
              data-slot="comment-send-to"
              className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground"
            >
              <Checkbox
                id={sendToId}
                checked={composer.isSendingToAgent}
                onCheckedChange={(checked) =>
                  composer.setSendingToAgent(checked === true)
                }
              />
              <label htmlFor={sendToId} className="shrink-0 cursor-default">
                Send to
              </label>
              {agents.length > 1 ? (
                <SendToMenu
                  agents={agents}
                  chosen={sendTo}
                  onChoose={(agentId) => {
                    composer.chooseSendToAgent(agentId);
                    textareaRef.current?.focus();
                  }}
                />
              ) : (
                <span className="flex min-w-0 items-center gap-1">
                  <SendToAgentLabel agent={sendTo} />
                </span>
              )}
            </div>
          ) : null}
          <Button
            type="button"
            size="icon-sm"
            aria-label="Send"
            title="Send"
            className="ms-auto rounded-full"
            disabled={!composer.body || isSending}
            onClick={() => void submit()}
          >
            {isSending ? <Spinner aria-hidden /> : <ArrowUp />}
          </Button>
        </div>
      </div>
      {error ? (
        <p role="alert" className="pt-1 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** A thread's comments and composer, in the app's theme. */
export function CommentThreadView({
  thread,
  loadState,
  onRetryLoad,
  page,
  quote,
  currentText,
  isMissing,
  currentUserId,
  people,
  agents,
  mentionAgents,
  names,
  isDraft,
  onSubmit,
  onClose,
  onUnsentChange,
  composerInputRef,
  onResolve,
  onDelete,
  onViewInChat,
  className,
  element,
  subjectId,
  authorId: _authorId,
  ...props
}: CommentThreadViewProps) {
  const personById = React.useMemo(
    () => new Map(people.map((person) => [person.userId, person])),
    [people],
  );
  const agentById = React.useMemo(
    () => new Map(agents.map((agent) => [agent.id, agent])),
    [agents],
  );
  const isResolved = thread?.status === 'resolved';
  const comments = thread?.comments ?? [];
  const newest = comments[comments.length - 1];
  const { scrollRef, contentRef, overflow, onScroll } = useThreadScroll({
    contentKey: comments
      .map((comment) =>
        [
          comment.id,
          comment.deleted ? 'deleted' : '',
          comment.agentReply?.state ?? '',
          comment.body ?? '',
        ].join(':'),
      )
      .join('|'),
    newestId: newest?.id,
    isNewestMine:
      newest?.author.type === 'user' && newest.author.userId === currentUserId,
  });
  // The top line without words in quotes: what the element is, else its page.
  const subject = element || page;
  // Resolve, Reopen or Delete that didn't go through: said once, until the next try.
  const [actionError, setActionError] = React.useState<string | null>(null);
  const runAction = (action: () => Promise<unknown>, failure: string) => {
    setActionError(null);
    action().catch(() => setActionError(failure));
  };
  // Where focus goes after a Delete: the deleted comment's ⋯, where the menu put it, goes away.
  const ownComposerRef = React.useRef<HTMLTextAreaElement>(null);
  const composerRef = composerInputRef ?? ownComposerRef;

  return (
    <div
      {...props}
      data-slot="comment-thread"
      data-state={isDraft ? 'draft' : isResolved ? 'resolved' : 'open'}
      className={cn(
        'flex max-h-[min(32rem,80vh)] flex-col gap-3 p-3',
        className,
      )}
      // Esc from anywhere in the thread closes it; what handles its own Esc first (the @ menu, a
      // comment's ⋯) keeps it open.
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !event.defaultPrevented) {
          event.preventDefault();
          onClose();
        }
      }}
    >
      {/* One muted line saying what the thread is about, and under it only the state that
          applies; the thread's actions at the line's end, centred on it — outside the scroll
          area, so they stay in reach however far the comments go. The same for a new comment and
          an open thread. Quoted words run their own way (a Hebrew quote in an English app), and
          the closing quote stays when they are cut. */}
      <div
        data-slot="comment-thread-header"
        className="flex min-w-0 items-start gap-2"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p
            id={subjectId}
            data-slot="comment-thread-subject"
            className="flex h-6 min-w-0 items-center text-xs text-muted-foreground"
          >
            {quote ? (
              <>
                “<bdi className="min-w-0 truncate">{quote}</bdi>”
              </>
            ) : subject ? (
              <bdi className="min-w-0 truncate">{subject}</bdi>
            ) : null}
          </p>
          {isMissing ? (
            <p
              data-slot="comment-thread-missing"
              className="truncate text-xs text-muted-foreground"
            >
              Not showing on this page right now
            </p>
          ) : currentText !== undefined ? (
            <p className="flex min-w-0 text-xs text-muted-foreground">
              <span className="shrink-0 whitespace-pre">
                Out of date · now “
              </span>
              <bdi className="min-w-0 truncate">{currentText}</bdi>”
            </p>
          ) : null}
        </div>
        <div className="-my-1 -me-1.5 flex shrink-0 items-center gap-0.5">
          {isResolved ? (
            <span className="me-1 text-xs text-muted-foreground">Resolved</span>
          ) : null}
          {thread && onResolve ? (
            <IconAction
              label={isResolved ? 'Reopen' : 'Resolve'}
              onClick={() =>
                runAction(
                  () => onResolve(!isResolved),
                  isResolved
                    ? "Couldn't reopen. Try again."
                    : "Couldn't resolve. Try again.",
                )
              }
            >
              {isResolved ? <RotateCcw /> : <Check />}
            </IconAction>
          ) : null}
          <IconAction label="Close" onClick={onClose}>
            <X />
          </IconAction>
        </div>
      </div>

      {!isDraft ? (
        <div
          ref={scrollRef}
          data-slot="comment-thread-comments"
          data-overflow-top={overflow.top ? '' : undefined}
          data-overflow-bottom={overflow.bottom ? '' : undefined}
          onScroll={onScroll}
          // Fades the content out over 24px at each edge with more to scroll that way: a mask,
          // so it needs no colour and covers nothing a click could miss.
          className="-mx-3 min-h-12 flex-1 overflow-y-auto px-3 [--fade-bottom:0px] [--fade-top:0px] [mask-image:linear-gradient(to_bottom,transparent,black_var(--fade-top),black_calc(100%_-_var(--fade-bottom)),transparent)] data-[overflow-bottom]:[--fade-bottom:24px] data-[overflow-top]:[--fade-top:24px]"
        >
          <div ref={contentRef} className="flex flex-col gap-4">
            {thread === null ? (
              loadState === 'not_found' ? (
                <div
                  role="alert"
                  data-slot="comment-thread-unavailable"
                  className="flex flex-col items-start gap-2 text-sm text-muted-foreground"
                >
                  This comment isn't available.
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={onClose}
                  >
                    Close
                  </Button>
                </div>
              ) : loadState === 'failed' ? (
                <div
                  role="alert"
                  data-slot="comment-thread-load-error"
                  className="flex flex-col items-start gap-2 text-sm text-muted-foreground"
                >
                  Couldn't load this thread.
                  {onRetryLoad ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={onRetryLoad}
                    >
                      Try again
                    </Button>
                  ) : null}
                </div>
              ) : (
                <Spinner className="mx-auto text-muted-foreground" />
              )
            ) : (
              comments.map((comment) => {
                if (comment.author.type === 'agent') {
                  const asker = personById.get(
                    comment.author.requestedByUserId,
                  );
                  return (
                    <AgentReply
                      key={comment.id}
                      comment={comment}
                      agent={agentById.get(comment.author.agentId)}
                      askerName={asker?.name ?? 'someone'}
                      currentUserId={currentUserId}
                      names={names}
                      onViewInChat={onViewInChat}
                    />
                  );
                }
                const author = personById.get(comment.author.userId);
                const isMine = comment.author.userId === currentUserId;
                return (
                  <CommentRow
                    key={comment.id}
                    slot="comment"
                    avatar={
                      <CommentAvatar
                        name={author?.name ?? 'Someone'}
                        photoUrl={author?.profileImageUrl}
                      />
                    }
                    name={author?.name ?? 'Someone'}
                    time={
                      <CommentTime
                        iso={comment.createdAt}
                        // A deleted comment says only that: what it was, edited or not, is gone.
                        suffix={
                          comment.editedAt && !comment.deleted
                            ? ' · edited'
                            : undefined
                        }
                      />
                    }
                    action={
                      isMine && !comment.deleted && onDelete ? (
                        <CommentMenu
                          onDelete={() => {
                            composerRef.current?.focus();
                            runAction(
                              () => onDelete(comment.id),
                              "Couldn't delete the comment. Try again.",
                            );
                          }}
                        />
                      ) : undefined
                    }
                  >
                    {comment.deleted ? (
                      <p className="text-sm text-muted-foreground italic">
                        Comment deleted
                      </p>
                    ) : comment.body ? (
                      <CommentBody body={comment.body} names={names} />
                    ) : null}
                  </CommentRow>
                );
              })
            )}
          </div>
        </div>
      ) : null}

      {actionError ? (
        <p role="alert" className="text-xs text-destructive">
          {actionError}
        </p>
      ) : null}

      {/* A reply needs the thread: none while it loads, or when it can't. */}
      {isDraft || thread !== null ? (
        <Composer
          people={people}
          agents={mentionAgents ?? agents}
          currentUserId={currentUserId}
          placeholder={
            isDraft ? 'Add a comment… @ to mention' : 'Reply… @ to mention'
          }
          autoFocus
          onSubmit={onSubmit}
          onUnsentChange={onUnsentChange}
          inputRef={composerRef}
        />
      ) : null}
    </div>
  );
}

export {
  AgentReply as CommentAgentReply,
  CommentBody,
  Composer as CommentComposer,
  IconAction as CommentIconAction,
  CommentMenu,
  CommentRow as CommentItem,
  ReplyNote as CommentReplyNote,
  SendToMenu as CommentSendToMenu,
  CommentTime,
  WorkingNote as CommentWorkingNote,
};

// @blocks-registry comments@1.1.0 — registry version, never edit this line