import "./globals.css"
import { useEffect, useState } from "react"

import { getWidgetSettings, setWidgetSettings } from "./lib/storage"

function IndexPopup() {
  const [fabHidden, setFabHidden] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void getWidgetSettings().then((s) => {
      if (!cancelled) setFabHidden(!s.fabVisible)
    })
    const onStorage: Parameters<
      typeof chrome.storage.onChanged.addListener
    >[0] = (changes, area) => {
      if (area !== "local" || !changes["youin:widget-settings"]?.newValue) {
        return
      }
      const v = changes["youin:widget-settings"].newValue as {
        fabVisible?: boolean
      }
      if (typeof v.fabVisible === "boolean") {
        setFabHidden(!v.fabVisible)
        if (v.fabVisible) setSettingsError(null)
      }
    }
    chrome.storage.onChanged.addListener(onStorage)
    return () => {
      cancelled = true
      chrome.storage.onChanged.removeListener(onStorage)
    }
  }, [])

  return (
    <main className="flex min-w-0 max-w-[320px] flex-col gap-4 bg-paper px-4 py-4 font-sans text-[12px] font-medium leading-[1.45] text-ink-2 antialiased [overflow-wrap:anywhere]">
      <header>
        <h1 className="text-[15px] font-semibold tracking-[-0.02em] text-ink">
          Youin
        </h1>
        <p className="mt-2 text-ink-2">
          Press{" "}
          <kbd className="me-px inline-flex rounded-[3px] border border-rule bg-paper-3 px-[5px] py-px font-mono text-[10px] font-semibold leading-none text-ink">
            ⌥
          </kbd>
          <kbd className="me-px inline-flex rounded-[3px] border border-rule bg-paper-3 px-[5px] py-px font-mono text-[10px] font-semibold leading-none text-ink">
            ⇧
          </kbd>
          <kbd className="inline-flex rounded-[3px] border border-rule bg-paper-3 px-[5px] py-px font-mono text-[10px] font-semibold leading-none text-ink">
            Y
          </kbd>{" "}
          to capture.
        </p>
      </header>
      {fabHidden ? (
        <>
          <div className="border-t border-rule pt-4">
            <p className="text-[11px] leading-snug text-ink-3">
              Floating button off.{" "}
              <button
                type="button"
                aria-label="Show floating button on pages"
                className="rounded-sm border-0 bg-transparent p-0 font-medium text-mark underline decoration-mark/30 underline-offset-2 outline-none transition-colors hover:decoration-mark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mark/35"
                onClick={() => {
                  void (async () => {
                    const { saved } = await setWidgetSettings({ fabVisible: true })
                    if (saved) {
                      setFabHidden(false)
                      setSettingsError(null)
                    } else {
                      setSettingsError("Could not save. Try again.")
                    }
                  })()
                }}>
                Show
              </button>
            </p>
            {settingsError ? (
              <p
                role="alert"
                aria-live="polite"
                className="mt-3 rounded-[var(--yi-radius-md)] border border-mark/25 bg-mark-soft/50 px-2.5 py-2 text-[11px] leading-snug text-ink">
                {settingsError}
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </main>
  )
}

export default IndexPopup
