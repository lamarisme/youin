export type PageSearchParams = Record<string, string | string[] | undefined>;

export function pageSearchParamsToUrlSearchParams(
  searchParams: PageSearchParams,
): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else if (typeof value === "string") {
      params.set(key, value);
    }
  }

  return params;
}
