/** User-visible copy from thrown values in client actions. */
export function actionErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return fallback;
}
