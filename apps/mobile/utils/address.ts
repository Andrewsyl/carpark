/**
 * Address formatting for anything a driver can see before they book.
 *
 * An Eircode is not a postcode in the British or American sense — it identifies
 * a *single property*, not an area. Printing one on a listing hands over the
 * exact address, which is the one thing every space withholds until a booking
 * exists: the map shows a halo rather than a pin, the listing says "approximate
 * area", and "Things to know" promises the address arrives on booking. An
 * Eircode in the address line quietly contradicts all three.
 *
 * So it comes out of every pre-booking surface. A confirmed booking still shows
 * the full address it snapshotted — that driver is meant to find the place.
 */

/**
 * Eircode: a routing key then four characters, e.g. "D08 X2Y3", "A65F4E2".
 *
 * The routing key's first letter comes from a restricted set (no B, G, I, J, L,
 * M, O, Q, S, U, Z) and `D6W` is the one historical exception that breaks the
 * letter-digit-digit pattern. The last four characters use the same restricted
 * alphabet plus digits. Matching loosely here would eat things like "Dublin 8",
 * which is a district and should stay.
 */
const EIRCODE = /\b(?:[ACDEFHKNPRTVWXY]\d{2}|D6W)[ -]?[0-9ACDEFHKNPRTVWXY]{4}\b/gi;

/** Strips any Eircode, then tidies the punctuation it leaves behind. */
export function stripEircode(address: string): string {
  return address
    .replace(EIRCODE, "")
    .replace(/\s{2,}/g, " ")
    // A removed code leaves ", ," or a dangling separator at either end.
    .replace(/\s*,\s*(?=,)/g, "")
    .replace(/^[\s,]+|[\s,]+$/g, "")
    .trim();
}

/**
 * The address as a driver may see it before booking: no Eircode, no country.
 * Use this for every listing address on a public surface.
 */
export function publicAddress(address?: string | null): string {
  if (!address) return "";
  const parts = stripEircode(address)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    // "Ireland" is true of every listing on the platform, so it says nothing.
    .filter((part) => !/^(ireland|éire|eire)$/i.test(part));
  return parts.join(", ");
}
