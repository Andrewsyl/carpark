import type { HostListingDraft } from "./types";

export function prettySpaceType(value?: string) {
  switch (value) {
    case "driveway":
      return "Driveway";
    case "garage":
      return "Garage";
    case "carpark":
      return "Car park / lot";
    case "street":
      return "Private street bay";
    default:
      return value ?? "Parking space";
  }
}

export function buildTitleFromDraft(draft: HostListingDraft) {
  const type = prettySpaceType(draft.spaceType);
  const city = draft.address?.split(",")?.[0]?.trim();
  if (city) return `${type} at ${city}`;
  return type;
}
