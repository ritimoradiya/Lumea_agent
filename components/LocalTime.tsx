"use client";

/**
 * A timestamp in the reader's timezone.
 *
 * Formatting dates in a server component looked right and was wrong: the
 * server runs in UTC, so toLocaleString() there produces UTC rendered as
 * though it were local. Leads sent at 1:55pm were listed as 5:55pm.
 *
 * This has to be a client component - only the browser knows the timezone.
 * suppressHydrationWarning is required and correct here: the server and the
 * client are meant to disagree, because they are in different places.
 */
export default function LocalTime({
  iso,
  timeOnly = false,
}: {
  iso: string;
  timeOnly?: boolean;
}) {
  const d = new Date(iso);

  return (
    <time dateTime={iso} suppressHydrationWarning>
      {timeOnly ? d.toLocaleTimeString() : d.toLocaleString()}
    </time>
  );
}
