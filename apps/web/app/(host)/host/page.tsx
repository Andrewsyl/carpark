"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createListing } from "../../../lib/api";
import { useAuth } from "../../../components/AuthProvider";
import { HostStepperLayout } from "../../../components/host/HostStepperLayout";
import { HostAddressStep } from "../../../components/host/HostAddressStep";
import { HostSpaceTypeStep } from "../../../components/host/HostSpaceTypeStep";
import { HostDetailsStep } from "../../../components/host/HostDetailsStep";
import { HostAvailabilityStep } from "../../../components/host/HostAvailabilityStep";
import { HostPricingStep } from "../../../components/host/HostPricingStep";
import { HostConfirmationStep } from "../../../components/host/HostConfirmationStep";
import type { HostListingDraft } from "../../../components/host/types";
import { buildTitleFromDraft } from "../../../components/host/utils";

const DRAFT_KEY = "host-listing-draft";

const DEFAULT_DRAFT: HostListingDraft = {
  address: "",
  latitude: undefined,
  longitude: undefined,
  locationConfirmed: false,
  spaceType: undefined,
  title: "",
  availabilityText: "",
  pricePerDay: undefined,
  amenities: [],
  imageUrls: [],
};

const steps = [
  { title: "Address", description: "Pinpoint exactly where drivers will arrive." },
  { title: "Space Type", description: "Tell drivers what kind of spot you have." },
  { title: "Space Details", description: "Add amenities and photos to help drivers choose." },
  { title: "Availability", description: "Explain when the space can be used." },
  { title: "Pricing", description: "Set your daily price. You can edit this later." },
  { title: "Confirmation", description: "Double-check everything before publishing." },
];

export default function HostWizardPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<HostListingDraft>(DEFAULT_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setDraft({ ...DEFAULT_DRAFT, ...parsed });
      } catch {
        // If parsing fails, reset to default.
        setDraft(DEFAULT_DRAFT);
      }
    }
  }, []);

  const updateDraft = (partial: Partial<HostListingDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...partial };
      if (typeof window !== "undefined") {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
      }
      return next;
    });
    setError(null);
  };

  useEffect(() => {
    const generated = buildTitleFromDraft(draft);
    if (generated !== draft.title) {
      updateDraft({ title: generated });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.address, draft.spaceType]);

  const isStepValid = (index: number) => {
    switch (index) {
      case 0:
        return Boolean(draft.address && draft.latitude !== undefined && draft.longitude !== undefined && draft.locationConfirmed);
      case 1:
        return Boolean(draft.spaceType);
      case 2:
        return true;
      case 3:
        return draft.availabilityText.trim().length > 3;
      case 4:
        return typeof draft.pricePerDay === "number" && draft.pricePerDay > 0;
      default:
        return true;
    }
  };

  const nextDisabled =
    loading || (stepIndex === steps.length - 1 ? saving : !isStepValid(stepIndex));

  const handleNext = () => {
    if (!isStepValid(stepIndex)) {
      setError("Please complete this step before continuing.");
      return;
    }
    setError(null);
    setStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handleBack = () => {
    setError(null);
    setStepIndex((prev) => Math.max(prev - 1, 0));
  };

  const handlePublish = async () => {
    if (!token) {
      setError("Please sign in to publish your listing.");
      return;
    }
    if (!isStepValid(4)) {
      setError("Finish pricing before publishing.");
      setStepIndex(4);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const finalTitle = buildTitleFromDraft(draft);
      await createListing(
        {
          title: finalTitle,
          address: draft.address,
          pricePerDay: draft.pricePerDay ?? 0,
          availabilityText: draft.availabilityText,
          latitude: draft.latitude ?? 0,
          longitude: draft.longitude ?? 0,
          amenities: draft.amenities,
          imageUrls: draft.imageUrls,
        },
        token
      );
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(DRAFT_KEY);
      }
      router.push("/host/dashboard?created=1");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to publish listing";
      setError(message);
      setSaving(false);
    }
  };

  const renderStep = () => {
    switch (stepIndex) {
      case 0:
        return <HostAddressStep data={draft} onUpdate={updateDraft} />;
      case 1:
        return <HostSpaceTypeStep data={draft} onUpdate={updateDraft} />;
      case 2:
        return <HostDetailsStep data={draft} onUpdate={updateDraft} />;
      case 3:
        return <HostAvailabilityStep data={draft} onUpdate={updateDraft} />;
      case 4:
        return <HostPricingStep data={draft} onUpdate={updateDraft} />;
      case 5:
      default:
        return <HostConfirmationStep data={draft} onUpdate={updateDraft} />;
    }
  };

  if (loading) {
    return <div className="text-sm text-slate-600">Checking your session…</div>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="card space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">Become a host</h1>
          <p className="text-sm text-slate-600">Sign in to add a new space.</p>
          <div className="flex gap-2">
            <Link href="/login" className="btn-primary">
              Go to login
            </Link>
            <Link href="/signup" className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <HostStepperLayout
      title={steps[stepIndex].title}
      description={steps[stepIndex].description}
      step={stepIndex + 1}
      totalSteps={steps.length}
      onBack={stepIndex === 0 ? undefined : handleBack}
      onNext={stepIndex === steps.length - 1 ? handlePublish : handleNext}
      nextLabel={stepIndex === steps.length - 1 ? "Publish listing" : "Save & continue"}
      nextDisabled={nextDisabled}
      loading={saving}
    >
      {error && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{error}</div>}
      {renderStep()}
    </HostStepperLayout>
  );
}
