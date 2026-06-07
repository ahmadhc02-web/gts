export const postAndroidNotification = (title: string, message: string) => {
  if (typeof window !== "undefined" && (window as any).Android && typeof (window as any).Android.postNotification === "function") {
    try {
      (window as any).Android.postNotification(title, message);
    } catch (e) {
      console.error("Error posting Android notification", e);
    }
  }
};

export const clearAndroidNotifications = () => {
  if (typeof window !== "undefined" && (window as any).Android && typeof (window as any).Android.clearNotifications === "function") {
    try {
      (window as any).Android.clearNotifications();
    } catch (e) {
      console.error("Error clearing Android notifications", e);
    }
  }
};
