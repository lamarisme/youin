import "./globals.css"

function IndexPopup() {
  return (
    <main className="box-border min-w-[240px] px-4 pb-3.5 pt-3.5 text-[12px] font-medium leading-[1.45] text-ink-2 bg-paper font-sans antialiased">
      <h1 className="mb-1.5 text-[13px] font-semibold tracking-[-0.02em] text-ink">
        Youin
      </h1>
      <p>
        On any page:{" "}
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
    </main>
  )
}

export default IndexPopup
