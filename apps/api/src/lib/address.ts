/**
 * Address handling for anything a driver can read before they hold a booking.
 *
 * An Eircode is not an area code — it resolves to a *single property*. The
 * whole pre-booking surface is built on withholding the exact address: search
 * returns a rounded position, the listing draws a halo rather than a pin and
 * says "approximate area", and the address and access code are promised "on
 * booking". Returning the Eircode in the listing payload handed all of that
 * over to anyone who read the JSON, whether or not a screen printed it.
 *
 * Stripped at the response boundary, never in the database layer: a booking
 * snapshots the listing's address when it is created (that row must keep the
 * full address, since the driver has to find the place), and the host's own
 * reads of their listing are unaffected.
 */

/**
 * Eircode: routing key then four characters — "D08 X2Y3", "A65F4E2", "D6W FN82".
 *
 * The alphabet is restricted (no B, G, I, J, L, M, O, Q, S, U, Z) and D6W is the
 * single historical routing key that breaks the letter-digit-digit shape.
 * Matching more loosely would eat "Dublin 8", which is a district covering
 * thousands of properties and is exactly the level of detail this is meant to
 * leave behind.
 */
const EIRCODE = /\b(?:[ACDEFHKNPRTVWXY]\d{2}|D6W)[ -]?[0-9ACDEFHKNPRTVWXY]{4}\b/gi;

/** Removes any Eircode from an address and tidies the punctuation left behind. */
export function stripEircode(address: string | null | undefined): string {
  if (!address) return "";
  return address
    .replace(EIRCODE, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s*,\s*(?=,)/g, "")
    .replace(/^[\s,]+|[\s,]+$/g, "")
    .trim();
}

/** True when the string carries an Eircode. Used by the tests and by callers
 *  that need to assert a payload is safe to serve publicly. */
export function hasEircode(address: string | null | undefined): boolean {
  if (!address) return false;
  EIRCODE.lastIndex = 0;
  return EIRCODE.test(address);
}
