import Link from 'next/link';
import { logger } from '@/lib/logger';

const blogLogger = logger.child('blog');

/**
 * Log a failed blog query without leaking connection details.
 *
 * Prisma error messages can embed the DB host and username (e.g.
 * "Authentication failed against database server ..., the provided database
 * credentials for `<user>` are not valid"), so only the error class and the
 * Prisma error code are logged, never `error.message`.
 */
export function logBlogQueryFailure(context: string, error: unknown) {
  const name = error instanceof Error ? error.name : typeof error;
  const fields = error && typeof error === 'object' ? (error as { errorCode?: string; code?: string }) : {};
  blogLogger.error(`${context} failed`, { name, code: fields.errorCode ?? fields.code });
}

/**
 * Degraded state for when posts could not be loaded. Deliberately distinct
 * from the "No posts yet" empty state: a failed query is not an empty blog.
 */
export function BlogUnavailable({ retryHref }: { retryHref: string }) {
  return (
    <div
      role="status"
      className="mx-auto max-w-xl rounded-lg border border-border bg-card px-6 py-10 text-center"
    >
      <h2 className="mb-2 text-xl font-semibold text-foreground">
        Posts are temporarily unavailable
      </h2>
      <p className="mb-6 text-base text-foreground/80">
        We couldn&apos;t load the blog right now. Please try again shortly.
      </p>
      <Link
        href={retryHref}
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Try again
      </Link>
    </div>
  );
}
