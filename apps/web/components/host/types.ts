export type HostListingDraft = {
  address: string;
  latitude?: number;
  longitude?: number;
  locationConfirmed?: boolean;
  spaceType?: string;
  title: string;
  availabilityText: string;
  pricePerDay?: number;
  amenities: string[];
  imageUrls: string[];
};

export type HostStepProps = {
  data: HostListingDraft;
  onUpdate: (partial: Partial<HostListingDraft>) => void;
};
