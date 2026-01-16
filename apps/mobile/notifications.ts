import { Asset } from "expo-asset";
import type { NotificationContentInput } from "expo-notifications";

let cachedNotificationImageUri: string | null = null;

export async function getNotificationImageAttachment(): Promise<
  NotificationContentInput["attachments"]
> {
  if (cachedNotificationImageUri) {
    return [{ identifier: "red_car", url: cachedNotificationImageUri }];
  }

  const asset = Asset.fromModule(require("./assets/red_car.png"));
  await asset.downloadAsync();
  cachedNotificationImageUri = asset.localUri ?? asset.uri ?? null;
  if (!cachedNotificationImageUri) return [];

  return [{ identifier: "red_car", url: cachedNotificationImageUri }];
}
