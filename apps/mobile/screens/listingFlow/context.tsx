import { createContext, useContext } from "react";

export type ListingDraft = {
  location: {
    address: string;
    latitude: number;
    longitude: number;
  };
  coverHeading?: number | null;
  coverPitch?: number | null;
  spaceType: string;
  accessOptions: string[];
  accessCode: string;
  permissionDeclared: boolean;
  availability: {
    mode: "daily" | "dates" | "recurring";
    detail: string;
    timeStart: string;
    timeEnd: string;
    dateStart: string;
    dateEnd: string;
    weekdays: string[];
  };
  pricePerDay: string;
  photos: string[];
};

export type ListingFlowValue = {
  draft: ListingDraft;
  setDraft: React.Dispatch<React.SetStateAction<ListingDraft>>;
  listingId: string | null;
};

export const ListingFlowContext = createContext<ListingFlowValue | null>(null);

export function useListingFlow() {
  const ctx = useContext(ListingFlowContext);
  if (!ctx) {
    throw new Error("useListingFlow must be used within ListingFlowContext");
  }
  return ctx;
}
