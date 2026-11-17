import type { PagePickHover } from '@blocksdiy/react-common/comments';
import * as React from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/utils';

/*
 * Pointing at something on the page: the outline and label over the element under the pointer,
 * while comment mode (or the agent chat's pointer) is picking — and over text, the word under the
 * pointer tinted with a caret bar in it, or the text a drag covers. The picking itself is
 * `usePagePick` from @blocksdiy/react-common/comments; this only draws its hover, in the app's own
 * theme. Spread `pagePickIgnoreProps` on the root of any UI the picker must leave alone.
 * `alignInline` places UI over the page on a page that may read right to left.
 */

/** While the pointer is on text, the page shows a text cursor, even over links and buttons. */
const TEXT_CURSOR_ATTRIBUTE = 'data-blocks-picking-text';
const TEXT_CURSOR_STYLE = `html[${TEXT_CURSOR_ATTRIBUTE}], html[${TEXT_CURSOR_ATTRIBUTE}] * { cursor: text !important; }`;

const TEXT_CURSOR_STYLE_ID = 'blocks-picking-text-cursor';

const useTextCursor = (isOn: boolean) => {
  React.useEffect(() => {
    if (!isOn || typeof document === 'undefined') {
      return;
    }
    // One stylesheet for the app's life; the attribute turns it on and off.
    if (!document.getElementById(TEXT_CURSOR_STYLE_ID)) {
      const style = document.createElement('style');
      style.id = TEXT_CURSOR_STYLE_ID;
      style.textContent = TEXT_CURSOR_STYLE;
      document.head.appendChild(style);
    }
    document.documentElement.setAttribute(TEXT_CURSOR_ATTRIBUTE, '');
    return () =>
      document.documentElement.removeAttribute(TEXT_CURSOR_ATTRIBUTE);
  }, [isOn]);
};

/**
 * Marks UI the picker never picks and never blocks (the comments' own, the agent chat). The same
 * attribute react-common's picker reads (`PICK_IGNORE_ATTRIBUTE`), written out here so the agent
 * chat can carry it on an app-render from before comments, where react-common has no comments
 * entry yet.
 */
export const pagePickIgnoreProps = { 'data-blocks-pick-ignore': '' } as const;

/**
 * A box's place across the window, its start or end edge level with the same edge of `rect` (a
 * point is a rect with no width): `left` or `right` from the window's own edges, as the page reads,
 * so it holds right to left. For UI drawn over the page, which positions in window coordinates.
 * `isRtl` and `viewportWidth` (`document.documentElement.clientWidth`) are read where the box
 * renders, never inside a helper the React Compiler would cache: a page can change its direction
 * (its language) and its width while it runs.
 */
export const alignInline = (
  edge: 'start' | 'end',
  rect: { left: number; right: number },
  { isRtl, viewportWidth }: { isRtl: boolean; viewportWidth: number },
): React.CSSProperties =>
  (edge === 'start') !== isRtl
    ? { left: rect.left }
    : { right: viewportWidth - rect.right };

export interface PagePickOutlineProps extends Omit<
  React.ComponentProps<'div'>,
  'children' | 'className'
> {
  /** What is under the pointer (`usePagePick`'s); nothing drawn when null. */
  hover: PagePickHover | null;
  /** Merged last onto the overlay's root. */
  className?: string;
}

/** The label's height and its gap to the element, and how far it keeps from the window's edges. */
const LABEL_ROOM_PX = 24;
const LABEL_EDGE_PX = 4;

/** The outline around the hovered element, with its name, drawn over the page. */
export function PagePickOutline({
  hover,
  className,
  ...props
}: PagePickOutlineProps) {
  // Reads the window (its width, its direction) while rendering: the React Compiler would cache the
  // position on the props alone and keep a stale one after a resize.
  'use no memo';
  // Over text only: the words to tint and the caret.
  const text = hover?.text;
  useTextCursor(!!text);
  if (!hover || typeof document === 'undefined') {
    return null;
  }
  const { rect, label } = hover;
  const width = rect.right - rect.left;
  const height = rect.bottom - rect.top;
  // The name sits above the element's start corner (its left, or its right on a right-to-left
  // page); below the element when there is no room above, and inside its top when it fills the
  // window. It never leaves the window: it starts inside the window's edge, and when it would run
  // past the far edge it slides back by what it overflows (a translate by its own width).
  const viewportWidth = document.documentElement.clientWidth;
  const isRtl = getComputedStyle(document.documentElement).direction === 'rtl';
  const labelTop =
    rect.top > LABEL_ROOM_PX + LABEL_EDGE_PX
      ? rect.top - LABEL_ROOM_PX
      : rect.bottom + LABEL_ROOM_PX + LABEL_EDGE_PX < window.innerHeight
        ? rect.bottom + LABEL_EDGE_PX
        : Math.max(rect.top, 0) + LABEL_EDGE_PX;
  const labelStart = Math.max(
    LABEL_EDGE_PX,
    isRtl ? viewportWidth - rect.right : rect.left,
  );
  const labelRoom = viewportWidth - LABEL_EDGE_PX - labelStart;
  return createPortal(
    <div
      {...props}
      {...pagePickIgnoreProps}
      aria-hidden
      data-slot="page-pick-outline"
      className={cn(
        'pointer-events-none fixed inset-0 z-[2147483000]',
        className,
      )}
    >
      <div
        data-slot="page-pick-box"
        className={cn(
          'absolute rounded-md border-2 border-primary',
          text?.isSelecting && 'border-primary/40',
        )}
        style={{ top: rect.top, left: rect.left, width, height }}
      />
      {text?.rects.map((line, index) => (
        <div
          key={index}
          data-slot="page-pick-text"
          className={cn(
            'absolute rounded-sm',
            text.isSelecting ? 'bg-primary/25' : 'bg-primary/10',
          )}
          style={{
            top: line.top,
            left: line.left,
            width: line.right - line.left,
            height: line.bottom - line.top,
          }}
        />
      ))}
      {text?.caret ? (
        <div
          data-slot="page-pick-caret"
          className="absolute w-0.5 rounded-full bg-primary"
          style={{
            top: text.caret.top,
            left: text.caret.x - 1,
            height: text.caret.bottom - text.caret.top,
          }}
        />
      ) : null}
      <div
        data-slot="page-pick-label"
        // The label's text runs its own way (an English name on a right-to-left page), so it clips
        // at its end.
        dir="auto"
        className="absolute truncate rounded-md bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground shadow-sm"
        style={{
          ...alignInline(
            'start',
            {
              left: Math.max(LABEL_EDGE_PX, rect.left),
              right: Math.min(viewportWidth - LABEL_EDGE_PX, rect.right),
            },
            { isRtl, viewportWidth },
          ),
          top: labelTop,
          maxWidth: `min(15rem, ${viewportWidth - 2 * LABEL_EDGE_PX}px)`,
          translate: isRtl
            ? `max(0px, calc(100% - ${labelRoom}px))`
            : `min(0px, calc(${labelRoom}px - 100%))`,
        }}
      >
        {label}
      </div>
    </div>,
    document.body,
  );
}

// @blocks-registry comments@1.1.0 — registry version, never edit this line