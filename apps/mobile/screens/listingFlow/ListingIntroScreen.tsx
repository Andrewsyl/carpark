import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SquircleBtn } from "../../components/SquircleBtn";
import { SafeAreaView } from "react-native-safe-area-context";
import { X, Zap, CircleDollarSign, Landmark, ShieldCheck, MailWarning } from "lucide-react-native";
import { colors } from "../../styles/theme";
import { hostFlowColors } from "./hostFlowTheme";
import { BanknoteSvg } from "../../components/BanknoteSvg";
import { spacing } from "../../styles/theme";
import { useAuth } from "../../auth";
import { requestEmailVerification } from "../../api";

type FlowStackParamList = {
  ListingIntro: undefined;
  ListingLocation: undefined;
};

type Props = NativeStackScreenProps<FlowStackParamList, "ListingIntro">;

// How hosting works — the deal a first-time host is agreeing to, up front:
// instant bookings, what they earn, how they're paid, and that they stay in
// control. Every claim here must stay true to how the product actually works.
const PHASES = [
  {
    icon: Zap,
    label: "Drivers book instantly",
    body: "They find your space on the map, book, and pay in the app — no back-and-forth",
  },
  {
    icon: CircleDollarSign,
    label: "You keep 100% of your rate",
    body: "Drivers pay a small service fee on top — your price is yours",
  },
  {
    icon: Landmark,
    label: "Get paid through Stripe",
    body: "Connect payouts once and earnings go straight to your bank",
  },
  {
    icon: ShieldCheck,
    label: "You stay in control",
    body: "Edit, pause or remove your listing anytime",
  },
] as const;

export function ListingIntroScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [verifyState, setVerifyState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable
          style={styles.closeBtn}
          onPress={() => navigation.goBack()}
          hitSlop={8}
          accessibilityLabel="Close"
        >
          <X size={17} color={hostFlowColors.text} strokeWidth={2.2} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroBlock}>
          <Text style={styles.eyebrow}>Host on FreeSpace</Text>
          <Text style={styles.headline}>Turn your space{"\n"}into extra income</Text>
          <BanknoteSvg width="100%" height={220} />
          <Text style={styles.subline}>
            Turn an empty driveway, bay or garage into extra income in just a few minutes.
          </Text>
        </View>

        <View style={styles.phases}>
          {PHASES.map((phase, i) => {
            const Icon = phase.icon;
            return (
              <View key={phase.label} style={styles.phaseRow}>
                <View style={styles.phaseLeft}>
                  <View style={styles.phaseIconWrap}>
                    <Icon size={18} color={colors.textInverse} strokeWidth={2} />
                  </View>
                  {i < PHASES.length - 1 ? <View style={styles.phaseLine} /> : null}
                </View>
                <View style={styles.phaseText}>
                  <Text style={styles.phaseLabel}>{phase.label}</Text>
                  <Text style={styles.phaseBody}>{phase.body}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <Text style={styles.reassure}>
          9 quick steps, about 5 minutes. Your progress saves automatically — you can stop and finish anytime.
        </Text>

        {user && user.emailVerified === false ? (
          <View style={styles.verifyCard}>
            <View style={styles.verifyRow}>
              <MailWarning size={15} color={hostFlowColors.accent} strokeWidth={2.2} />
              <Text style={styles.verifyTitle}>Verify your email to publish</Text>
            </View>
            <Text style={styles.verifyBody}>
              You can build your listing now, but you'll need to verify your email before it goes live. We can resend the link.
            </Text>
            <Pressable
              disabled={verifyState === "sending" || verifyState === "sent"}
              onPress={async () => {
                if (!user?.email) return;
                setVerifyState("sending");
                try {
                  await requestEmailVerification(user.email);
                  setVerifyState("sent");
                } catch {
                  setVerifyState("error");
                }
              }}
            >
              <Text style={styles.verifyLink}>
                {verifyState === "sending"
                  ? "Sending…"
                  : verifyState === "sent"
                  ? "Sent — check your inbox"
                  : verifyState === "error"
                  ? "Couldn't send — tap to retry"
                  : "Resend verification email"}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={styles.permissionNote}>
          By listing, you confirm you have the right to rent this space to others.
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <SquircleBtn
          label="Get started"
          onPress={() => navigation.navigate("ListingLocation")}
          fullWidth
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: hostFlowColors.bg,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
    alignItems: "flex-start",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: hostFlowColors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: spacing.screenX,
    paddingTop: 28,
    paddingBottom: 24,
  },
  heroBlock: {
    marginBottom: 36,
  },
  eyebrow: {
    color: hostFlowColors.accent,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  headline: {
    color: hostFlowColors.text,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 34,
    letterSpacing: -1,
    lineHeight: 46,
    marginBottom: 10,
  },
  subline: {
    color:      hostFlowColors.textMuted,
    fontFamily: "PlusJakartaSans-Medium",
    fontSize:   15,
    lineHeight: 23,
    marginTop:  4,
  },
  phases: {
    gap: 0,
    marginBottom: 28,
  },
  phaseRow: {
    flexDirection: "row",
    gap: 16,
  },
  phaseLeft: {
    alignItems: "center",
    width: 40,
  },
  phaseIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: hostFlowColors.accent,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  phaseLine: {
    flex: 1,
    width: 1.5,
    backgroundColor: hostFlowColors.accentSoftBorder,
    marginVertical: 6,
    minHeight: 20,
  },
  phaseText: {
    flex: 1,
    paddingBottom: 24,
    justifyContent: "center",
    paddingTop: 9,
  },
  phaseLabel: {
    color: hostFlowColors.text,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 16,
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  phaseBody: {
    color: hostFlowColors.textMuted,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 3,
  },
  reassure: {
    color: hostFlowColors.textMuted,
    fontFamily: "PlusJakartaSans-Medium",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 20,
  },
  verifyCard: {
    backgroundColor: hostFlowColors.accentSoft,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: hostFlowColors.accentSoftBorder,
    padding: 16,
    marginBottom: 20,
  },
  verifyRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 6,
  },
  verifyTitle: {
    color: hostFlowColors.accent,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    letterSpacing: -0.1,
  },
  verifyBody: {
    color: hostFlowColors.textMuted,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 13,
    lineHeight: 19,
  },
  verifyLink: {
    color: hostFlowColors.accent,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13,
    marginTop: 10,
  },
  permissionNote: {
    color: hostFlowColors.textSoft,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  footer: {
    paddingHorizontal: spacing.screenX,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: hostFlowColors.border,
    backgroundColor: hostFlowColors.cardBg,
  },
});
