/**
 * A timestamp in the business's timezone.
 *
 * Pinned to America/New_York on purpose, rather than the reader's locale.
 *
 * Two earlier attempts were wrong. Formatting in a server component produced
 * UTC rendered as though it were local, because that is where the server runs
 * - a lead at 1:26pm was listed as 5:26pm. Making it a client component with
 * suppressHydrationWarning did not fix it either: that flag tells React not to
 * warn about the mismatch AND not to correct it, so the server's UTC string
 * stayed on screen for good.
 *
 * An explicit zone sidesteps the problem entirely. It also matches what the
 * person reading the inbox actually wants - the times a business operates in,
 * the same on every device, rather than whatever timezone the viewer happens
 * to be sitting in.
 */
const ZONE = "America/New_York";

export default function LocalTime({
  iso,
  timeOnly = false,
}: {
  iso: string;
  timeOnly?: boolean;
}) {
  const d = new Date(iso);

  const text = timeOnly
    ? d.toLocaleTimeString("en-US", { timeZone: ZONE, timeStyle: "short" })
    : d.toLocaleString("en-US", {
        timeZone: ZONE,
        dateStyle: "medium",
        timeStyle: "short",
      });

  return <time dateTime={iso}>{text} ET</time>;
}
