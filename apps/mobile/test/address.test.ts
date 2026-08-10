import { publicAddress, stripEircode } from "../utils/address";

/**
 * An Eircode identifies a single property, so showing one on a listing hands
 * over the exact address the whole pre-booking flow withholds. These cases are
 * the ones that actually appear in the data — a code in its own comma part, a
 * code welded to the district, and the two spacing conventions hosts type.
 */
describe("publicAddress", () => {
  it("removes an Eircode that sits in its own part", () => {
    expect(publicAddress("21 Grantham Street, Dublin 8, D08 X2Y3")).toBe(
      "21 Grantham Street, Dublin 8"
    );
  });

  it("removes an Eircode welded onto the district", () => {
    expect(publicAddress("Drumcondra, Dublin 1 D01N242")).toBe("Drumcondra, Dublin 1");
  });

  it("removes a hyphenated or unspaced code", () => {
    expect(stripEircode("A65-F4E2")).toBe("");
    expect(stripEircode("A65F4E2")).toBe("");
  });

  it("removes the D6W routing key, which breaks the letter-digit-digit rule", () => {
    expect(publicAddress("Harold's Cross, D6W FN82")).toBe("Harold's Cross");
  });

  it("keeps a Dublin postal district, which is an area rather than a property", () => {
    expect(publicAddress("Portobello, Dublin 8")).toBe("Portobello, Dublin 8");
  });

  it("drops the country, which is true of every listing", () => {
    expect(publicAddress("Synge Street, Dublin 8, Ireland")).toBe("Synge Street, Dublin 8");
  });

  it("does not eat a house number or a street name that looks code-shaped", () => {
    expect(publicAddress("12 Main Street, Naas, Co. Kildare")).toBe(
      "12 Main Street, Naas, Co. Kildare"
    );
  });

  it("handles a missing address", () => {
    expect(publicAddress(null)).toBe("");
    expect(publicAddress(undefined)).toBe("");
    expect(publicAddress("")).toBe("");
  });
});
