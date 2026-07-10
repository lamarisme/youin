export function isExtensionPageSender(
  sender: { id?: string; tab?: unknown; url?: string },
  runtimeId: string,
  extensionUrlPrefix: string
): boolean {
  if (sender.id !== runtimeId || sender.tab) return false
  return Boolean(sender.url?.startsWith(extensionUrlPrefix))
}
