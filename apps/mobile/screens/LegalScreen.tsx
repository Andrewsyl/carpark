import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { cardShadow, colors, radius, spacing, textStyles } from "../styles/theme";
import type { RootStackParamList } from "../types";
import { Ionicons } from "@expo/vector-icons";

type Props = NativeStackScreenProps<RootStackParamList, "Legal">;

const SUPPORT_EMAIL = "support@parkshare.app";

export function LegalScreen({ navigation }: Props) {
  const openEmail = (subject: string) => {
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
    void Linking.openURL(url);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Terms & privacy</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionKicker}>Legal</Text>
        <Text style={styles.sectionTitle}>How we use your data</Text>
        <Text style={styles.body}>
          We only use your data to run bookings, process payments, and keep the marketplace safe.
          We never sell personal data, and we only share information with drivers or hosts when a
          booking is confirmed.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Terms of Service</Text>
          <Text style={styles.cardBody}>
            By listing or booking, you agree to follow our community rules, cancellation policy,
            and payout terms. Hosts are responsible for keeping availability accurate.
          </Text>
          <Pressable style={styles.cardAction} onPress={() => openEmail("Request Terms of Service")}>
            <Text style={styles.cardActionText}>Email me the full terms</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Privacy Policy</Text>
          <Text style={styles.cardBody}>
            We collect account details, booking history, and payment metadata to complete
            reservations and comply with legal obligations.
          </Text>
          <Pressable style={styles.cardAction} onPress={() => openEmail("Request Privacy Policy")}>
            <Text style={styles.cardActionText}>Email me the privacy policy</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionKicker}>GDPR requests</Text>
        <Text style={styles.sectionTitle}>Your rights</Text>
        <Text style={styles.body}>
          You can request a copy of your data or ask us to delete your account at any time. We
          handle requests within 30 days.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Export my data</Text>
          <Text style={styles.cardBody}>We’ll email you a downloadable copy of your data.</Text>
          <Pressable
            style={styles.cardAction}
            onPress={() => openEmail("GDPR data export request")}
          >
            <Text style={styles.cardActionText}>Request export</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Delete my account</Text>
          <Text style={styles.cardBody}>
            We’ll confirm before removing your account and anonymising your bookings.
          </Text>
          <Pressable
            style={[styles.cardAction, styles.cardActionDanger]}
            onPress={() => openEmail("GDPR delete account request")}
          >
            <Text style={[styles.cardActionText, styles.cardActionTextDanger]}>
              Request deletion
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.appBg,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screenX,
    paddingTop: 12,
  },
  backButton: {
    alignItems: "center",
    justifyContent: "center",

    paddingVertical: 6,
    width: 60,
  },
  backCircle: {
    alignItems: "center",
    justifyContent: "center",
    height: 32,
    width: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBg,
  },
  backIcon: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 14,
    textAlign: "center",
    fontWeight: "600",
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "600",
  },
  content: {
    paddingHorizontal: spacing.screenX,
    paddingBottom: 32,
    paddingTop: 16,
  },
  sectionKicker: {
    ...textStyles.kicker,
    marginTop: 12,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "600",
    marginTop: 8,
  },
  body: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    marginTop: 16,
    padding: spacing.card,
    ...cardShadow,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  cardBody: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
  cardAction: {
    alignSelf: "flex-start",
    backgroundColor: "#ecfdf3",
    borderRadius: 999,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  cardActionDanger: {
    backgroundColor: "#fee2e2",
  },
  cardActionText: {
    color: "#047857",
    fontSize: 12,
    fontWeight: "600",
  },
  cardActionTextDanger: {
    color: "#b42318",
  },
});
