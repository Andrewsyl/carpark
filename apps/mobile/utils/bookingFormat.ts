export function formatBookingReference(bookingId: string): string {
  const shortId = bookingId.replace(/-/g, '').substring(0, 6).toUpperCase();
  return `CP-${shortId}`;
}
