import { useClient, useUser } from '@blocksdiy/blocks-client-sdk/reactSdk';
import {
  type AnchorElementKind,
  anchorSubject,
  COMMENT_AGENT_MENTION_PATTERN,
  COMMENT_MENU_ATTRIBUTE,
  COMMENT_THREAD_QUERY_PARAM,
  COMMENT_USER_MENTION_PATTERN,
  type CommentAnchor,
  commentPingsFor,
  COMMENTS_LAYER_ATTRIBUTE,
  type CommentThreadDto,
  type CommentThreadSummaryDto,
  cornerPoint,
  createCommentsApi,
  groupPins,
  isOnScreen,
  type MentionNames,
  menuKeyTarget,
  openCommentResponse,
  type PagePick,
  panelPosition,
  type PanelSide,
  panelSide,
  parseCommentMentions,
  participantKey,
  PICK_IGNORE_ATTRIBUTE,
  pickPlacement,
  pinParticipants,
  type PinPoint,
  pinWidth,
  type PlacementViewport,
  type Rect,
  type ThreadLayout,
  toRect,
  useCommentAgents,
  useCommentPins,
  useCommentsSurface,
  useCommentThreads,
  useHeld,
  usePagePick,
} from '@blocksdiy/react-common/comments';
import * as CommentsPrimitive from '@blocksdiy/react-common/comments';
import { cva } from 'class-variance-authority';
import { Check, MessageCircle } from 'lucide-react';
import * as React from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, useSearchParams } from 'react-router';

import { AvatarGroup, AvatarGroupCount } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  type CommentAgentOption,
  CommentAvatar,
  CommentThreadView,
} from '@/components/ui/comment-thread';
import {
  alignInline,
  pagePickIgnoreProps,
  PagePickOutline,
} from '@/components/ui/page-pick';
import { cn } from '@/lib/utils';

/*
 * Comments over the running app, in its own theme. Mount <Comments /> once, inside the router, in
 * src/root.tsx or the top-level layout: it renders nothing until the platform turns comment mode
 * on (its Comment button). Then pins show on what people commented on, clicking anything starts a
 * comment there (a word selected first becomes the quote; with a thread open, a click only closes
 * it), and people @mention each other and the app's agents. Rows marked with itemAnchorProps keep
 * their comments when a list is sorted or paged. An open thread always shows its pin, and stays
 * with its element: when the element scrolls out of the window, the pin and the panel go with it.
 * A thread opens from its pin, from its link (`?comment=<id>`: a notification's), or from the agent
 * chat's "From a comment · Open", which the platform sends here to open on the thread's page.
 */

const PANEL_WIDTH = 340;
const PIN_SIZE = 28;
/** How far a pin keeps inside the window when its point is near an edge. */
const PIN_EDGE_MARGIN = 4;
const PHONE_MAX_WIDTH = 640;
/** The width of a grouped pin's chooser (its threads, one row each). */
const CHOOSER_WIDTH = 280;
/**
 * How long a thread's element must stay off the page, its page's threads loaded, before the thread
 * says so: a page still loading its rows never flashes it.
 */
const MISSING_AFTER_MS = 1500;
/**
 * How long a way back to a panel out of sight has to bring it into view (a smooth scroll to its
 * element) before a click or Esc may close it instead.
 */
const RETURN_CHANCE_MS = 1000;

/** The page a thread is on, as its top line names it: the path without slashes, else Home. */
const pageLabel = (routePath: string) =>
  routePath.replace(/^\/+|\/+$/g, '') || 'Home';

/** What a text-less element is, as the top line names it (`anchorSubject` says which kind). */
const ELEMENT_KIND_LABELS: Record<AnchorElementKind, string> = {
  image: 'Image',
  icon: 'Icon',
  video: 'Video',
  field: 'Field',
  button: 'Button',
  link: 'Link',
};

const NO_SHIFT: PinPoint = { x: 0, y: 0 };

/** A pin's width: its faces, and "+N" when some aren't shown. */
const facesPinWidth = (shown: number, moreCount: number) =>
  pinWidth(shown + (moreCount > 0 ? 1 : 0));

/**
 * The window as the placements read it (its layer's width, its height, its direction), as a React
 * input: a resize, a zoom or a change of direction renders the layer again, and nothing the React
 * Compiler caches keeps a place worked out for the window before.
 */
let viewportSnapshot: PlacementViewport | null = null;
const readViewport = (): PlacementViewport => {
  const width = document.documentElement.clientWidth;
  const height = window.innerHeight;
  const isRtl = getComputedStyle(document.documentElement).direction === 'rtl';
  if (
    !viewportSnapshot ||
    viewportSnapshot.width !== width ||
    viewportSnapshot.height !== height ||
    viewportSnapshot.isRtl !== isRtl
  ) {
    viewportSnapshot = { width, height, isRtl };
  }
  return viewportSnapshot;
};
const subscribeToViewport = (onChange: () => void) => {
  window.addEventListener('resize', onChange);
  // A direction flip is an attribute on the root (its `dir`, its language, a class or a style).
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['dir', 'lang', 'class', 'style'],
  });
  return () => {
    window.removeEventListener('resize', onChange);
    observer.disconnect();
  };
};
const SERVER_VIEWPORT: PlacementViewport = {
  width: 0,
  height: 0,
  isRtl: false,
};
const useViewport = () =>
  React.useSyncExternalStore(
    subscribeToViewport,
    readViewport,
    () => SERVER_VIEWPORT,
  );

type OpenState =
  | { kind: 'thread'; threadId: number; point: PinPoint | null }
  | {
      kind: 'draft';
      anchor: CommentAnchor;
      /** What was picked: its pin, if it has one, gives way to the new comment's. */
      element: HTMLElement;
      point: PinPoint;
      target: Rect;
    }
  | null;

const usePhone = () => {
  const query = `(max-width: ${PHONE_MAX_WIDTH - 1}px)`;
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
};

/** One face in a pin's group. */
interface PinFace {
  key: string;
  name: string;
  photoUrl?: string | null;
  /** The agent working on the thread: its face carries the spinner badge. */
  isWorking: boolean;
}

export interface CommentPinProps extends Omit<
  React.ComponentProps<'button'>,
  'onClick' | 'children'
> {
  /**
   * Where the pin points: the top-end corner of what its comment is on. Its pointed corner
   * (bottom-start) sits on it, so the pin stands outside it, above and past its end edge.
   */
  point: PinPoint;
  /** Threads grouped on this spot: a count badge from two up. */
  count: number;
  /** Everyone in the thread, by first comment (the working agent last, on top), up to three. */
  faces: PinFace[];
  /** The rest of them, as "+N". */
  moreCount: number;
  /** The text it was about changed: a dashed, muted edge. */
  isOutdated: boolean;
  /**
   * Shown only with the Comment button's "Show resolved" (it shows outdated ones too), or while
   * its thread is open: muted, with a check.
   */
  isResolved: boolean;
  /** Its thread (or, grouped, its chooser) is open beside it. */
  isActive: boolean;
  /** What a click opens: its thread's panel, or (several threads) a menu of them. */
  hasPopup?: 'dialog' | 'menu';
  /** The page reads right to left: the pin stands up and to the left of the point. */
  isRtl: boolean;
  /**
   * The layer's width (the window's, less a classic scrollbar), as the caller read it this frame;
   * read here when absent. Passed, a resize renders a pin whose other props didn't change.
   */
  viewportWidth?: number;
  /**
   * How far its element has gone past the window's edge (an open thread's, scrolled away): the pin
   * is placed as at `point`, where it stood as the element left, and moves on by this.
   */
  shift?: PinPoint;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** Who and how many: the pin's accessible name. */
  label: string;
}

/** A pin on what people commented on: their faces, its count, and its state. */
function Pin({
  point,
  count,
  faces,
  moreCount,
  isOutdated,
  isResolved,
  isActive,
  hasPopup = 'dialog',
  isRtl,
  viewportWidth,
  shift = NO_SHIFT,
  onClick,
  label,
  className,
  ...props
}: CommentPinProps) {
  // Without `viewportWidth` it reads the window's width while rendering: the React Compiler would
  // cache the position on the props alone and keep a stale one after a resize.
  'use no memo';
  const layerWidth = viewportWidth ?? document.documentElement.clientWidth;
  // The pointed corner (bottom-start) sits on the point, the top-end corner of what the comment is
  // on: the pin stands above it and past its end edge, outside it, and grows (hover, open) from
  // that corner. It stays inside the window: below the top edge, and a pin wider than the room
  // toward the end edge slides back by what it overflows (a translate by its own width).
  const endRoom = isRtl
    ? point.x - PIN_EDGE_MARGIN
    : layerWidth - PIN_EDGE_MARGIN - point.x;
  const isWorking = faces.some((face) => face.isWorking);
  return (
    <button
      {...props}
      type="button"
      data-slot="comment-pin"
      data-state={isActive ? 'open' : 'closed'}
      data-working={isWorking ? '' : undefined}
      data-outdated={isOutdated ? '' : undefined}
      data-resolved={isResolved ? '' : undefined}
      aria-label={label}
      aria-haspopup={hasPopup}
      aria-expanded={isActive}
      onClick={onClick}
      className={cn(
        // A primary edge, a halo in the page's background colour, a faint hairline in its text
        // colour and a lifted shadow: the pin has a boundary on any page, light, dark or busy.
        // Open (`aria-expanded`): a soft primary glow outside it. Pins float over arbitrary page
        // content, so focus shows as a solid outline, clear of the halo. Inside, the faces sit
        // 2px in, their group's rings filling that gap, so the edge stays whole.
        'pointer-events-auto absolute flex items-center rounded-full rounded-es-sm border-2 border-primary bg-background p-0.5 outline-none',
        'shadow-[0_0_0_2px_var(--background),0_0_0_3px_color-mix(in_oklab,var(--foreground)_20%,transparent),0_4px_12px_rgb(0_0_0/0.3)]',
        'transition-transform duration-150 hover:scale-110 motion-reduce:transition-none',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'aria-expanded:scale-110 aria-expanded:shadow-[0_0_0_2px_var(--background),0_0_0_3px_color-mix(in_oklab,var(--foreground)_20%,transparent),0_0_0_7px_color-mix(in_oklab,var(--primary)_35%,transparent),0_4px_12px_rgb(0_0_0/0.3)]',
        'data-[outdated]:border-dashed data-[outdated]:border-muted-foreground',
        'data-[resolved]:border-muted-foreground data-[resolved]:grayscale',
        className,
      )}
      style={{
        ...alignInline(
          'start',
          { left: point.x + shift.x, right: point.x + shift.x },
          { isRtl, viewportWidth: layerWidth },
        ),
        top: Math.max(PIN_EDGE_MARGIN, point.y - PIN_SIZE) + shift.y,
        height: PIN_SIZE,
        minWidth: PIN_SIZE,
        translate: isRtl
          ? `max(0px, calc(100% - ${endRoom}px))`
          : `min(0px, calc(${endRoom}px - 100%))`,
        transformOrigin: isRtl ? '100% 100%' : '0 100%',
      }}
    >
      {/* Later faces overlap earlier ones; "+N" comes before a working agent's face, which
          stays last and on top so its spinner badge is never covered. */}
      <AvatarGroup className="-space-x-1.5 *:data-[slot=avatar]:ring-background">
        {faces
          .filter((face) => !face.isWorking)
          .map((face) => (
            <CommentAvatar
              key={face.key}
              name={face.name}
              photoUrl={face.photoUrl}
              className="size-5"
            />
          ))}
        {moreCount > 0 ? (
          <AvatarGroupCount
            // A working agent's face follows it without overlapping, so "+N" stays legible.
            className={cn(
              'size-5 text-[10px] font-medium',
              isWorking && 'me-0!',
            )}
          >
            {/* "+N" keeps its order on a right-to-left page. */}
            <span dir="ltr">+{moreCount}</span>
          </AvatarGroupCount>
        ) : null}
        {faces
          .filter((face) => face.isWorking)
          .map((face) => (
            <CommentAvatar
              key={face.key}
              name={face.name}
              photoUrl={face.photoUrl}
              isWorking
              className="size-5"
            />
          ))}
      </AvatarGroup>
      {isResolved ? (
        <span
          aria-hidden
          className="absolute -end-1 -bottom-1 flex size-3.5 items-center justify-center rounded-full bg-muted text-muted-foreground ring-2 ring-background"
        >
          <Check className="size-2.5" />
        </span>
      ) : null}
      {count > 1 ? (
        <Badge
          aria-hidden
          dir="ltr"
          className="pointer-events-none absolute -end-1.5 -top-1.5 h-4 min-w-4 px-1 py-0 text-[10px] leading-none tabular-nums ring-2 ring-background"
        >
          {count}
        </Badge>
      ) : null}
    </button>
  );
}

/** A comment's text on one line: each mention as its name, markdown's marks left out. */
const plainCommentText = (body: string, names: MentionNames) =>
  body
    .replace(
      new RegExp(COMMENT_USER_MENTION_PATTERN.source, 'g'),
      (_token, id: string) => `@${names.users.get(Number(id)) ?? 'someone'}`,
    )
    .replace(
      new RegExp(COMMENT_AGENT_MENTION_PATTERN.source, 'g'),
      (_token, agentId: string) =>
        `@${names.agents.get(agentId) ?? 'an agent'}`,
    )
    .replace(/\[([^\]\n]*)\]\([^)\n]*\)/g, '$1')
    .replace(/\*\*|__|~~|`/g, '')
    .replace(/(^|\s)[*_]+|[*_]+(?=\s|$)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

/** One row of a grouped pin's chooser: a thread as the chooser shows it. */
interface PinChooserRow {
  thread: CommentThreadSummaryDto;
  starterName: string;
  starterPhotoUrl?: string | null;
  /** Its first comment's text, once the thread's comments are in. */
  text: string | null;
}

/**
 * A grouped pin's threads, to pick one: a compact menu beside the pin, one row per thread (who
 * started it, its first comment on one line, its replies and whether it's resolved). Drawn on the
 * comments' own layer, like the thread's menus, so a click in it never picks the page. Opening it
 * moves focus to its first row; the arrow keys, Home and End move between rows; Esc closes it with
 * focus back on the pin, and so does focus leaving it.
 */
export interface CommentPinChooserProps extends Omit<
  React.ComponentProps<'div'>,
  'children' | 'style' | 'onClose'
> {
  /** The pin it opened from: focus moving to it (a click to close) is the pin's to handle. */
  pin: HTMLElement;
  /** Its threads, one row each. */
  rows: PinChooserRow[];
  /** Where it goes: beside the pin, or along the bottom on a phone. */
  style: React.CSSProperties;
  /** Its accessible name. */
  label: string;
  /** A row picked: its thread opens. */
  onPick: (threadId: number) => void;
  /** `returnFocus`: Esc, which puts focus back on the pin; a blur leaves it where it went. */
  onClose: (returnFocus: boolean) => void;
}

/** A grouped pin's threads, to pick one (see above). */
function PinChooser({
  pin,
  rows,
  style,
  label,
  onPick,
  onClose,
  className,
  ...props
}: CommentPinChooserProps) {
  const menuRef = React.useRef<HTMLDivElement>(null);
  const items = () =>
    Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
  React.useEffect(() => {
    items()[0]?.focus();
  }, []);
  return (
    <div
      {...props}
      ref={menuRef}
      role="menu"
      aria-label={label}
      data-slot="comment-pin-chooser"
      data-state="open"
      style={style}
      // A press on a row keeps focus where it is (a browser that doesn't focus buttons on click
      // would otherwise blur the menu shut before the click lands).
      onMouseDown={(event) => event.preventDefault()}
      className={cn(
        'pointer-events-auto absolute flex flex-col gap-0.5 overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-md duration-100 animate-in fade-in-0 zoom-in-95 motion-reduce:animate-none',
        className,
      )}
      onBlur={(event) => {
        const to = event.relatedTarget as Node | null;
        if (to !== pin && !menuRef.current?.contains(to)) {
          onClose(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          // Handled here: the layer would close comment mode on it.
          event.preventDefault();
          event.stopPropagation();
          onClose(true);
          return;
        }
        const all = items();
        const next = menuKeyTarget(
          event.key,
          all.indexOf(document.activeElement as HTMLElement),
          all.length,
        );
        if (next !== null) {
          event.preventDefault();
          all[next]?.focus();
        }
      }}
    >
      {rows.map(({ thread, starterName, starterPhotoUrl, text }) => {
        const replies = Math.max(0, thread.commentCount - 1);
        const isResolved = thread.status === 'resolved';
        return (
          <button
            key={thread.id}
            type="button"
            role="menuitem"
            data-slot="comment-pin-chooser-item"
            data-resolved={isResolved ? '' : undefined}
            className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-start text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
            onClick={() => onPick(thread.id)}
          >
            <CommentAvatar
              name={starterName}
              photoUrl={starterPhotoUrl}
              className="mt-0.5 size-6 shrink-0"
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex items-center gap-1.5">
                <span className="min-w-0 flex-1 truncate font-medium">
                  {starterName}
                </span>
                <span
                  className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground"
                  title={`${replies} ${replies === 1 ? 'reply' : 'replies'}`}
                >
                  <MessageCircle aria-hidden className="size-3" />
                  <span aria-hidden dir="ltr" className="tabular-nums">
                    {replies}
                  </span>
                  <span className="sr-only">
                    {`${replies} ${replies === 1 ? 'reply' : 'replies'}`}
                  </span>
                </span>
                {isResolved ? (
                  <span
                    title="Resolved"
                    className="flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                  >
                    <Check aria-hidden className="size-3" />
                    <span className="sr-only">Resolved</span>
                  </span>
                ) : null}
              </span>
              <span
                className={cn(
                  'truncate text-xs text-muted-foreground',
                  text === null && 'animate-pulse motion-reduce:animate-none',
                )}
              >
                {text ?? '…'}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Whether the platform this app runs on serves comments as this copy draws them: an app-render
 * from before comments has no `@blocksdiy/react-common/comments` module, and one from before these
 * parts lacks the helpers they call. Either way the surface renders nothing.
 */
const isCommentsRuntime = () => {
  const runtime = CommentsPrimitive as
    | Partial<typeof CommentsPrimitive>
    | undefined;
  return [
    runtime?.useCommentsSurface,
    runtime?.useHeld,
    runtime?.useThreadScroll,
    runtime?.panelPosition,
    runtime?.pinWidth,
    runtime?.pinParticipants,
    runtime?.participantKey,
    runtime?.menuKeyTarget,
    runtime?.useCommentMenu,
    runtime?.isOnScreen,
    runtime?.openCommentResponse,
    runtime?.anchorSubject,
    runtime?.cornerPoint,
    runtime?.panelSide,
    runtime?.pickPlacement,
  ].every((helper) => typeof helper === 'function');
};

/** The app's comments surface. Renders nothing while comment mode is off. */
export function Comments() {
  if (!isCommentsRuntime()) {
    return null;
  }
  return <CommentsSurface />;
}

function CommentsSurface() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  // A thread the platform asks to open (the agent chat's "From a comment · Open"): its page, with
  // the thread's link, which the layer below opens once the page's threads are in.
  const onOpenThread = React.useCallback(
    ({ threadId, routePath }: { threadId: number; routePath: string }) => {
      const isSamePage = routePath === pathname;
      const params = new URLSearchParams(isSamePage ? search : '');
      params.set(COMMENT_THREAD_QUERY_PARAM, String(threadId));
      navigate(
        { pathname: routePath, search: `?${params.toString()}` },
        { replace: isSamePage },
      );
    },
    [navigate, pathname, search],
  );
  const { isCommentMode, options, exit } = useCommentsSurface({
    onOpenThread,
  });
  if (!isCommentMode) {
    return null;
  }
  return (
    <CommentsLayer
      onExit={exit}
      showResolved={options.showResolved}
      mentionableAgents={options.mentionableAgents}
    />
  );
}

/**
 * The thread's panel: a sheet from the bottom on a phone, else a popover by its pin, clear of what
 * the comment is on where there is room (placed by `panelPosition`). Both enter in 150–200ms, at
 * once under reduced motion.
 */
const commentThreadPanelVariants = cva(
  'pointer-events-auto absolute border bg-popover text-popover-foreground shadow-xl ease-out animate-in fade-in-0 data-hidden:invisible motion-reduce:animate-none',
  {
    variants: {
      placement: {
        sheet:
          'inset-x-0 bottom-0 max-h-[80vh] rounded-t-2xl pb-[env(safe-area-inset-bottom)] duration-200 slide-in-from-bottom-4',
        beside: 'flex flex-col rounded-xl duration-150 zoom-in-95 *:min-h-0',
      },
    },
  },
);

export interface CommentsLayerProps extends Omit<
  React.ComponentProps<'div'>,
  'children'
> {
  /** Ends comment mode: Esc with nothing open. */
  onExit: () => void;
  /**
   * The Comment button's option, "Show resolved" (else "Hide resolved"): resolved and outdated
   * threads' pins show too. An open thread's pin shows either way.
   */
  showResolved: boolean;
  /**
   * The agents this person may mention (their roles' agent mini-apps), by block name; every agent
   * of the floating chat when the platform doesn't say.
   */
  mentionableAgents?: readonly string[];
}

/**
 * Comment mode's layer: the pins (`comment-pin`), a chooser (`comment-pin-chooser`), the open
 * thread's panel (`comment-thread-panel`) and the picker's outline. The panel's `data-placement`
 * says where it is: `beside` (past its pin's end side, level with the pin's top, hanging down; also
 * while it slides up along the pin for room, within the slack before it hangs up), `beside-up`
 * (there, hanging up from the pin's bottom), `below` or `above` what the comment is on,
 * `over` or `over-up` (before the pin's start, over it: the last resort), `corner` (nothing on the
 * page to stand by), or `sheet` (a phone).
 */
function CommentsLayer({
  onExit,
  showResolved,
  mentionableAgents,
  className,
  ...props
}: CommentsLayerProps) {
  const client = useClient();
  const user = useUser();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isPhone = usePhone();
  const viewport = useViewport();
  const isRtl = viewport.isRtl;
  const currentUserId = user?.id ? Number(user.id) : null;

  const api = React.useMemo(
    () =>
      createCommentsApi({
        appId: client.appId,
        getToken: () => client.token,
      }),
    [client],
  );
  const subscribe = React.useMemo(
    () => commentPingsFor(client.appId),
    [client.appId],
  );
  const { store, snapshot } = useCommentThreads({
    api,
    appId: client.appId,
    subscribe,
    routePath: pathname,
    isActive: true,
  });
  const { agents: chatAgents, openThread: openAgentThread } =
    useCommentAgents();
  const agents = React.useMemo<CommentAgentOption[]>(
    () =>
      chatAgents.map((agent) => ({
        id: agent.id,
        name: agent.title,
        photoUrl: agent.photoUrl,
      })),
    [chatAgents],
  );
  // Mentions offer only these; agents mentioned before still read by name in the thread.
  const mentionAgents = React.useMemo(
    () =>
      mentionableAgents
        ? agents.filter((agent) => mentionableAgents.includes(agent.id))
        : agents,
    [agents, mentionableAgents],
  );
  const names = React.useMemo(
    () => ({
      users: new Map(
        snapshot.mentionableUsers.map((person) => [person.userId, person.name]),
      ),
      agents: new Map(agents.map((agent) => [agent.id, agent.name])),
    }),
    [agents, snapshot.mentionableUsers],
  );

  const [open, setOpen] = React.useState<OpenState>(null);
  // The panel open now, for a request that ends after another may have opened in its place.
  const openRef = React.useRef<OpenState>(open);
  React.useEffect(() => {
    openRef.current = open;
  }, [open]);

  // Pins: open threads; resolved ones too while the Comment button's option is on, and the one
  // whose panel is open either way (just resolved, or opened from its link).
  const openThreadId = open?.kind === 'thread' ? open.threadId : null;
  const pinnedThreads = React.useMemo(
    () =>
      snapshot.threads.filter(
        (thread) =>
          showResolved ||
          thread.status === 'open' ||
          thread.id === openThreadId,
      ),
    [snapshot.threads, showResolved, openThreadId],
  );
  const anchors = React.useMemo(
    () =>
      snapshot.threads.map((thread) => ({
        id: thread.id,
        anchor: thread.anchor,
      })),
    [snapshot.threads],
  );
  const layouts = useCommentPins(anchors, true, isRtl);

  // Until a thread's comments are in, the store says where it stands (`snapshot.threadLoads`): its
  // panel shows a spinner, that it isn't available, or that it didn't load, with Try again.
  const loadThread = React.useCallback(
    (threadId: number) => void store.loadThread(threadId),
    [store],
  );
  // The pin a thread was opened from takes focus back when its panel closes (a dialog's way); a
  // thread opened from its link, or a new comment opened on the page itself, has none.
  const returnFocusRef = React.useRef<HTMLElement | null>(null);
  const openThread = React.useCallback(
    (
      threadId: number,
      point: PinPoint | null,
      pin: HTMLElement | null = null,
    ) => {
      returnFocusRef.current = pin;
      setChooser(null);
      setOpen({ kind: 'thread', threadId, point });
      loadThread(threadId);
    },
    [loadThread],
  );
  const closePanel = React.useCallback(() => {
    setOpen(null);
    const pin = returnFocusRef.current;
    returnFocusRef.current = null;
    if (pin?.isConnected) {
      pin.focus();
    }
  }, []);
  // A grouped pin's chooser (its threads, to pick one), by the pin's group, with the pin itself.
  const [chooser, setChooser] = React.useState<{
    groupKey: string;
    pin: HTMLElement;
  } | null>(null);
  const closeChooser = React.useCallback(
    (returnFocus: boolean) => {
      if (returnFocus && chooser?.pin.isConnected) {
        chooser.pin.focus();
      }
      setChooser(null);
    },
    [chooser],
  );
  // A thread, or a new comment, belongs to the page it's on: the panel closes when the page
  // changes, as the threads it could show go with it. A link to another page's thread opens it
  // there, once that page's threads are in (below).
  React.useEffect(() => {
    setOpen(null);
    setChooser(null);
    returnFocusRef.current = null;
  }, [pathname]);

  // A comment's link (`?comment=<id>`) opens that thread once the page's threads are in, and takes
  // the page to it once its element is there (rows often render after the threads load). The link's
  // parameter goes when the element shows, or after a few seconds without it.
  const linkedThreadId = Number(searchParams.get(COMMENT_THREAD_QUERY_PARAM));
  const isLinkReady = !!linkedThreadId && snapshot.status === 'ready';
  const clearLink = React.useCallback(
    () =>
      setSearchParams(
        (params) => {
          params.delete(COMMENT_THREAD_QUERY_PARAM);
          return params;
        },
        { replace: true },
      ),
    [setSearchParams],
  );
  // Open the thread once the page's threads are in; give up waiting for its element after a while.
  React.useEffect(() => {
    if (!isLinkReady) {
      return;
    }
    openThread(linkedThreadId, null);
    const giveUp = window.setTimeout(clearLink, 5000);
    return () => window.clearTimeout(giveUp);
  }, [isLinkReady, linkedThreadId, openThread, clearLink]);
  // The moment its element is on the page: scroll to it, open the thread beside it, done.
  const linkedLayout = isLinkReady ? layouts.get(linkedThreadId) : undefined;
  React.useEffect(() => {
    if (!linkedLayout?.element) {
      return;
    }
    linkedLayout.element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
    setOpen((current) =>
      current?.kind === 'thread' && current.threadId === linkedThreadId
        ? { ...current, point: linkedLayout.point }
        : current,
    );
    clearLink();
  }, [linkedLayout?.element, linkedThreadId]);
  // A link to a thread on another page (a bare `?comment=<id>`): once the thread is read, the app
  // goes to its page, keeping the link, and the thread opens there beside its pin (as above).
  // Once per link: a page that redirects elsewhere can't send it round again.
  const linkedRoutePath = isLinkReady
    ? snapshot.details.get(linkedThreadId)?.routePath
    : undefined;
  const redirectedLinkRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (!linkedThreadId) {
      redirectedLinkRef.current = null;
    }
  }, [linkedThreadId]);
  React.useEffect(() => {
    if (
      !linkedRoutePath ||
      linkedRoutePath === pathname ||
      redirectedLinkRef.current === linkedThreadId
    ) {
      return;
    }
    redirectedLinkRef.current = linkedThreadId;
    const params = new URLSearchParams();
    params.set(COMMENT_THREAD_QUERY_PARAM, String(linkedThreadId));
    navigate(
      { pathname: linkedRoutePath, search: `?${params.toString()}` },
      { replace: true },
    );
  }, [linkedRoutePath, pathname, linkedThreadId, navigate]);

  // Mentioning an agent opens the person's conversation with it in the floating chat, where they
  // watch it work: the first agent the comment mentions whose reply in the thread they asked for
  // (every reader gets each reply's conversation; the sender's is the one they can write in).
  const openMentionedAgentChat = React.useCallback(
    (thread: CommentThreadDto, body: string) => {
      if (!openAgentThread || currentUserId === null) {
        return;
      }
      for (const agentId of parseCommentMentions(body).agentIds) {
        const reply = [...thread.comments]
          .reverse()
          .find(
            (comment) =>
              comment.author.type === 'agent' &&
              comment.author.agentId === agentId &&
              comment.author.requestedByUserId === currentUserId &&
              comment.agentReply?.agentChatThreadId,
          );
        if (reply) {
          openAgentThread(agentId, reply.agentReply!.agentChatThreadId!);
          return;
        }
      }
    },
    [openAgentThread, currentUserId],
  );

  // Whether the open panel's composer holds something that would be sent: the composer says. Its
  // textarea, to put focus back in when a click outside keeps the panel.
  const hasUnsentRef = React.useRef(false);
  const [hasUnsent, setHasUnsent] = React.useState(false);
  const onUnsentChange = React.useCallback((value: boolean) => {
    hasUnsentRef.current = value;
    setHasUnsent(value);
  }, []);
  const composerInputRef = React.useRef<HTMLTextAreaElement>(null);

  // Whether any of the open panel is in the window and drawn: one that went out of the window with
  // its element, or whose element a scroll container hides, can't be seen, and takes no click and
  // no Esc (`openCommentResponse`). Measured, as only the browser knows its height: on each render
  // (the layer renders on every layout tick) for the outline, and again when a click or Esc comes.
  const panelRef = React.useRef<HTMLDivElement>(null);
  const measureOpenOnScreen = React.useCallback(() => {
    const panel = panelRef.current;
    return isOnScreen(
      panel && !panel.hasAttribute('data-hidden')
        ? toRect(panel.getBoundingClientRect())
        : null,
      { width: window.innerWidth, height: window.innerHeight },
    );
  }, []);
  const [isOpenOnScreen, setIsOpenOnScreen] = React.useState(false);
  // Taken back to a panel out of sight: its composer takes focus once the panel shows. The way
  // back is tried once (`openCommentResponse`): it has had its chance once its scroll has had time
  // to end (a timer: `scrollend` isn't in every Safari) with the panel still out of sight; then a
  // panel that can't come back (its element has no box, or scrolling can't reveal it) closes on
  // the next click or Esc instead of holding the page. Until then another click or Esc returns
  // again, so a double-click or a repeating Esc loses nothing.
  const focusOnShowRef = React.useRef(false);
  const returnRef = React.useRef<{
    timer: number | null;
    hasFailed: boolean;
  }>({ timer: null, hasFailed: false });
  const endReturn = React.useCallback(() => {
    const ret = returnRef.current;
    if (ret.timer !== null) {
      window.clearTimeout(ret.timer);
    }
    returnRef.current = { timer: null, hasFailed: false };
  }, []);
  // A return belongs to the panel it was for: none once it closes, another opens, or the layer goes.
  const openKey =
    open?.kind === 'thread' ? `t${open.threadId}` : (open?.kind ?? null);
  React.useEffect(() => endReturn, [openKey, endReturn]);
  // What a click on the page or Esc does to the open panel (`openCommentResponse`).
  const respondToOpen = (input: 'click' | 'escape') =>
    openCommentResponse({
      input,
      isOnScreen: measureOpenOnScreen(),
      hasUnsent: hasUnsentRef.current,
      hasReturnFailed: returnRef.current.hasFailed,
    });
  // The open panel's height as drawn, once its `maxHeight` doesn't cut it: the room its placement
  // wants (`panelSide`), so a short one hangs down from its pin where it fits. Kept per open panel.
  const [measuredPanel, setMeasuredPanel] = React.useState<{
    open: OpenState;
    height: number;
  } | null>(null);
  const panelHeight =
    measuredPanel?.open === open ? measuredPanel.height : undefined;
  React.useLayoutEffect(() => {
    const panel = panelRef.current;
    if (open && panel) {
      const height = panel.offsetHeight;
      const maxHeight = Number.parseFloat(panel.style.maxHeight);
      const isCut = !(height < maxHeight - 1);
      if (height > 0 && !isCut && height !== panelHeight) {
        setMeasuredPanel({ open, height });
      }
    }
    const onScreen = measureOpenOnScreen();
    setIsOpenOnScreen(onScreen);
    if (onScreen) {
      endReturn();
    }
    if (!open) {
      focusOnShowRef.current = false;
    } else if (onScreen && focusOnShowRef.current) {
      focusOnShowRef.current = false;
      composerInputRef.current?.focus({ preventScroll: true });
    }
  });
  // Something open takes the page's clicks and Esc: a chooser, or a panel in sight or holding
  // something unsent. A panel out of sight with nothing unsent leaves the page as if nothing were.
  const isEngaged =
    chooser !== null || (open !== null && (isOpenOnScreen || hasUnsent));
  // Whether something was open when the latest press on the page began: a press off text blurs
  // the chooser shut before its click reaches the picker, and that click only closed it. A press on
  // UI the picker leaves alone (the comments' own, the chat) is no pick's, so it doesn't count. A
  // key clears it: a keyboard click (Enter on a link) has no press of its own, and must not read a
  // press it didn't make (a right-click or a touch scroll that reached no pick).
  const isAnythingOpenRef = React.useRef(false);
  React.useEffect(() => {
    isAnythingOpenRef.current = isEngaged;
  }, [isEngaged]);
  const wasOpenAtPressRef = React.useRef(false);
  // The same for a panel's own menu (a comment's ⋯, the agent picker): a click on the page while
  // one is open only closes that menu, as an app's dropdown does; the panel stays.
  const wasMenuOpenAtPressRef = React.useRef(false);
  React.useEffect(() => {
    const onPress = (event: PointerEvent) => {
      const isOnPage = !(
        event.target instanceof Element &&
        event.target.closest(`[${PICK_IGNORE_ATTRIBUTE}]`)
      );
      wasOpenAtPressRef.current = isAnythingOpenRef.current && isOnPage;
      wasMenuOpenAtPressRef.current =
        isOnPage && !!document.querySelector(`[${COMMENT_MENU_ATTRIBUTE}]`);
    };
    const onKey = () => {
      wasOpenAtPressRef.current = false;
      wasMenuOpenAtPressRef.current = false;
    };
    document.addEventListener('pointerdown', onPress, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onPress, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, []);

  const openLayout: ThreadLayout | undefined =
    open?.kind === 'thread' ? layouts.get(open.threadId) : undefined;
  // Back to a panel out of sight that holds something unsent: its element comes into view (at once
  // under reduced motion), and focus goes back in its composer, the caret where it was — now, or
  // once the panel shows (a scroll container hid it).
  const openElement = openLayout?.element;
  const bringBack = () => {
    const element = openElement;
    if (element?.isConnected) {
      element.scrollIntoView({
        block: 'center',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      });
    }
    const input = composerInputRef.current;
    input?.focus({ preventScroll: true });
    focusOnShowRef.current = !input || document.activeElement !== input;
    endReturn();
    const ret = { timer: null as number | null, hasFailed: false };
    ret.timer = window.setTimeout(() => {
      ret.timer = null;
      ret.hasFailed = true;
    }, RETURN_CHANCE_MS);
    returnRef.current = ret;
  };

  // A click (or a text drag) on the page while a thread, a new comment or a chooser is open only
  // closes it, as Esc does, and a panel holding unsent text stays, focus back in its composer (the
  // caret where it was), so a stray click loses nothing and typing goes on. A panel out of sight
  // takes the click only to bring the person back to what they were writing; with nothing unsent
  // it closes, and the click starts a comment as if nothing were open. Otherwise a new comment opens
  // on what was picked: its pin on the element's top-end corner (or the selected text's), its
  // panel kept clear of it, as a thread's are (`pickPlacement`).
  const onPick = ({ anchor, element }: PagePick) => {
    // Read once: a keyboard click on the page that follows has no press of its own.
    const wasOpenAtPress = wasOpenAtPressRef.current;
    wasOpenAtPressRef.current = false;
    const wasMenuOpenAtPress = wasMenuOpenAtPressRef.current;
    wasMenuOpenAtPressRef.current = false;
    if (wasMenuOpenAtPress) {
      // A press off text blurred it shut already; over text it kept focus: blur it now.
      const menu = document.querySelector(`[${COMMENT_MENU_ATTRIBUTE}]`);
      if (
        menu?.contains(document.activeElement) &&
        document.activeElement instanceof HTMLElement
      ) {
        document.activeElement.blur();
      }
      if (open && hasUnsentRef.current) {
        // Back to typing, as a click outside does: the caret where it was.
        composerInputRef.current?.focus();
      }
      return;
    }
    if (chooser) {
      // Focus stays where the pointer put it, as when a press blurs the chooser shut.
      closeChooser(false);
      return;
    }
    if (open) {
      const response = respondToOpen('click');
      if (response === 'refocus') {
        // The press may have focused what it landed on (a link, a button); over text it didn't.
        composerInputRef.current?.focus();
        return;
      }
      if (response === 'close') {
        closePanel();
        return;
      }
      if (response === 'return') {
        bringBack();
        return;
      }
      // 'pass': the new comment takes the panel's place.
    } else if (wasOpenAtPress) {
      return;
    }
    const { point, target } = pickPlacement(anchor, element, isRtl);
    returnFocusRef.current = null;
    setOpen({ kind: 'draft', anchor, element, point, target });
  };

  // Esc on the open panel, wherever it is heard (the page, the layer, the panel itself): it closes
  // the panel in sight; out of sight, it brings the person back to what they were writing, else it
  // ends comment mode, as if nothing were open (the panel closes with it).
  const escapeOpen = () => {
    const response = respondToOpen('escape');
    if (response === 'return') {
      bringBack();
    } else if (response === 'pass') {
      onExit();
    } else {
      closePanel();
    }
  };
  // Esc: an open chooser or panel closes first, then comment mode ends. The picker hears it on the page; the
  // layer hears it on its own controls (a pin, the panel), which the picker leaves alone.
  const cancel = () => {
    if (chooser) {
      closeChooser(true);
    } else if (open) {
      escapeOpen();
    } else {
      onExit();
    }
  };
  const hover = usePagePick({
    isActive: true,
    routePath: pathname,
    onPick,
    onCancel: cancel,
  });

  const openDetail =
    open?.kind === 'thread'
      ? (snapshot.details.get(open.threadId) ?? null)
      : null;
  // Its element isn't on the page (its row filtered out or on another page of a list, a closed
  // dialog, deleted by a change to the app), and has stayed so: the thread says so. Keyed by a
  // boolean, not the layout, which is new on every layout tick.
  const isOpenMissing = useHeld(
    open?.kind === 'thread' &&
      openLayout?.state === 'missing' &&
      snapshot.status === 'ready',
    MISSING_AFTER_MS,
    open?.kind === 'thread' ? open.threadId : null,
  );
  const openThreadSummary = snapshot.threads.find(
    (thread) => open?.kind === 'thread' && thread.id === open.threadId,
  );
  // The open thread keeps its pin while its element shows none, drawn as its group was in view
  // (every pinned thread on the element, at the first one's point, so nothing jumps as the element
  // crosses the window's edge): going out of the window with the element (moved by `shift`), on it
  // under other UI, or, when the element isn't on the page, where the thread was opened, else (from
  // its link) beside the window's corner where its panel then opens. None while a scroll container
  // hides the element: nothing floats over what is there instead, and its panel isn't drawn either
  // (`isPanelHidden`). A platform that doesn't say why (`hidden`) draws none for an element that is
  // there.
  const openAway: {
    key: string;
    /** Its element: the group is every thread on it; none when the element isn't on the page. */
    element: HTMLElement | null;
    /** Where its pin goes when the element isn't on the page. */
    point: PinPoint | null;
    shift: PinPoint;
    /** Nothing on the page to stand by: its pin and panel are at the window's corner. */
    isCorner?: boolean;
  } | null = (() => {
    if (open?.kind !== 'thread' || !openLayout || openLayout.point) {
      return null;
    }
    const key = `open-${open.threadId}`;
    const hidden = openLayout.hidden;
    if (hidden) {
      return hidden.by === 'clipped'
        ? null
        : {
            key,
            element: openLayout.element,
            point: null,
            shift: hidden.shift,
          };
    }
    if (openLayout.element) {
      return null;
    }
    if (open.point) {
      return { key, element: null, point: open.point, shift: NO_SHIFT };
    }
    if (isPhone || !openThreadSummary) {
      return null;
    }
    const { shown, moreCount } = pinParticipants(
      [openThreadSummary],
      openThreadSummary.workingAgentId ?? null,
    );
    return {
      key,
      element: null,
      point: cornerPoint(
        viewport,
        facesPinWidth(shown.length, moreCount),
        PANEL_WIDTH,
      ),
      shift: NO_SHIFT,
      isCorner: true,
    };
  })();
  const isPanelHidden =
    !isPhone && open?.kind === 'thread' && openLayout?.hidden?.by === 'clipped';
  const pins = groupPins(
    pinnedThreads.flatMap((thread) => {
      const layout = layouts.get(thread.id);
      const isOpenThread = thread.id === openThreadId;
      // An outdated thread (its text changed) is pinned only with the option on, like a resolved
      // one, or while it is open.
      if (
        !layout ||
        (layout.state === 'outdated' && !showResolved && !isOpenThread)
      ) {
        return [];
      }
      if (layout.point && layout.groupKey) {
        return [
          {
            key: layout.groupKey,
            point: layout.point,
            item: { thread, layout },
          },
        ];
      }
      const awayPoint = !openAway
        ? null
        : openAway.element
          ? layout.element === openAway.element
            ? (layout.hidden?.point ?? null)
            : null
          : isOpenThread
            ? openAway.point
            : null;
      return awayPoint && openAway
        ? [
            {
              key: openAway.key,
              point: awayPoint,
              item: { thread, layout },
            },
          ]
        : [];
    }),
  );
  const personById = new Map(
    snapshot.mentionableUsers.map((person) => [person.userId, person]),
  );
  const agentById = new Map(agents.map((agent) => [agent.id, agent]));
  // The open thread's group, gone out of the window with its element, moves on with it.
  const shiftOf = (groupKey: string) =>
    groupKey === openAway?.key ? openAway.shift : undefined;
  // Each pin as it is drawn: who is on it, and whether its thread is the open one.
  const pinViews = pins.map((group) => {
    const working = group.items.find((item) => item.thread.workingAgentId);
    const workingAgentId = working?.thread.workingAgentId ?? null;
    const { shown, moreCount } = pinParticipants(
      group.items.map((item) => item.thread),
      workingAgentId,
    );
    const faces: PinFace[] = shown.map((participant) => {
      if (participant.type === 'agent') {
        const agent = agentById.get(participant.agentId);
        return {
          key: participantKey(participant),
          name: agent?.name ?? participant.agentId,
          photoUrl: agent?.photoUrl,
          isWorking: participant.agentId === workingAgentId,
        };
      }
      const person = personById.get(participant.userId);
      return {
        key: participantKey(participant),
        name: person?.name ?? 'Someone',
        photoUrl: person?.profileImageUrl,
        isWorking: false,
      };
    });
    const isActive =
      open?.kind === 'thread' &&
      group.items.some((item) => item.thread.id === open.threadId);
    return {
      group,
      isWorking: !!working,
      faces,
      moreCount,
      isActive,
      width: facesPinWidth(faces.length, moreCount),
    };
  });
  // The panel goes by the open thread's pin (a grouped thread's too, and moving with it when it
  // goes out of the window), else by where its element is, else where it was opened; a new
  // comment's by its point. Past the pin's end side, else below or above what the comment is on,
  // else over it (`panelSide`).
  const openPin = pinViews.find((view) => view.isActive);
  // A new comment on an element that has a pin takes its corner: one pin there, the writer's face,
  // until it is sent (it joins the group and its count) or closed (the pin comes back).
  const drawnPinViews =
    open?.kind === 'draft'
      ? pinViews.filter(
          (view) =>
            !view.group.items.some(
              (item) => item.layout.element === open.element,
            ),
        )
      : pinViews;
  const panelPoint =
    open?.kind === 'draft'
      ? open.point
      : (openPin?.group.point ??
        openLayout?.point ??
        (open?.kind === 'thread' ? open.point : null));
  // What the panel keeps clear of: what its comment is on (the open thread's own, also when its
  // pin is a group's at another thread's point), as it was picked for a new comment.
  const panelTarget = open?.kind === 'draft' ? open.target : openLayout?.target;
  // A new comment's pin: the writer's own face at its point, like a real pin but only a mark (no
  // focus, no click, hidden from assistive tech: the panel is what to reach).
  const me = currentUserId !== null ? personById.get(currentUserId) : undefined;
  const panelPinWidth = openPin?.width ?? PIN_SIZE;
  // The sides of its pin the open panel takes, kept while they have room (`panelSide`): a panel
  // moving with its page doesn't jump as its pin crosses the window's middle. Remembered per open
  // panel, and only when they change.
  const [keptPanelSide, setKeptPanelSide] = React.useState<{
    open: OpenState;
    side: PanelSide;
  } | null>(null);
  const openPanelSide =
    open && panelPoint && !isPhone
      ? panelSide(
          panelPoint,
          panelPinWidth,
          PANEL_WIDTH,
          keptPanelSide?.open === open ? keptPanelSide.side : undefined,
          viewport,
          panelTarget,
          panelHeight,
        )
      : undefined;
  React.useLayoutEffect(() => {
    if (
      openPanelSide &&
      (keptPanelSide?.open !== open ||
        keptPanelSide.side.block !== openPanelSide.block ||
        keptPanelSide.side.place !== openPanelSide.place ||
        keptPanelSide.side.isMeasured !== openPanelSide.isMeasured)
    ) {
      setKeptPanelSide({ open, side: openPanelSide });
    }
  });

  // Where the panel is (its `data-placement`): `sheet` on a phone; `corner` with nothing on the page
  // to stand by; `beside` past its pin's end side hanging down from the pin's top, `beside-up`
  // there hanging up from its bottom; `below` or `above` what the comment is on; `over` (`over-up`)
  // before the pin's start, over it, the last resort.
  const panelPlacement = isPhone
    ? 'sheet'
    : !openPanelSide || openAway?.isCorner
      ? 'corner'
      : openPanelSide.place === 'below' || openPanelSide.place === 'above'
        ? openPanelSide.place
        : `${openPanelSide.place === 'end' ? 'beside' : 'over'}${openPanelSide.block === 'up' ? '-up' : ''}`;

  const knownAnchor =
    open?.kind === 'draft'
      ? open.anchor
      : (openThreadSummary?.anchor ?? openDetail?.anchor);
  const openAnchor: CommentAnchor = knownAnchor ?? {
    v: 1,
    routePath: pathname,
  };
  // What the top line says: the words (the picked ones, else the element's text, however long),
  // else what the element is, else its page.
  const openSubject = anchorSubject(openAnchor);
  // The panel's description: the top line.
  const subjectId = React.useId();

  // The open chooser's pin and its rows; none once its pin is gone (its threads moved apart).
  const chooserPin = chooser
    ? pinViews.find((view) => view.group.key === chooser.groupKey)
    : undefined;
  const chooserView =
    chooserPin && chooserPin.group.items.length > 1
      ? {
          group: chooserPin.group,
          pinWidth: chooserPin.width,
          rows: chooserPin.group.items.map(({ thread }): PinChooserRow => {
            const starter = personById.get(thread.createdByUserId);
            const firstComment = snapshot.details.get(thread.id)?.comments[0];
            return {
              thread,
              starterName: starter?.name ?? 'Someone',
              starterPhotoUrl: starter?.profileImageUrl,
              text: firstComment
                ? plainCommentText(firstComment.body, names)
                : snapshot.threadLoads.get(thread.id) === 'loading'
                  ? null
                  : '',
            };
          }),
        }
      : null;
  // Once its group no longer has several threads (one resolved or deleted, or they moved apart),
  // the chooser is closed, not just hidden: it doesn't come back unasked if the group grows again.
  const hasChooserView = chooserView !== null;
  React.useEffect(() => {
    if (chooser && !hasChooserView) {
      setChooser(null);
    }
  }, [chooser, hasChooserView]);

  // The panel is a non-modal dialog: the page stays usable beside it.
  const panelLabel = open?.kind === 'draft' ? 'New comment' : 'Comment thread';
  const panel = open ? (
    <CommentThreadView
      // A new thread or draft starts with an empty composer: half-typed text stays with its thread.
      key={openKey ?? undefined}
      thread={open.kind === 'thread' ? openDetail : null}
      loadState={
        open.kind === 'thread'
          ? snapshot.threadLoads.get(open.threadId)
          : undefined
      }
      onRetryLoad={
        open.kind === 'thread' ? () => loadThread(open.threadId) : undefined
      }
      isDraft={open.kind === 'draft'}
      quote={openSubject.kind === 'text' ? openSubject.text : undefined}
      element={
        openSubject.kind === 'component'
          ? openSubject.name
          : openSubject.kind === 'element'
            ? ELEMENT_KIND_LABELS[openSubject.element]
            : undefined
      }
      subjectId={subjectId}
      // Unknown until the thread is in (a link to one that isn't available names no page).
      page={knownAnchor ? pageLabel(knownAnchor.routePath) : undefined}
      currentText={
        openLayout?.state === 'outdated' ? openLayout.currentText : undefined
      }
      isMissing={isOpenMissing}
      currentUserId={currentUserId}
      people={snapshot.mentionableUsers}
      agents={agents}
      mentionAgents={mentionAgents}
      names={names}
      onClose={escapeOpen}
      onUnsentChange={onUnsentChange}
      composerInputRef={composerInputRef}
      onSubmit={async (body) => {
        const thread =
          open.kind === 'draft'
            ? await store.createThread(open.anchor, body)
            : await store.addComment(open.threadId, body);
        // Closed or replaced while it was sending: it stays closed.
        if (open.kind === 'draft' && openRef.current === open) {
          setOpen({ kind: 'thread', threadId: thread.id, point: open.point });
        }
        openMentionedAgentChat(thread, body);
      }}
      onResolve={
        open.kind === 'thread'
          ? (resolved) => store.setResolved(open.threadId, resolved)
          : undefined
      }
      onDelete={async (commentId) => {
        // The thread's last comment: the thread is deleted with it, and its panel closes (focus
        // back on its pin while one is left there, a grouped pin's) — if it's still the one open.
        const deletedFrom = open.kind === 'thread' ? open.threadId : null;
        if ((await store.deleteComment(commentId)) === null) {
          const current = openRef.current;
          if (current?.kind === 'thread' && current.threadId === deletedFrom) {
            closePanel();
          }
        }
      }}
      onViewInChat={openAgentThread ?? undefined}
    />
  ) : null;

  return createPortal(
    <div
      {...props}
      {...pagePickIgnoreProps}
      // The comments' own layer: what it draws over an element doesn't hide that element's pin.
      {...{ [COMMENTS_LAYER_ATTRIBUTE]: '' }}
      data-slot="comments"
      className={cn(
        'pointer-events-none fixed inset-0 z-[2147483000]',
        className,
      )}
      // The thread handles an Esc from inside it first.
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !event.defaultPrevented) {
          event.preventDefault();
          cancel();
        }
      }}
    >
      {drawnPinViews.map(({ group, isWorking, faces, moreCount, isActive }) => {
        const first = group.items[0]!;
        const author = personById.get(first.thread.createdByUserId);
        const isGrouped = group.items.length > 1;
        return (
          <Pin
            key={group.key}
            point={group.point}
            count={group.items.length}
            faces={faces}
            moreCount={moreCount}
            isOutdated={group.items.every(
              (item) => item.layout.state === 'outdated',
            )}
            isResolved={group.items.every(
              (item) => item.thread.status === 'resolved',
            )}
            isActive={isActive || chooser?.groupKey === group.key}
            hasPopup={isGrouped ? 'menu' : 'dialog'}
            isRtl={isRtl}
            viewportWidth={viewport.width}
            shift={shiftOf(group.key)}
            label={`Comment by ${author?.name ?? 'someone'}${isGrouped ? `, and ${group.items.length - 1} more` : ''}${isWorking ? ', an agent is working on it' : ''}`}
            onClick={(event) => {
              // The open thread's own pin, drawn while its element is away or covered: never a way
              // to lose it (its chooser would close it, then go with the pin). It takes the person
              // back to the panel when that is out of sight, else does nothing.
              if (group.key === openAway?.key) {
                if (!measureOpenOnScreen()) {
                  bringBack();
                }
                return;
              }
              // The pin of the thread that is open, in view, while it holds something unsent: the
              // panel stays, focus back in its composer, as a click outside does (its chooser or a
              // fresh open would lose the text). Nothing unsent: the click goes on as on any pin.
              if (isActive && hasUnsentRef.current) {
                composerInputRef.current?.focus();
                return;
              }
              if (!isGrouped) {
                openThread(first.thread.id, group.point, event.currentTarget);
                return;
              }
              if (chooser?.groupKey === group.key) {
                setChooser(null);
                return;
              }
              // Its rows show each thread's first comment: read the threads not read yet.
              for (const item of group.items) {
                if (!snapshot.details.has(item.thread.id)) {
                  loadThread(item.thread.id);
                }
              }
              setOpen(null);
              returnFocusRef.current = null;
              setChooser({ groupKey: group.key, pin: event.currentTarget });
            }}
          />
        );
      })}

      {open?.kind === 'draft' ? (
        <Pin
          point={open.point}
          count={1}
          faces={[
            {
              key: 'me',
              name: me?.name ?? user?.name ?? 'You',
              photoUrl: me?.profileImageUrl ?? user?.profileImageUrl,
              isWorking: false,
            },
          ]}
          moreCount={0}
          isOutdated={false}
          isResolved={false}
          isActive
          isRtl={isRtl}
          viewportWidth={viewport.width}
          label="New comment"
          aria-hidden
          tabIndex={-1}
          disabled
          data-draft=""
          className="cursor-default"
          onClick={() => {}}
        />
      ) : null}

      {chooserView ? (
        <PinChooser
          key={chooserView.group.key}
          pin={chooser!.pin}
          rows={chooserView.rows}
          label={`${chooserView.rows.length} comment threads here`}
          style={
            isPhone
              ? {
                  insetInline: 16,
                  bottom: 16,
                  maxHeight: '60vh',
                }
              : panelPosition(
                  chooserView.group.point,
                  chooserView.pinWidth,
                  CHOOSER_WIDTH,
                  { viewport },
                )
          }
          onClose={closeChooser}
          onPick={(threadId) => {
            const pin = chooser?.pin ?? null;
            setChooser(null);
            openThread(threadId, chooserView.group.point, pin);
          }}
        />
      ) : null}

      {panel ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={panelLabel}
          aria-describedby={subjectId}
          data-slot="comment-thread-panel"
          data-placement={panelPlacement}
          // Not drawn while a scroll container hides its element, but kept, typed text and all.
          data-hidden={isPanelHidden ? '' : undefined}
          className={commentThreadPanelVariants({
            placement: isPhone ? 'sheet' : 'beside',
          })}
          style={
            isPhone
              ? undefined
              : panelPoint
                ? panelPosition(panelPoint, panelPinWidth, PANEL_WIDTH, {
                    viewport,
                    shift: openPin && shiftOf(openPin.group.key),
                    side: openPanelSide,
                    target: panelTarget,
                    panelHeight,
                  })
                : {
                    insetInlineEnd: 16,
                    bottom: 16,
                    width: PANEL_WIDTH,
                    maxHeight: 'calc(100vh - 32px)',
                  }
          }
        >
          {panel}
        </div>
      ) : null}

      <PagePickOutline hover={isEngaged ? null : hover} />
    </div>,
    document.body,
  );
}

export type {
  PinChooserRow as CommentPinChooserRow,
  PinFace as CommentPinFace,
};
export { Pin as CommentPin, PinChooser as CommentPinChooser, CommentsLayer };

// @blocks-registry comments@1.1.0 — registry version, never edit this line