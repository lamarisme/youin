import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async () => ({
  locale: "en",
  messages: (await import("@youin/i18n/messages/en.json")).default,
}));
