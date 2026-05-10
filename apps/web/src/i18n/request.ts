import { getRequestConfig } from "next-intl/server";

import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (
    locale == null ||
    !(routing.locales as readonly string[]).includes(locale)
  ) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import("@youin/i18n/messages/en.json")).default,
  };
});
