import type { ReactNode } from "react";

/** Title band used at the top of the inner pages (Today, Forms, Temples, Calendar). */
export function PageHeading({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <section className="border-b border-border bg-card">
      <div className="mx-auto flex w-full max-w-[1800px] flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-10 lg:py-7">
        <div className="flex min-w-0 items-center gap-4">
          <img
            src="/logo-mark-96.png"
            alt=""
            width={56}
            height={56}
            className="hidden h-12 w-12 shrink-0 object-contain sm:block lg:h-14 lg:w-14"
          />
          <div className="min-w-0">
            <h1 className="ke-title text-[22px] leading-tight text-primary sm:text-[28px] lg:text-[32px]">
              {title}
            </h1>
            <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-muted-foreground sm:text-[14px]">
              {subtitle}
            </p>
          </div>
        </div>
        {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
      </div>
    </section>
  );
}

export const selectClass =
  "h-10 rounded-md border border-border bg-raised px-3 text-sm font-semibold text-foreground focus-visible:border-gold";
