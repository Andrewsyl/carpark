import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { CardField, useStripe } from "@stripe/stripe-react-native";
import {
  createPaymentMethodSetupIntent,
  deletePaymentMethod,
  listPaymentHistory,
  listPaymentMethods,
  retryPayment,
  setDefaultPaymentMethod,
  type PaymentHistoryItem,
  type PaymentMethod,
} from "../api";
import { useAuth } from "../auth";

export function PaymentsScreen() {
  const { token, user } = useAuth();
  const { confirmSetupIntent } = useStripe();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [history, setHistory] = useState<PaymentHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [adding, setAdding] = useState(false);

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [nextMethods, nextHistory] = await Promise.all([
        listPaymentMethods(token),
        listPaymentHistory(token),
      ]);
      setMethods(nextMethods);
      setHistory(nextHistory);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load payments");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleAddCard = () => {
    setShowAdd((prev) => !prev);
    setError(null);
  };

  const handleSaveCard = async () => {
    if (!token) return;
    if (!cardComplete) {
      Alert.alert("Card details", "Please complete the card details first.");
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const clientSecret = await createPaymentMethodSetupIntent(token);
      const { error: stripeError, setupIntent } = await confirmSetupIntent(clientSecret, {
        paymentMethodType: "Card",
      });
      if (stripeError) {
        setError(stripeError.message ?? "Card setup failed");
        return;
      }
      if (setupIntent?.status?.toLowerCase() !== "succeeded") {
        setError("Card setup did not complete. Please try again.");
        return;
      }
      await loadData();
      setShowAdd(false);
      setCardComplete(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add card");
    } finally {
      setAdding(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    if (!token) return;
    setError(null);
    try {
      await setDefaultPaymentMethod(token, id);
      setMethods((prev) =>
        prev.map((item) => ({
          ...item,
          is_default: item.id === id,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update payment method");
    }
  };

  const handleDelete = (id: string) => {
    if (!token) return;
    Alert.alert("Remove card", "This card will be removed from your account.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setError(null);
          try {
            await deletePaymentMethod(token, id);
            setMethods((prev) => prev.filter((item) => item.id !== id));
          } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to remove card");
          }
        },
      },
    ]);
  };

  const handleRetry = async (id: string) => {
    if (!token) return;
    setError(null);
    try {
      await retryPayment(token, id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to retry payment");
    }
  };

  const formattedHistory = useMemo(
    () =>
      history.map((item) => ({
        ...item,
        amountLabel: `${(item.amount / 100).toFixed(2)} ${item.currency.toUpperCase()}`,
        dateLabel: new Date(item.created_at).toLocaleDateString(),
      })),
    [history]
  );

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.emptyState}>
          <Text style={styles.title}>Payments</Text>
          <Text style={styles.subtitle}>Sign in to manage cards and view charges.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Profile</Text>
          <Text style={styles.title}>Payments</Text>
          <Text style={styles.subtitle}>Manage cards and review your booking charges.</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <View style={styles.loadingBadge}>
              <ActivityIndicator size="small" color="#00d4aa" />
              <Text style={styles.loadingText}>Loading payments…</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Payment methods</Text>
            <Pressable style={styles.addButton} onPress={handleAddCard}>
              <Text style={styles.addButtonText}>{showAdd ? "Close" : "Add card"}</Text>
            </Pressable>
          </View>
          {showAdd ? (
            <View style={styles.addCardPanel}>
              <Text style={styles.addCardLabel}>Card details</Text>
              <CardField
                postalCodeEnabled={false}
                placeholders={{
                  number: "4242 4242 4242 4242",
                }}
                cardStyle={styles.cardField}
                style={styles.cardFieldContainer}
                onCardChange={(details) => setCardComplete(!!details.complete)}
              />
              <Pressable
                style={[styles.saveButton, (!cardComplete || adding) && styles.saveButtonDisabled]}
                onPress={handleSaveCard}
                disabled={!cardComplete || adding}
              >
                <Text style={styles.saveButtonText}>
                  {adding ? "Saving..." : "Save card"}
                </Text>
              </Pressable>
            </View>
          ) : null}
          {methods.length === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={styles.emptyText}>No cards saved yet.</Text>
            </View>
          ) : (
            methods.map((method) => (
              <View key={method.id} style={styles.row}>
                <MaterialIcons name="credit-card" size={24} color="#111827" />
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>
                    {method.brand?.toUpperCase() || "CARD"} •••• {method.last4}
                  </Text>
                  <Text style={styles.rowSubtitle}>
                    Expires {method.exp_month}/{String(method.exp_year).slice(-2)}
                    {method.is_default ? " • Default" : ""}
                  </Text>
                </View>
                <View style={styles.rowActions}>
                  {!method.is_default ? (
                    <Pressable
                      style={styles.rowActionButton}
                      onPress={() => handleSetDefault(method.id)}
                    >
                      <Text style={styles.rowActionText}>Default</Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.rowStatus}>Default</Text>
                  )}
                  <Pressable
                    style={[styles.rowActionButton, styles.rowDelete]}
                    onPress={() => handleDelete(method.id)}
                  >
                    <Text style={styles.rowDeleteText}>Remove</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>
        <Text style={styles.poweredBy}>Powered by Stripe</Text>

        <Text style={styles.sectionHeader}>Payment history</Text>
        <View style={styles.section}>
          {formattedHistory.length === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={styles.emptyText}>No payments yet.</Text>
            </View>
          ) : (
            formattedHistory.map((item) => (
              <View key={item.id} style={styles.row}>
                <MaterialIcons name="receipt-long" size={24} color="#111827" />
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{item.description}</Text>
                  <Text style={styles.rowSubtitle}>
                    {item.amountLabel} • {item.dateLabel}
                  </Text>
                  <Text style={styles.rowMeta}>{item.status.toUpperCase()}</Text>
                </View>
                {item.status !== "succeeded" ? (
                  <Pressable
                    style={[styles.rowActionButton, styles.rowRetry]}
                    onPress={() => handleRetry(item.id)}
                  >
                    <Text style={styles.rowActionText}>Retry</Text>
                  </Pressable>
                ) : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingBottom: 32,
    paddingTop: 24,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
  },
  loadingBadge: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderRadius: 16,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  header: {
    marginBottom: 16,
  },
  kicker: {
    color: "#10b981",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    color: "#111827",
    fontSize: 30,
    fontWeight: "700",
    marginTop: 6,
  },
  subtitle: {
    color: "#6b7280",
    fontSize: 15,
    marginTop: 6,
  },
  error: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderRadius: 12,
    borderWidth: 1,
    color: "#b42318",
    fontSize: 12,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  muted: {
    color: "#6b7280",
    fontSize: 12,
    marginBottom: 12,
  },
  loadingText: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "600",
  },
  section: {
    backgroundColor: "#ffffff",
    borderColor: "#e5e7eb",
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 18,
    overflow: "hidden",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  sectionHeader: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 10,
    marginTop: 8,
  },
  poweredBy: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    textTransform: "uppercase",
  },
  sectionHeaderRow: {
    alignItems: "center",
    borderBottomColor: "#e5e7eb",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
  },
  addButton: {
    backgroundColor: "#10b981",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  addCardPanel: {
    borderBottomColor: "#e5e7eb",
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  addCardLabel: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "600",
  },
  cardFieldContainer: {
    height: 48,
  },
  cardField: {
    backgroundColor: "#ffffff",
    borderColor: "#e5e7eb",
    borderRadius: 12,
    borderWidth: 1,
    color: "#111827",
    fontSize: 15,
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: "#10b981",
    borderRadius: 10,
    minHeight: 44,
    paddingVertical: 12,
  },
  saveButtonDisabled: {
    backgroundColor: "#cbd5e1",
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  row: {
    alignItems: "center",
    borderBottomColor: "#e5e7eb",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "600",
  },
  rowSubtitle: {
    color: "#6b7280",
    fontSize: 13,
    marginTop: 2,
  },
  rowMeta: {
    color: "#9ca3af",
    fontSize: 11,
    marginTop: 4,
  },
  rowActions: {
    alignItems: "flex-end",
    gap: 6,
  },
  rowActionButton: {
    borderColor: "#e5e7eb",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  rowActionText: {
    color: "#0f172a",
    fontSize: 11,
    fontWeight: "600",
  },
  rowStatus: {
    color: "#16a34a",
    fontSize: 11,
    fontWeight: "700",
  },
  rowDelete: {
    borderColor: "#fecaca",
  },
  rowDeleteText: {
    color: "#b42318",
    fontSize: 11,
    fontWeight: "700",
  },
  rowRetry: {
    borderColor: "#fcd34d",
  },
  emptyRow: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  emptyText: {
    color: "#6b7280",
    fontSize: 13,
  },
  emptyState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
});
