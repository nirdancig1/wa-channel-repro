// The server entry of a framework build (bundle contract 3). There is no server at runtime: this
// renders the pages the build writes to HTML (a public app's prerendered pages, and the fallback
// document every other path serves), whole, as a signed-out visitor sees them before their data.
import { PassThrough } from 'node:stream';
import { renderToPipeableStream } from 'react-dom/server';
import { type EntryContext, ServerRouter } from 'react-router';
import { withHeadScripts } from './head-scripts';

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
) {
  return new Promise<Response>((resolve, reject) => {
    let statusCode = responseStatusCode;
    const { pipe } = renderToPipeableStream(
      <ServerRouter context={routerContext} url={request.url} />,
      {
        // The whole page, not its shell: the HTML is the page as written to the build.
        onAllReady() {
          const body = new PassThrough();
          const chunks: Buffer[] = [];
          body.on('data', (chunk: Buffer) => chunks.push(chunk));
          body.on('error', reject);
          body.on('end', () => {
            responseHeaders.set('Content-Type', 'text/html');
            resolve(
              new Response(withHeadScripts(Buffer.concat(chunks).toString('utf8')), {
                headers: responseHeaders,
                status: statusCode,
              }),
            );
          });
          pipe(body);
        },
        onShellError: reject,
        onError(error: unknown) {
          statusCode = 500;
          console.error(`[blocks] Could not render ${new URL(request.url).pathname}:`, error);
        },
      },
    );
  });
}
