import { useCallback, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BookmarkCheck, TriangleAlert } from "lucide-react-native";
import { hostFlowColors, hostFlowShadow } from "./hostFlowTheme";
import { colors } from "../../styles/theme";

type ExitConfirmOptions = {
  canSave: boolean;
  message?: string;
  onConfirm: () => void | Promise<void>;
};

type ExitConfirmState = ExitConfirmOptions & {
  visible: boolean;
};

const DEFAULT_LOSS_MESSAGE =
  "Your space isn't published yet. If you leave now, any unpublished changes will be lost.";
const DEFAULT_SAVE_MESSAGE =
  "Your progress will be saved to Listings so you can come back and finish this space later.";

export function useExitListingFlowConfirm() {
  const [state, setState] = useState<ExitConfirmState>({
    visible: false,
    canSave: false,
    message: undefined,
    onConfirm: () => {},
  });

  const presentExitConfirm = useCallback((options: ExitConfirmOptions) => {
    setState({
      visible: true,
      ...options,
    });
  }, []);

  const close = useCallback(() => {
    setState((current) => ({ ...current, visible: false }));
  }, []);

  const handleConfirm = useCallback(async () => {
    const action = state.onConfirm;
    close();
    await action();
  }, [close, state]);

  const modal = (
    <ExitListingFlowConfirmModal
      visible={state.visible}
      canSave={state.canSave}
      message={state.message}
      onClose={close}
      onConfirm={handleConfirm}
    />
  );

  return { presentExitConfirm, exitConfirmModal: modal };
}

type ExitListingFlowConfirmModalProps = {
  visible: boolean;
  canSave: boolean;
  message?: string;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
};

function ExitListingFlowConfirmModal({
  visible,
  canSave,
  message,
  onClose,
  onConfirm,
}: ExitListingFlowConfirmModalProps) {
  const insets = useSafeAreaInsets();
  const body = message ?? (canSave ? DEFAULT_SAVE_MESSAGE : DEFAULT_LOSS_MESSAGE);

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.root} pointerEvents="box-none">
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(20, insets.bottom + 8) }]}>
          <View style={styles.handle} />
          <View style={styles.iconRow}>
            <View style={[styles.iconWrap, canSave ? styles.iconWrapSave : styles.iconWrapWarn]}>
              {canSave ? (
                <BookmarkCheck size={19} color={hostFlowColors.accent} strokeWidth={2.2} />
              ) : (
                <TriangleAlert size={18} color={colors.status.pending.text} strokeWidth={2.2} />
              )}
            </View>
          </View>
          <Text style={styles.title}>{canSave ? "Save and leave?" : "Leave setup?"}</Text>
          <Text style={styles.body}>{body}</Text>
          <Pressable style={styles.primaryBtn} onPress={onConfirm}>
            <Text style={styles.primaryBtnText}>{canSave ? "Save to Listings" : "Leave setup"}</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={onClose}>
            <Text style={styles.secondaryBtnText}>Keep editing</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(16, 20, 20, 0.42)",
  },
  sheet: {
    backgroundColor: hostFlowColors.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: hostFlowColors.border,
    paddingHorizontal: 20,
    paddingTop: 12,
    ...hostFlowShadow,
  },
  handle: {
    alignSelf: "center",
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: hostFlowColors.border,
    marginBottom: 18,
  },
  iconRow: {
    alignItems: "center",
    marginBottom: 14,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  iconWrapSave: {
    borderColor: hostFlowColors.accentSoftBorder,
  },
  iconWrapWarn: {
    backgroundColor: colors.status.pending.background,
    borderColor: colors.status.pending.border,
  },
  title: {
    color: hostFlowColors.text,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
    textAlign: "center",
    marginBottom: 8,
  },
  body: {
    color: hostFlowColors.textMuted,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 22,
  },
  primaryBtn: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: hostFlowColors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  primaryBtnText: {
    color: colors.textInverse,
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 16,
    letterSpacing: -0.2,
  },
  secondaryBtn: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: hostFlowColors.border,
    backgroundColor: hostFlowColors.cardBgMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    color: hostFlowColors.text,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15,
    letterSpacing: -0.1,
  },
});
