import "./globals.css"
import { useEffect, useState } from "react"

import { getWidgetSettings, setWidgetSettings } from "./lib/storage"

function IndexPopup() {
  const [fabHidden, setFabHidden] = useState(false)

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
      }
    }
    chrome.storage.onChanged.addListener(onStorage)
    return () => {
      cancelled = true
      chrome.storage.onChanged.removeListener(onStorage)
    }
  }, [])

  return (
    <main className="box-border min-w-[240px] px-4 pb-3.5 pt-3.5 text-[12px] font-medium leading-[1.45] text-ink-2 bg-paper font-sans antialiased">
      <h1 className="mb-1.5 text-[13px] font-semibold tracking-[-0.02em] text-ink">
        Youin
      </h1>
      <p className="text-ink-2">
        On any page, press{" "}
        <kbd className="me-px inline-flex rounded-[3px] border border-rule bg-paper-3 px-[5px] py-px font-mono text-[10px] font-semibold leading-none text-ink">
          ⌥
        </kbd>
        <kbd className="me-px inline-flex rounded-[3px] border border-rule bg-paper-3 px-[5px] py-px font-mono text-[10px] font-semibold leading-none text-ink">
          ⇧
        </kbd>
        <kbd className="inline-flex rounded-[3px] border border-rule bg-paper-3 px-[5px] py-px font-mono text-[10px] font-semibold leading-none text-ink">
          Y
        </kbd>{" "}
        to start capturing.
      </p>
      {fabHidden ? (
        <p className="mt-3 border-t border-rule pt-3 text-[11px] leading-snug text-ink-3">
          The on-page button is off.{" "}
          <button
            type="button"
            className="border-0 bg-transparent p-0 font-medium text-mark underline decoration-mark/30 underline-offset-2 outline-none hover:decoration-mark"
            onClick={() => {
              void setWidgetSettings({ fabVisible: true })
              setFabHidden(false)
            }}>
            Show on-page button
          </button>
        </p>
      ) : null}
    </main>
  )
}

export default IndexPopup
