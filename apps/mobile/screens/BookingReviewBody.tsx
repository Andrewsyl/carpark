/**
 * "Review and continue" — the booking confirmation step: a close button, a big
 * title, one bordered card holding the whole booking, and a single dark action
 * pinned to the bottom.
 *
 * Rendered by BookingSummaryScreen, which owns the Stripe flow. This is the
 * presentation only; `handlePayment` on that screen is still the single path
 * that charges, and the server is still the only thing that decides the price.
 */
import { useRef, useState } from "react";
import { Animated, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertCircle, ArrowLeft, CarFront, Star } from "lucide-react-native";
import { VehicleBrandLogo } from "../components/VehicleBrandLogo";
import {
  DataRow,
  Field,
  Notice,
  RegPlate,
  Rule,
  ScrollHeader,
  SectionTitle,
  useScrollHeader,
} from "../components/ui/page";
import { formatDateLabel, formatTimeLabel } from "../utils/dateFormat";
import { formatPriceValue } from "../utils/pricing";
import { CANCELLATION_FREE_CUTOFF_MS } from "../utils/cancellationPolicy";
import { GREEN, INK, MUTED, PILL, RULE, WHITE } from "../styles/pageTokens";
import { colors } from "../styles/theme";

const FREE_CANCELLATION_HOURS = CANCELLATION_FREE_CUTOFF_MS / (60 * 60 * 1000);

type PriceSummary = {
  grossTotal: number;
  total: number;
  serviceFee: number;
  durationLabel: string;
  dailyCapApplied: boolean;
  dailyCapSavingGross: number;
};

export function BookingReviewBody({
  onClose,
  onContinue,
  onChangeTimes,
  title,
  locationLabel,
  address,
  imageUri,
  rating,
  ratingCount,
  startAt,
  endAt,
  priceSummary,
  notice,
  promo,
  vehicleMake,
  vehicleLine,
  vehiclePlate,
  onChangeVehicle,
  payBlockedReason,
}: {
  onClose: () => void;
  onContinue: () => void;
  onChangeTimes: () => void;
  title: string;
  locationLabel: string;
  address: string;
  imageUri?: string;
  rating: number | null;
  ratingCount: number;
  startAt: Date;
  endAt: Date;
  priceSummary: PriceSummary | null;
  /**
   * A blocking problem to surface above the booking — a failed payment, a slot
   * that went while the driver was deciding. Shown here rather than on a
   * separate screen so they never see a second design at the worst moment.
   */
  notice?: { message: string; actionLabel?: string; onAction?: () => void } | null;
  /**
   * Promo entry. Lives here because this screen replaced the summary that used
   * to own it — dropping it would have quietly removed a working feature.
   */
  promo: {
    code: string | null;
    input: string;
    onInput: (value: string) => void;
    onApply: () => void;
    busy: boolean;
    error: string | null;
  };
  vehicleMake: string;
  vehicleLine: string;
  vehiclePlate: string;
  onChangeVehicle: () => void;
  /**
   * Why paying isn't possible yet, or undefined when it is. The booking screen
   * blocks its own CTA on the same conditions; surfacing it here means the
   * driver fixes it before paying instead of being bounced to another screen
   * after committing.
   */
  payBlockedReason?: string;
}) {
  const insets = useSafeAreaInsets();
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  // No hero here, so the bar arrives almost immediately.
  const header = useScrollHeader({ barRange: [12, 52], titleRange: [34, 74] });

  const hasPlate = Boolean(vehiclePlate?.trim());

  // Same calendar day reads as one date with a time range; spanning midnight
  // has to name both days or the window is ambiguous.
  const sameDay = startAt.toDateString() === endAt.toDateString();
  const windowLabel = sameDay
    ? `${formatDateLabel(startAt)}, ${formatTimeLabel(startAt)} – ${formatTimeLabel(endAt)}`
    : `${formatDateLabel(startAt)}, ${formatTimeLabel(startAt)} – ${formatDateLabel(
        endAt
      )}, ${formatTimeLabel(endAt)}`;

  return (
    <View style={styles.screen}>
        <ScrollHeader
          title="Confirm and pay"
          topInset={insets.top}
          barOpacity={header.barOpacity}
          titleOpacity={header.titleOpacity}
          insetLeft={64}
          insetRight={64}
          // The back arrow is 24 tall at insets.top + 8, so its centre line is
          // 20 — not the bar's own 28, which left the title riding high beside
          // it.
          titleCentre={20}
        />

        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable
            style={styles.back}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={19} color={INK} strokeWidth={2} />
          </Pressable>
          {/* "Checkout" and the bar's "Confirm and pay" occupy the same line,
              so they cross-fade rather than stack: this label was still on
              screen when the scrolled title arrived on top of it. */}
          <Animated.Text
            style={[
              styles.headerLabel,
              {
                opacity: header.titleOpacity.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 0],
                }),
              },
            ]}
          >
            Checkout
          </Animated.Text>
        </View>

        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}
          scrollEventThrottle={16}
          onScroll={header.onScroll}
        >
          <Text style={styles.title}>Confirm and pay</Text>

          {notice ? (
            <Notice
              message={notice.message}
              actionLabel={notice.actionLabel}
              onAction={notice.onAction}
            />
          ) : null}

          {/* A bordered summary card for the subject, then plain sections —
              the accommodation checkout pattern. The card is the one box on
              the page and it earns it: it is what you are buying. */}
          <View style={styles.summaryCard}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.summaryThumb} resizeMode="cover" />
            ) : (
              <View style={[styles.summaryThumb, styles.summaryThumbEmpty]}>
                <CarFront size={26} color={MUTED} strokeWidth={1.7} />
              </View>
            )}
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryTitle} numberOfLines={1}>{title}</Text>
              {locationLabel ? (
                <Text style={styles.summaryPlace} numberOfLines={1}>{locationLabel}</Text>
              ) : null}
              {rating !== null && ratingCount > 0 ? (
                <View style={styles.summaryRating}>
                  <Star size={13} color={GREEN} fill={GREEN} strokeWidth={0} />
                  <Text style={styles.summaryScore}>{rating.toFixed(1)}</Text>
                  <Text style={styles.summaryCount}>{`(${ratingCount})`}</Text>
                </View>
              ) : null}
            </View>
          </View>

          <Rule />

          <SectionTitle>Your booking</SectionTitle>
          <View style={styles.section}>
            <View style={styles.editRow}>
              <View style={styles.editCopy}>
                <Text style={styles.editLabel}>Parking window</Text>
                <Text style={styles.editValue}>
                  {`${windowLabel}${priceSummary?.durationLabel ? ` · ${priceSummary.durationLabel}` : ""}`}
                </Text>
              </View>
              <Pressable onPress={onChangeTimes} accessibilityRole="button">
                <Text style={styles.editAction}>Edit</Text>
              </Pressable>
            </View>
            {/* The plate leaves the value line and becomes the plate itself,
                below the row at full width — the copy column is narrowed by
                the Edit action, so a plate inside it would sit short of the
                right edge and stop reading as one. */}
            <View style={[styles.editRow, styles.editRowLast, hasPlate && styles.editRowWithPlate]}>
              <View style={styles.editCopy}>
                <Text style={styles.editLabel}>Vehicle</Text>
                {/* The marque rides with the car's own line rather than the
                    plate below it: a real plate carries no badge, and putting
                    one inside would stop it reading as the thing it is. */}
                <View style={styles.vehicleLine}>
                  <VehicleBrandLogo make={vehicleMake} size={18} />
                  <Text style={styles.editValue}>{vehicleLine || "Not added yet"}</Text>
                </View>
              </View>
              <Pressable onPress={onChangeVehicle} accessibilityRole="button">
                <Text style={styles.editAction}>
                  {vehicleLine || vehiclePlate ? "Edit" : "Add"}
                </Text>
              </Pressable>
            </View>
            {hasPlate ? (
              <View style={styles.plateSlot}>
                <RegPlate value={vehiclePlate} />
              </View>
            ) : null}
          </View>

          <Rule />

          <SectionTitle>Pay with</SectionTitle>
          <View style={styles.section}>
            {/* No saved-card row: Stripe's Payment Sheet owns method entry, so
                naming a card here would be a state this screen does not have. */}
            <Text style={styles.editValue}>You&apos;ll choose a card on the next step.</Text>
            <Text style={styles.editValue}>Charged when the host confirms.</Text>
          </View>

          <Rule />

          <SectionTitle>Price details</SectionTitle>
          <View style={styles.section}>
            {priceSummary?.dailyCapApplied ? (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>
                  {`${priceSummary.durationLabel} at the hourly rate`}
                </Text>
                <Text style={styles.priceWas}>
                  {`€${formatPriceValue(priceSummary.grossTotal + priceSummary.dailyCapSavingGross)}`}
                </Text>
              </View>
            ) : null}
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>
                {priceSummary?.dailyCapApplied ? "Day rate for this space" : "Parking"}
              </Text>
              <Text style={styles.priceValue}>
                {`€${formatPriceValue(priceSummary?.total ?? 0)}`}
              </Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Service fee</Text>
              <Text style={styles.priceValue}>Included</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Promo code</Text>
              {promo.code ? (
                <Text style={styles.priceValue}>{`${promo.code} applied`}</Text>
              ) : promoOpen ? null : (
                <Pressable onPress={() => setPromoOpen(true)} accessibilityRole="button">
                  <Text style={styles.editAction}>Add</Text>
                </Pressable>
              )}
            </View>
            {promoOpen && !promo.code ? (
              <Field
                value={promo.input}
                onChangeText={promo.onInput}
                placeholder="Enter code"
                actionLabel="Apply"
                onAction={promo.onApply}
                busy={promo.busy}
                error={promo.error}
                autoCapitalize="characters"
              />
            ) : null}

            <View style={styles.priceRule} />

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total (EUR)</Text>
              <Text style={styles.totalValue}>
                {`€${formatPriceValue(priceSummary?.grossTotal ?? 0)}`}
              </Text>
            </View>
          </View>

          <Rule />

          <SectionTitle>Cancellation policy</SectionTitle>
          <View style={styles.section}>
            <Text style={styles.policyText}>
              {`Free cancellation up to ${FREE_CANCELLATION_HOURS} hours before arrival. After that the booking is non-refundable.`}
            </Text>
          </View>

          <View style={styles.legal}>
            <Text style={styles.legalText}>
              Your card is charged when you confirm. Payment is handled by Stripe.
            </Text>
          </View>

        </Animated.ScrollView>

        <View style={[styles.dock, { paddingBottom: insets.bottom + 18 }]}>
          <View style={styles.dockCopy}>
            <Text style={styles.dockPrice}>
              {`€${formatPriceValue(priceSummary?.grossTotal ?? 0)}`}
            </Text>
            <Text style={styles.dockMeta}>
              {`${windowLabel}${priceSummary?.durationLabel ? ` · ${priceSummary.durationLabel}` : ""}`}
            </Text>
          </View>
          {/* States the amount on the control that commits to it, so the
              number is never a scroll away from the button that charges it.
              When something blocks payment the button says so and goes to the
              fix, rather than promising a charge it can't start. */}
          <Pressable
            style={styles.next}
            onPress={payBlockedReason ? onChangeVehicle : onContinue}
            accessibilityRole="button"
            accessibilityLabel={
              payBlockedReason ?? `Pay €${formatPriceValue(priceSummary?.grossTotal ?? 0)}`
            }
          >
            <Text style={styles.nextLabel}>{payBlockedReason ?? "Confirm and pay"}</Text>
          </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: WHITE },
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 24, paddingBottom: 18, zIndex: 3,
  },
  back: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  headerLabel: { flex: 1, fontFamily: "PlusJakartaSans-SemiBold", fontSize: 17, color: INK },
  close: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
  },
  title: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 26, lineHeight: 31, letterSpacing: -0.5, color: INK,
    paddingHorizontal: 24, paddingTop: 4,
  },

  // The listing's section rhythm: content sits at the gutter, 12 under its
  // heading, with the rule supplying the 28 between sections.
  section: { paddingHorizontal: 24 },

  // The one box on the page — what you are buying.
  summaryCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    marginHorizontal: 24, marginTop: 20,
    borderWidth: 1, borderColor: RULE, borderRadius: 14, padding: 14,
  },
  summaryThumb: { width: 56, height: 56, borderRadius: 10, flexShrink: 0 },
  summaryThumbEmpty: { backgroundColor: PILL, alignItems: "center", justifyContent: "center" },
  summaryCopy: { flex: 1, minWidth: 0 },
  summaryTitle: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 15, color: INK },
  summaryPlace: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 15, color: MUTED, marginTop: 2,
  },
  summaryRating: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  summaryScore: { fontFamily: "PlusJakartaSans-Regular", fontSize: 14, color: INK },
  summaryCount: { fontFamily: "PlusJakartaSans-Regular", fontSize: 14, color: MUTED },

  // Label over value, action underlined on the right — an edit is a link here,
  // because the page has one button and it charges.
  editRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: RULE,
  },
  editRowLast: { borderBottomWidth: 0 },
  // The plate below supplies the row's bottom space, so the row itself stops
  // at its own copy rather than leaving a gap the plate then repeats.
  editRowWithPlate: { paddingBottom: 0 },
  plateSlot: { paddingTop: 12, paddingBottom: 4 },
  editCopy: { flex: 1, minWidth: 0 },
  editLabel: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 15, color: INK },
  editValue: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 15, lineHeight: 21,
    color: MUTED, marginTop: 2,
  },
  // The logo is 18 against a 21 line box, so `center` lands it on the line's
  // optical middle without a nudge.
  vehicleLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  editAction: {
    flexShrink: 0, fontFamily: "PlusJakartaSans-SemiBold", fontSize: 15,
    color: INK, textDecorationLine: "underline",
  },

  priceRow: {
    flexDirection: "row", alignItems: "baseline", justifyContent: "space-between",
    gap: 20, paddingVertical: 8,
  },
  priceLabel: { flex: 1, fontFamily: "PlusJakartaSans-Regular", fontSize: 15, color: MUTED },
  priceValue: { fontFamily: "PlusJakartaSans-Regular", fontSize: 15, color: INK },
  priceWas: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 15, color: MUTED,
    textDecorationLine: "line-through",
  },
  priceRule: { height: 1, backgroundColor: RULE, marginVertical: 10 },
  totalRow: {
    flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 20,
  },
  totalLabel: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 17, color: INK },
  totalValue: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 26, lineHeight: 30, letterSpacing: -0.4, color: INK,
  },
  total: { fontFamily: "PlusJakartaSans-Bold", fontSize: 17, color: INK },



  // The row's own marginTop moves to the wrapper so the logo and the name sit
  // on one baseline.





  policy: { padding: 18, gap: 4 },
  policyText: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 16, lineHeight: 22, color: INK,
  },



  legal: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24 },
  legalText: { fontFamily: "PlusJakartaSans-Regular", fontSize: 14, lineHeight: 20, color: MUTED },

  // Amount on the left, action on the right — the number and the button that
  // commits to it, side by side.
  dock: {
    flexDirection: "row", alignItems: "center", gap: 16,
    borderTopWidth: 1, borderTopColor: RULE, backgroundColor: WHITE,
    paddingHorizontal: 24, paddingTop: 14,
  },
  dockCopy: { flex: 1, minWidth: 0 },
  dockPrice: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 20, letterSpacing: -0.3, color: INK,
  },
  dockMeta: { fontFamily: "PlusJakartaSans-Regular", fontSize: 14, color: MUTED, marginTop: 1 },
  next: {
    flexShrink: 0, height: 48, borderRadius: 999, backgroundColor: GREEN,
    paddingHorizontal: 26, alignItems: "center", justifyContent: "center",
  },
  nextLabel: { fontFamily: "PlusJakartaSans-SemiBold", fontSize: 16, color: WHITE },
});
