/**
 * The wizard header: two outlined pills, nothing else.
 *
 * No close X and no progress bar here — progress moved to three phase segments
 * sitting directly above the footer, which is where the design puts it. The
 * header's only job is the escape hatches.
 */
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { hostFlowColors } from "./hostFlowTheme";
import { useExitListingFlowConfirm } from "./confirmExit";
import { useListingFlow } from "./context";
import { hasMeaningfulHostListingDraft, saveHostListingDraft } from "./draftStorage";
import { useGlobalToast } from "../../components/GlobalToast";

/** Same address the Legal screen uses; there is no in-app help surface yet. */
const SUPPORT_EMAIL = "support@freespace.ie";

type Props = {
  /** Only used to decide whether leaving should offer to save the draft. */
  current: number;
  onClose: () => void;
  /**
   * Off on the review step, which the design gives "Save & exit" alone —
   * by then the host has read every question the help pill exists to answer.
   */
  showHelp?: boolean;
};

export function FlowHeader({ current, onClose, showHelp = true }: Props) {
  const insets = useSafeAreaInsets();
  const { draft, listingId } = useListingFlow();
  const { showSuccess } = useGlobalToast();
  const { presentExitConfirm, exitConfirmModal } = useExitListingFlowConfirm();
  const hasDraftToSave = !listingId && hasMeaningfulHostListingDraft(draft);
  const canPromptToSave = current > 2 || hasDraftToSave;

  const handleClose = () => {
    if (!canPromptToSave) {
      onClose();
      return;
    }
    presentExitConfirm({
      canSave: hasDraftToSave,
      onConfirm: async () => {
        if (hasDraftToSave) {
          await saveHostListingDraft(draft);
          showSuccess("Saved to Listings. Finish it anytime.");
        }
        onClose();
      },
      message: hasDraftToSave
        ? "We'll save this unfinished listing to Listings so you can come back and complete it later."
        : "Your space isn't published yet. If you leave now, any unpublished changes will be lost.",
    });
  };

  const handleQuestions = () => {
    void Linking.openURL(
      `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Question about listing my space")}`,
    );
  };

  return (
    <>
      <View style={[styles.wrap, { paddingTop: insets.top + 14 }]}>
        <Pressable style={styles.pill} onPress={handleClose} accessibilityRole="button">
          <Text style={styles.pillText}>Save &amp; exit</Text>
        </Pressable>
        {showHelp ? (
          <Pressable style={styles.pill} onPress={handleQuestions} accessibilityRole="button">
            <Text style={styles.pillText}>Questions?</Text>
          </Pressable>
        ) : null}
      </View>
      {exitConfirmModal}
    </>
  );
}

const styles = StyleSheet.create({
  // No bottom rule: the phase segments above the footer are the only divider
  // the screen gets, and a line here made the header read as a banner.
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    backgroundColor: hostFlowColors.bg,
  },
  pill: {
    height: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: hostFlowColors.border,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  pillText: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    color: hostFlowColors.text,
  },
});
