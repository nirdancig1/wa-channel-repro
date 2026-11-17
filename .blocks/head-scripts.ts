// What a framework build's pages set before any module runs, written into each page's HTML by the
// server entry. No imports: the compiler's tests load it without the boilerplate's install.

declare const __BLOCKS_IMPORT_MAP__: { imports: Record<string, string> } | null;
declare const __ENV__: string;

/**
 * What the page sets before any module runs, at the top of the <head>, right after the charset
 * (which browsers look for in the page's first 1,024 bytes):
 * - `window.ENV`, as app-render's page sets it: the SDK picks the platform's host from it when its
 *   module loads, and without it calls the development host.
 * - The platform runtime's import map: browsers ignore one that arrives after a module starts
 *   loading, and React writes the page's module preloads at the top of the <head>.
 */
export const withHeadScripts = (html: string): string => {
  const env = `<script>window.ENV={NODE_ENV:${JSON.stringify(__ENV__)}};</script>`;
  const importMap = __BLOCKS_IMPORT_MAP__
    ? `<script type="importmap">${JSON.stringify(__BLOCKS_IMPORT_MAP__).replace(/</g, '\\u003c')}</script>`
    : '';
  const scripts = `${env}${importMap}`;
  const charset = html.match(/<meta charSet="utf-8"\/?>/i)?.[0];
  return charset
    ? html.replace(charset, `${charset}${scripts}`)
    : html.replace('<head>', `<head>${scripts}`);
};
