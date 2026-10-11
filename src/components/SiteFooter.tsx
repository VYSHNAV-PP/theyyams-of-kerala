import { Link } from "@tanstack/react-router";
import { COFFEE_URL } from "./SiteIntro";

export function SiteFooter() {
  return (
    <footer className="mt-auto shrink-0 border-t border-gold-line bg-card">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-3 px-4 py-5 text-xs text-muted-foreground sm:px-6 md:flex-row md:items-center md:justify-between lg:px-10">
        <div className="max-w-2xl space-y-1">
          <p className="font-semibold text-foreground">© 2026 Theyyams of Kerala</p>
          <p>
            Theyyam is a living ritual. Please be respectful at the kavu, ask before you photograph,
            and follow the temple committee's guidance. Map data © OpenStreetMap contributors.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
          <Link to="/submit" className="text-gold hover:underline">
            Post a Theyyam
          </Link>
          <a
            href={COFFEE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold hover:underline"
          >
            Support the project
          </a>
        </nav>
      </div>
    </footer>
  );
}
