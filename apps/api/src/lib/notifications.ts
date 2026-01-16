import { Expo } from "expo-server-sdk";
import {
  listDueScheduledNotifications,
  listPushTokensByUserIds,
  markScheduledNotificationSent,
} from "./db.js";

const expo = new Expo();

type PushPayload = {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export async function sendPushNotification({ tokens, title, body, data }: PushPayload) {
  if (!tokens.length) return;

  const messages = tokens
    .filter((token) => Expo.isExpoPushToken(token))
    .map((token) => ({
      to: token,
      sound: "default",
      title,
      body,
      data,
    }));

  if (!messages.length) return;

  try {
    if (process.env.PUSH_LOGGING === "true") {
      console.log(`Push send: ${messages.length} message(s)`);
    }
    const tickets = await expo.sendPushNotificationsAsync(messages);
    if (process.env.PUSH_LOGGING === "true") {
      for (const ticket of tickets) {
        if (ticket.status === "error") {
          console.warn("Push ticket error", ticket.message, ticket.details);
        } else {
          console.log("Push ticket ok", ticket.id ?? "no-id");
        }
      }
    }
  } catch (error) {
    console.warn("Push send failed", error);
  }
}

export async function processScheduledNotifications(limit = 50) {
  const due = await listDueScheduledNotifications(limit);
  if (process.env.PUSH_LOGGING === "true") {
    console.log(`Push processor: ${due.length} due`);
  }
  if (!due.length) return 0;

  const userIds = Array.from(new Set(due.map((item) => item.user_id)));
  const tokens = await listPushTokensByUserIds(userIds);
  const tokensByUser = new Map<string, string[]>();
  for (const token of tokens) {
    const list = tokensByUser.get(token.user_id) ?? [];
    list.push(token.expo_token);
    tokensByUser.set(token.user_id, list);
  }

  let sent = 0;
  for (const item of due) {
    const userTokens = tokensByUser.get(item.user_id) ?? [];
    if (userTokens.length) {
      const title =
        item.type === "booking_start_soon"
          ? "Booking starts soon"
          : item.type === "booking_end_soon"
            ? "Booking ending soon"
            : "Leave a review";
      const body =
        item.type === "booking_start_soon"
          ? "Your booking starts in 1 hour."
          : item.type === "booking_end_soon"
            ? "Your booking ends in 30 minutes."
            : "How was your parking? Leave a quick review.";
      await sendPushNotification({
        tokens: userTokens,
        title,
        body,
        data: {
          bookingId: item.booking_id,
          type: item.type,
          ...(item.payload ?? {}),
        },
      });
    }
    await markScheduledNotificationSent(item.id);
    sent += 1;
  }

  if (process.env.PUSH_LOGGING === "true") {
    console.log(`Push processor: sent ${sent}`);
  }
  return sent;
}
