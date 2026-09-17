import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import stylesheet from "./app.css?url";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@400;500;700&display=swap",
  },
  { rel: "stylesheet", href: stylesheet },
];

const apiVersionHeader: Route.MiddlewareFunction = async (_args, next) => {
  const response = await next();
  response.headers.set("X-No-Advice-Needed-API", "v1");
  return response;
};

export const middleware: Route.MiddlewareFunction[] = [apiVersionHeader];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-CA">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="min-h-dvh bg-canvas text-ink antialiased">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Something went wrong";
  let details = "Try again in a moment.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "Page not found" : `Error ${error.status}`;
    details =
      error.status === 404 ? "There is nothing at this address." : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="mx-auto max-w-3xl p-8 pt-16">
      <h1 className="text-2xl">{message}</h1>
      <p className="mt-2 text-ink-muted">{details}</p>
      {stack && (
        <pre className="mt-6 w-full overflow-x-auto rounded-card border border-line bg-surface p-4 text-sm">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
