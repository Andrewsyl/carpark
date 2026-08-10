import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-123456";
process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
process.env.WEB_BASE_URL = "http://localhost:3000";

const db = {
  getListingById: vi.fn(),
  listAvailability: vi.fn(),
};

vi.mock("../src/lib/db.js", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/db.js")>("../src/lib/db.js");
  return {
    ...actual,
    getListingById: db.getListingById,
    listAvailability: db.listAvailability,
  };
});

const LISTING_ID = "11111111-1111-1111-1111-111111111111";
const HOST_ID = "22222222-2222-2222-2222-222222222222";
const OTHER_USER_ID = "33333333-3333-3333-3333-333333333333";

const LISTING = {
  id: LISTING_ID,
  title: "Private driveway",
  address: "21 Grantham Street, Dublin 8, D08 X2Y3",
  hostId: HOST_ID,
  accessCode: "4471#",
  arrivalInstructions: "Second gate on the left.",
  rating: null,
  ratingCount: 0,
  amenities: [],
  imageUrls: [],
};

async function fetchListing(asUserId?: string) {
  const { createApp } = await import("../src/app.js");
  const { signToken } = await import("../src/lib/auth.js");
  const app = createApp();
  const req = request(app).get(`/api/listings/${LISTING_ID}`);
  if (asUserId) {
    const token = signToken({ userId: asUserId, email: "someone@example.com" });
    req.set("Authorization", `Bearer ${token}`);
  }
  return req;
}

/**
 * The pre-booking promise: a driver sees an approximate area, and the exact
 * address plus the access code arrive when a booking exists. Both used to be in
 * the public payload regardless of who asked, so the promise held only as long
 * as nobody read the JSON.
 */
describe("listing detail privacy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.getListingById.mockResolvedValue({ ...LISTING });
    db.listAvailability.mockResolvedValue([]);
  });

  it("withholds the access code and arrival instructions from an anonymous caller", async () => {
    const res = await fetchListing();
    expect(res.status).toBe(200);
    expect(res.body.listing.accessCode).toBeNull();
    expect(res.body.listing.arrivalInstructions).toBeNull();
  });

  it("still says whether a code exists, which is all the listing page needs", async () => {
    const res = await fetchListing();
    expect(res.body.listing.hasAccessCode).toBe(true);
    expect(res.body.listing.hasArrivalInstructions).toBe(true);
  });

  it("withholds the Eircode, which identifies one property", async () => {
    const res = await fetchListing();
    expect(res.body.listing.address).toBe("21 Grantham Street, Dublin 8");
    expect(JSON.stringify(res.body)).not.toContain("D08 X2Y3");
  });

  it("withholds all of it from a signed-in driver who is not the host", async () => {
    const res = await fetchListing(OTHER_USER_ID);
    expect(res.body.listing.accessCode).toBeNull();
    expect(res.body.listing.address).toBe("21 Grantham Street, Dublin 8");
  });

  it("gives the host their own listing in full, so editing does not blank it", async () => {
    const res = await fetchListing(HOST_ID);
    expect(res.body.listing.accessCode).toBe("4471#");
    expect(res.body.listing.arrivalInstructions).toBe("Second gate on the left.");
    expect(res.body.listing.address).toBe("21 Grantham Street, Dublin 8, D08 X2Y3");
  });
});
