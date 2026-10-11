import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import appCss from "../styles.css?url";
import { Splash, WelcomeModal } from "../components/SiteIntro";
import { SPLASH_GUARD_SCRIPT } from "../lib/splash";

const button =
  "tap inline-flex h-11 items-center justify-center rounded-md px-5 text-sm font-semibold";

/* ==========================================================================
   404
   ========================================================================== */

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <img
          src="/logo-mark-96.png"
          alt=""
          width={72}
          height={72}
          className="mx-auto h-[72px] w-[72px]"
        />
        <h1 className="mt-5 font-display text-5xl font-bold text-foreground">404</h1>
        <h2 className="mt-3 font-display text-lg font-semibold uppercase tracking-[0.08em] text-foreground">
          Page not found
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This page doesn't exist or has moved. The map and the Theyyam calendar are one click away.
        </p>
        <div className="mt-6">
          <Link to="/" className={`${button} bg-primary text-primary-foreground hover:opacity-90`}>
            Back to the map
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   ERROR
   ========================================================================== */

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-xl font-semibold uppercase tracking-[0.08em] text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our side. Try again, or go back to the map.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className={`${button} bg-primary text-primary-foreground hover:opacity-90`}
          >
            Try again
          </button>
          <a
            href="/"
            className={`${button} border border-gold-line text-foreground hover:bg-accent`}
          >
            Back to the map
          </a>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   ROOT ROUTE
   ========================================================================== */

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Theyyams of Kerala" },
      {
        name: "description",
        content: "A live map of Theyyam performances in kavus and temples across Kerala.",
      },
      { name: "theme-color", content: "#171310" },
      { property: "og:site_name", content: "Theyyams of Kerala" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", href: "/favicon-64.png", type: "image/png", sizes: "64x64" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
    scripts: [{ children: SPLASH_GUARD_SCRIPT }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

/* ==========================================================================
   HTML SHELL
   ========================================================================== */

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" style={{ colorScheme: "dark" }} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/* ==========================================================================
   ROOT COMPONENT
   ========================================================================== */

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Splash />
      <Outlet />
      <WelcomeModal />
    </QueryClientProvider>
  );
}
