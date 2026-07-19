import { t } from "@youin/i18n/t"
import tailwindCss from "data-text:~/globals.css"
import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import { useCallback, useEffect, useRef, useState } from "react"

import { getSession } from "../lib/auth"
import {
  deliverCapture,
  ensureCapturePanelBridgeListeners,
  isCapturePanelHandlerReady,
  registerCaptureHandler,
  registerCaptureUpdateHandler
} from "../lib/capture-panel-bridge"
import type { ElementDomSnapshot } from "../lib/dom-snapshot"
import {
  EVENT_REVIEW_OPEN_MARK,
  EVENT_REVIEW_OPEN_PAGE_MARKS,
  EVENT_REVIEW_PAUSE,
  EVENT_REVIEW_RESUME,
  EVENT_REVIEW_START,
  EVENT_REVIEW_TOGGLE_FEEDBACK_LIST,
  MESSAGE_OPEN_CAPTURE_PANEL,
  MESSAGE_REVIEW_PING_CAPTURE_PANEL,
  MESSAGE_REVIEW_PING_CAPTURE_PANEL_READY,
  MESSAGE_TOGGLE_FEEDBACK_LIST,
  type OpenMarkDetail,
  type ReviewCaptureDetail,
  type ReviewStartDetail
} from "../lib/events"
import {
  dispatchInternalEvent,
  getInternalEventDetail,
  isInternalEvent
} from "../lib/internal-events"
import { EXTENSION_LAYER } from "../lib/layers"
import { scrollElementPinIntoView } from "../lib/mark-health"
import { normalizePageUrlForMatch } from "../lib/page-url"
import {
  createPinModel,
  isElementPinModel,
  isPageAnchoredPinModel,
  type ElementPinModel
} from "../lib/pin-model"
import { createPinRuntime } from "../lib/pin-runtime"
import {
  addMarkWithFallback,
  appendThreadComment,
  enqueueMarkSyncOp,
  filterMarksForWorkspaceView,
  getActiveProjectId,
  getMarks,
  getMarksForPage,
  getProjects,
  getSyncStatus,
  getWidgetSettings,
  getWorkspaceViews,
  isHostDisabled,
  KEY_ACTIVE_PROJECT,
  KEY_DATA_SCOPE,
  KEY_MARKS,
  KEY_PROJECTS,
  KEY_SYNC_STATUS,
  KEY_WIDGET_SETTINGS,
  KEY_WORKSPACE_VIEWS,
  makeMarkId,
  markSyncFailure,
  patchMark,
  removeMark,
  removeMarkSyncOp,
  restoreMark,
  setActiveProjectId,
  STORAGE_LIMITS,
  type Mark,
  type MarkPriority,
  type MarkStatus,
  type Project,
  type SyncStatus,
  type WorkspaceView
} from "../lib/storage"
import { WEB_APP_URL } from "../lib/supabase"
import {
  pushMarkCommentToWorkspace,
  pushMarkEditToWorkspace,
  pushMarkStatusToWorkspace,
  pushMarkToWorkspace,
  syncPendingMarksToWorkspace
} from "../lib/sync"
import { createViewportLayerStyle } from "../lib/viewport-layer"

export const config: PlasmoCSConfig = {
  matches: ["http://*/*", "https://*/*"],
  run_at: "document_idle",
  all_frames: false
}

const Z_PANEL = EXTENSION_LAYER.panel
const Z_MODAL = EXTENSION_LAYER.modal

export const getStyle: PlasmoGetStyle = () => {
  return createViewportLayerStyle(tailwindCss, Z_PANEL)
}

ensureCapturePanelBridgeListeners()

declare global {
  interface Window {
    __youinCapturePanelMessageListener?: boolean
  }
}

if (!window.__youinCapturePanelMessageListener) {
  window.__youinCapturePanelMessageListener = true
  chrome.runtime.onMessage.addListener(
    (msg: unknown, _sender, sendResponse) => {
      if (!msg || typeof msg !== "object") return false
      const t = (msg as { type?: string }).type
      if (t === MESSAGE_REVIEW_PING_CAPTURE_PANEL) {
        sendResponse({ ok: true })
        return true
      }
      if (t === MESSAGE_REVIEW_PING_CAPTURE_PANEL_READY) {
        sendResponse({ ok: isCapturePanelHandlerReady() })
        return true
      }
      if (t === MESSAGE_OPEN_CAPTURE_PANEL) {
        const detail = (msg as { detail?: ReviewCaptureDetail }).detail
        if (detail) deliverCapture(detail)
        sendResponse({ ok: true })
        return true
      }
      if (t === MESSAGE_TOGGLE_FEEDBACK_LIST) {
        dispatchInternalEvent(EVENT_REVIEW_TOGGLE_FEEDBACK_LIST)
        sendResponse({ ok: true })
        return true
      }
      return false
    }
  )
}

type PanelMode = "create" | "list" | "thread"

type UndoAction =
  | { kind: "created"; mark: Mark; message: string }
  | { kind: "deleted"; mark: Mark; message: string }

function truncateMiddle(s: string, max: number): string {
  if (s.length <= max) return s
  const half = Math.floor((max - 1) / 2)
  return `${s.slice(0, half)}…${s.slice(s.length - half)}`
}

function truncateEnd(s: string, max: number): string {
  if (s.length <= max) return s
  return `${s.slice(0, Math.max(0, max - 1))}…`
}

function formatShortDate(ts: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year:
        new Date(ts).getFullYear() !== new Date().getFullYear()
          ? "numeric"
          : undefined
    }).format(new Date(ts))
  } catch {
    return new Date(ts).toLocaleDateString()
  }
}

function timeAgo(ts: number): string {
  const diff = Math.max(0, Date.now() - ts)
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "now"
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function markPreview(mark: Mark): string {
  return mark.thread[0]?.body || mark.title || "Untitled feedback"
}

function markSyncLabel(mark: Mark): string {
  if (mark.syncState === "failed") return t("extension.panel.syncFailed")
  if (mark.syncState === "pending") return t("extension.panel.pending")
  return t("extension.popup.badgeSynced")
}

function markHealthLabel(label: string): string {
  if (label === "Attached") return t("extension.panel.attached")
  if (label === "Approximate") return t("extension.panel.approximate")
  if (label === "Stale") return t("extension.panel.stale")
  if (label === "Screenshot") return t("extension.panel.screenshotOnly")
  return label
}

function makeThreadMessageId(): string {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function titleFromBody(body: string): string {
  const firstLine = body.trim().split(/\n+/)[0]?.trim() ?? ""
  if (!firstLine) return "Untitled mark"
  return firstLine.length > 96 ? `${firstLine.slice(0, 93)}...` : firstLine
}

function buildMarkFromCapture(
  detail: ReviewCaptureDetail,
  projectId: string,
  body: string,
  priority: MarkPriority
): Mark {
  const raw = normalizePageUrlForMatch(detail.url) || detail.url
  let origin = ""
  let pathname = ""
  let href = raw
  try {
    const u = new URL(raw)
    origin = u.origin
    pathname = `${u.pathname}${u.search}`
    href = u.href
  } catch {
    origin = ""
    pathname = ""
  }
  const now = Date.now()
  return {
    id: makeMarkId(),
    projectId,
    url: href,
    pageTitle: detail.pageTitle,
    elementFingerprint: detail.elementFingerprint,
    origin,
    pathname,
    selector: detail.selector,
    strategy: detail.strategy,
    captureKind: detail.captureKind ?? "element",
    bbox: detail.bbox,
    viewport: detail.viewport,
    title: titleFromBody(body).slice(0, STORAGE_LIMITS.markTitle),
    thread: [
      {
        id: makeThreadMessageId(),
        body: body.trim().slice(0, STORAGE_LIMITS.threadBody),
        createdAt: now,
        authorLabel: "You"
      }
    ],
    status: "open",
    priority,
    createdAt: now,
    updatedAt: now,
    outerHTMLPreview:
      typeof detail.outerHTML === "string"
        ? detail.outerHTML.slice(0, STORAGE_LIMITS.outerHTMLPreview)
        : "",
    domSnapshot: detail.domSnapshot,
    screenshotDataUrl: detail.elementScreenshotDataUrl
  }
}

function buildAiPromptFromMark(mark: Mark): string {
  const selected = mark.domSnapshot?.selectedElement
  const context = mark.domSnapshot?.context
  const outerHTML =
    selected?.outerHTML?.slice(0, 2200) || mark.outerHTMLPreview?.slice(0, 2200)
  const visibleText = [
    selected?.textContent?.slice(0, 700),
    context?.nearbyText?.slice(0, 900)
  ]
    .filter(Boolean)
    .join("\n\n")
  const screenshot =
    mark.screenshotUrl ||
    (mark.screenshotDataUrl ? "Captured locally in YouIn." : "Not captured")
  const comments = mark.thread.length
    ? mark.thread
        .slice(0, 12)
        .map(
          (message, index) =>
            `${index + 1}. ${message.authorLabel}: ${message.body.slice(
              0,
              900
            )}`
        )
        .join("\n")
    : "No comments yet."
  const viewport = mark.viewport
    ? `${mark.viewport.width}x${mark.viewport.height}@${mark.viewport.dpr}`
    : "Not captured"

  return [
    "You are Codex, an AI coding agent working in this repository.",
    "",
    "Use the YouIn mark context below to implement the requested UI change. Start by locating the relevant page/component, then make the smallest high-quality code change that resolves the mark. Preserve existing project patterns.",
    "",
    "## Mark",
    `- Title: ${mark.title}`,
    `- Status: ${mark.status}`,
    `- Priority: ${mark.priority}`,
    `- Page URL: ${mark.url}`,
    `- Page title: ${mark.pageTitle || "Not captured"}`,
    "",
    "## Requested Change",
    mark.thread[0]?.body || mark.title,
    "",
    "## Page Context",
    `- DOM selector: ${mark.selector || "Not captured"}`,
    `- Selector strategy: ${mark.strategy || "Not captured"}`,
    `- Viewport: ${viewport}`,
    `- Screenshot: ${screenshot}`,
    "",
    "## Discussion",
    comments,
    visibleText ? `\n## Visible Text\n${visibleText}` : "",
    outerHTML
      ? `\n## Selected Element DOM\n\`\`\`html\n${outerHTML}\n\`\`\``
      : "",
    "",
    "## Output Expectations",
    "- Explain the relevant files you changed.",
    "- Keep the implementation scoped to this mark.",
    "- Run or suggest the narrowest useful verification command.",
    "- Call out any missing context if the selector or screenshot is stale."
  ]
    .filter(Boolean)
    .join("\n")
}

const btnPrimary =
  "flex w-full cursor-pointer items-center justify-center rounded-md border border-[color:var(--yi-ext-btn-primary-bg)] bg-[color:var(--yi-ext-btn-primary-bg)] px-3 py-2 text-[13px] font-semibold text-[color:var(--yi-ext-btn-primary-text)] outline-none transition-[background-color,border-color,transform] duration-150 [transition-timing-function:var(--yi-ease-out-expo)] hover:border-[color:var(--yi-ext-btn-primary-hover)] hover:bg-[color:var(--yi-ext-btn-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)] motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.99] motion-reduce:active:scale-100"

const btnGhost =
  "flex w-full cursor-pointer items-center justify-center rounded-md border border-[color:var(--yi-ext-border)] bg-[color:var(--yi-ext-surface-input)] px-3 py-2 text-[12.5px] font-semibold text-[color:var(--yi-ext-text-soft)] outline-none transition-[background-color,border-color,color] motion-reduce:transition-none hover:border-[color:var(--yi-ext-border-strong)] hover:bg-[color:var(--yi-ext-surface-hover)] active:bg-[color:var(--yi-ext-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)]"

const fieldLabel =
  "mb-1.5 block text-[10px] font-semibold uppercase text-[color:var(--yi-ext-text-label)]"

const selectCls =
  "youin-input box-border min-h-9 w-full cursor-pointer rounded-md px-2.5 py-1.5 text-[13px] text-[color:var(--yi-ext-text)] outline-none"

const headerCloseBtn =
  "flex min-h-10 min-w-10 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-[color:var(--yi-ext-text-muted)] outline-none hover:bg-[color:var(--yi-ext-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)]"

const rowIconBtn =
  "inline-flex size-8 items-center justify-center rounded-md text-[color:var(--yi-ext-text-muted)] outline-none hover:bg-[color:var(--yi-ext-surface-hover)] hover:text-[color:var(--yi-ext-text-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)] disabled:opacity-50"

const rowDangerIconBtn =
  "inline-flex size-8 items-center justify-center rounded-md text-[color:var(--yi-ext-danger-text)] outline-none hover:bg-[color:var(--yi-ext-danger-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)] disabled:opacity-50"

const threadBadge =
  "inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[10px] font-semibold leading-none whitespace-nowrap"

const SENSITIVE_DISPLAY_ATTR_RE =
  /(?:token|secret|password|passwd|pwd|auth|session|cookie|csrf|jwt|key|credential|private)/i
const DISPLAY_EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const DISPLAY_TOKEN_RE =
  /\b(?:sk-[A-Za-z0-9_-]{20,}|[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}|[A-Fa-f0-9]{32,})\b/g

type DomStrategy = ReviewCaptureDetail["strategy"]

interface DomPreviewNode {
  parentLabel?: string
  selectedLabel: string
  childLabels: string[]
  hiddenChildCount: number
}

function threadHealthBadgeClass(label: string): string {
  if (label === "Attached")
    return "bg-[color:var(--yi-ok-soft)] text-[color:var(--yi-ok)]"
  if (label === "Approximate")
    return "bg-[color:var(--yi-warn-soft)] text-[color:var(--yi-warn)]"
  if (label === "Stale")
    return "bg-[color:var(--yi-ext-surface-stat)] text-[color:var(--yi-ext-text-muted)]"
  return "bg-[color:var(--yi-info-soft)] text-[color:var(--yi-info)]"
}

function SyncStatusNotice({ status }: { status: SyncStatus }) {
  if (status.state !== "failed" && status.state !== "syncing") return null
  const isFailed = status.state === "failed"
  return (
    <p
      role={isFailed ? "alert" : "status"}
      aria-live="polite"
      className={`mx-4 mb-2 rounded-[var(--yi-radius-md)] border px-3 py-2 text-[11px] leading-snug ${
        isFailed
          ? "border-[color:var(--yi-ext-danger-border)] bg-[color:var(--yi-ext-danger-bg)] text-[color:var(--yi-ext-danger-text)]"
          : "border-[color:var(--yi-ext-border-hairline)] bg-[color:var(--yi-ext-surface-stat)] text-[color:var(--yi-ext-text-muted)]"
      }`}>
      {isFailed
        ? status.lastError || t("extension.popup.syncFailed")
        : t("extension.popup.syncingWorkspace")}
    </p>
  )
}

function CheckCircleIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      aria-hidden="true">
      <circle cx="10" cy="10" r="6.5" />
      <path d="m7.2 10.2 1.8 1.8 3.8-4" />
    </svg>
  )
}

function CircleDashedIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      aria-hidden="true">
      <path d="M5.4 5.7A6.5 6.5 0 0 1 8 3.9" />
      <path d="M12 3.9a6.5 6.5 0 0 1 2.6 1.8" />
      <path d="M16.3 9a6.5 6.5 0 0 1-.8 3.1" />
      <path d="M13 15.8a6.5 6.5 0 0 1-3 .7" />
      <path d="M6.9 15.2a6.5 6.5 0 0 1-1.8-2.5" />
      <path d="M3.6 9.2a6.5 6.5 0 0 1 .6-2" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      aria-hidden="true">
      <path d="M4.5 6h11" />
      <path d="M8.2 6V4.5h3.6V6" />
      <path d="M6.4 6.8 7 15.2h6l.6-8.4" />
      <path d="M8.8 9v4M11.2 9v4" />
    </svg>
  )
}

function MaximizeIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      aria-hidden="true">
      <path d="M7.5 4.5h-3v3M4.5 4.5l4.1 4.1" />
      <path d="M12.5 15.5h3v-3M15.5 15.5l-4.1-4.1" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      aria-hidden="true">
      <path d="m12.8 4.7 2.5 2.5" />
      <path d="M5.2 14.8h2.5l7-7a1.8 1.8 0 0 0-2.5-2.5l-7 7z" />
    </svg>
  )
}

function ArrowLeftIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      aria-hidden="true">
      <path d="M12.5 5.5 8 10l4.5 4.5" />
      <path d="M8.5 10H16" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.8"
      aria-hidden="true">
      <path d="m6 6 8 8M14 6l-8 8" />
    </svg>
  )
}

function DashboardPageIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-3"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.4"
      aria-hidden="true">
      <rect x="2.25" y="2.75" width="11.5" height="10.5" rx="1.5" />
      <path d="M2.75 6h10.5M6 6v6.75" />
    </svg>
  )
}

function DashboardPageIndicator() {
  return (
    <span
      className={`${threadBadge} gap-1 bg-[color:var(--yi-ext-surface-stat)] text-[color:var(--yi-ext-text-muted)]`}>
      <DashboardPageIcon />
      {t("extension.drawer.dashboardPageLevel")}
    </span>
  )
}

function PageFeedbackRow({
  mark,
  disabled,
  pendingDeleteMarkId,
  onOpen,
  onStatus,
  onDelete,
  onConfirmDelete,
  onCancelDelete
}: {
  mark: Mark
  disabled?: boolean
  pendingDeleteMarkId: string | null
  onOpen: (mark: Mark) => void
  onStatus: (mark: Mark, status: MarkStatus) => void
  onDelete: (mark: Mark) => void
  onConfirmDelete: (mark: Mark) => void
  onCancelDelete: () => void
}) {
  const runtime = createPinRuntime(createPinModel(mark))
  const image = mark.screenshotUrl ?? mark.screenshotDataUrl
  const closed = mark.status === "closed"
  const syncFailed = mark.syncState === "failed"
  const isConfirmingDelete = pendingDeleteMarkId === mark.id

  return (
    <li className="overflow-hidden rounded-[var(--yi-radius-lg)] bg-[color:var(--yi-ext-surface-low)] ring-1 ring-[color:var(--yi-ext-border-hairline)]">
      <button
        type="button"
        className="grid w-full grid-cols-[minmax(0,1fr)_3.25rem] gap-3 border-0 bg-transparent p-3 text-left outline-none transition-colors duration-150 hover:bg-[color:var(--yi-ext-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)]"
        onClick={() => onOpen(mark)}>
        <span className="min-w-0">
          <span className="block truncate text-[12.5px] font-semibold leading-snug text-[color:var(--yi-ext-text-title)]">
            {mark.title}
          </span>
          <span className="mt-1 line-clamp-2 block text-[11px] leading-snug text-[color:var(--yi-ext-text-muted)]">
            {markPreview(mark)}
          </span>
          <span className="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              className={`${threadBadge} ${
                closed
                  ? "bg-[color:var(--yi-ok-soft)] text-[color:var(--yi-ok)]"
                  : "bg-[color:var(--yi-mark-soft)] text-[color:var(--yi-mark)]"
              }`}>
              {closed
                ? t("extension.panel.resolved")
                : t("extension.panel.open")}
            </span>
            {runtime.kind === "page" ? (
              <DashboardPageIndicator />
            ) : (
              <span
                className={`${threadBadge} ${threadHealthBadgeClass(runtime.health.label)}`}>
                {markHealthLabel(runtime.health.label)}
              </span>
            )}
            <span
              className={`${threadBadge} ${
                syncFailed
                  ? "bg-[color:var(--yi-ext-danger-bg)] text-[color:var(--yi-ext-danger-text)]"
                  : "bg-[color:var(--yi-ext-surface-stat)] text-[color:var(--yi-ext-text-muted)]"
              }`}>
              {markSyncLabel(mark)}
            </span>
            <span className="text-[10px] leading-5 text-[color:var(--yi-ext-text-placeholder)]">
              {timeAgo(mark.updatedAt)}
            </span>
          </span>
        </span>
        <span className="flex h-[3.25rem] min-h-[3.25rem] w-[3.25rem] min-w-[3.25rem] overflow-hidden rounded-md bg-[color:var(--yi-ext-surface-shade)] ring-1 ring-[color:var(--yi-ext-border-hairline)]">
          {image ? (
            <img
              src={image}
              alt=""
              className="h-full w-full object-cover object-top"
            />
          ) : (
            <span className="m-auto size-2 rounded-full bg-[color:var(--yi-ext-text-placeholder)]" />
          )}
        </span>
      </button>
      <div className="flex min-h-10 items-center justify-end gap-1 border-t border-[color:var(--yi-ext-border-hairline)] px-2 py-1.5">
        {isConfirmingDelete ? (
          <div className="flex w-full flex-wrap items-center justify-end gap-1">
            <span className="me-auto text-[10px] text-[color:var(--yi-ext-text-muted)]">
              {t("extension.drawer.confirmDeleteTitle")}
            </span>
            <button
              type="button"
              className="inline-flex min-h-8 items-center rounded-md px-2 text-[11px] font-semibold text-[color:var(--yi-ext-text-muted)] outline-none hover:bg-[color:var(--yi-ext-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)]"
              onClick={onCancelDelete}>
              {t("extension.drawer.cancel")}
            </button>
            <button
              type="button"
              disabled={disabled}
              className="inline-flex min-h-8 items-center rounded-md px-2 text-[11px] font-semibold text-[color:var(--yi-ext-danger-text)] outline-none hover:bg-[color:var(--yi-ext-danger-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)] disabled:opacity-50"
              onClick={() => onConfirmDelete(mark)}>
              {t("extension.drawer.confirmDelete")}
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              disabled={disabled}
              className={rowIconBtn}
              aria-label={
                closed
                  ? t("extension.drawer.reopen")
                  : t("extension.drawer.resolve")
              }
              title={
                closed
                  ? t("extension.drawer.reopen")
                  : t("extension.drawer.resolve")
              }
              onClick={() => onStatus(mark, closed ? "open" : "closed")}>
              {closed ? <CircleDashedIcon /> : <CheckCircleIcon />}
            </button>
            <button
              type="button"
              disabled={disabled}
              className={rowDangerIconBtn}
              aria-label={t("extension.drawer.delete")}
              title={t("extension.drawer.delete")}
              onClick={() => onDelete(mark)}>
              <TrashIcon />
            </button>
          </>
        )}
      </div>
    </li>
  )
}

function confidenceForStrategy(strategy: DomStrategy): {
  label: string
  className: string
  description: string
} {
  if (strategy === "test-id" || strategy === "id") {
    return {
      label: "Stable",
      className: "bg-[color:var(--yi-ok-soft)] text-[color:var(--yi-ok)]",
      description: "Unique stable attribute"
    }
  }
  if (strategy === "aria") {
    return {
      label: "Readable",
      className: "bg-[color:var(--yi-info-soft)] text-[color:var(--yi-info)]",
      description: "Unique accessibility attribute"
    }
  }
  return {
    label: "Fragile",
    className: "bg-[color:var(--yi-warn-soft)] text-[color:var(--yi-warn)]",
    description: "Generated DOM path"
  }
}

function sanitizeDisplayAttribute(name: string, value: string): string {
  if (
    SENSITIVE_DISPLAY_ATTR_RE.test(name) ||
    name.toLowerCase().startsWith("on")
  ) {
    return "[redacted]"
  }
  return truncateEnd(
    value
      .replace(DISPLAY_EMAIL_RE, "[redacted-email]")
      .replace(DISPLAY_TOKEN_RE, "[redacted-token]")
      .replace(/\s+/g, " ")
      .trim(),
    64
  )
}

function attrsFromElement(el: Element | null): Record<string, string> {
  if (!el) return {}
  const attrs: Record<string, string> = {}
  for (const attr of Array.from(el.attributes)) {
    attrs[attr.name] = sanitizeDisplayAttribute(attr.name, attr.value)
  }
  return attrs
}

function parseFirstElement(html?: string): Element | null {
  if (!html?.trim()) return null
  const template = document.createElement("template")
  template.innerHTML = html.trim()
  return template.content.firstElementChild
}

function labelFromParts(
  tagName: string,
  attrs: Record<string, string>
): string {
  const tag = tagName.toLowerCase() || "element"
  const id = attrs.id && attrs.id !== "[redacted]" ? `#${attrs.id}` : ""
  const className = attrs.class ?? attrs.className ?? ""
  const classes =
    className && className !== "[redacted]"
      ? `.${className.trim().split(/\s+/).filter(Boolean).slice(0, 3).join(".")}`
      : ""
  return truncateEnd(`${tag}${id}${classes}`, 72)
}

function labelFromElement(el: Element): string {
  return labelFromParts(el.tagName.toLowerCase(), attrsFromElement(el))
}

function snapshotAttributes(
  snapshot?: ElementDomSnapshot
): Record<string, string> {
  if (!snapshot) return {}
  const attrs = { ...snapshot.selectedElement.attributes }
  if (snapshot.selectedElement.id && !attrs.id)
    attrs.id = snapshot.selectedElement.id
  if (snapshot.selectedElement.className && !attrs.class) {
    attrs.class = snapshot.selectedElement.className
  }
  if (snapshot.selectedElement.role && !attrs.role)
    attrs.role = snapshot.selectedElement.role
  if (snapshot.selectedElement.ariaLabel && !attrs["aria-label"]) {
    attrs["aria-label"] = snapshot.selectedElement.ariaLabel
  }
  return attrs
}

function prioritizedAttributeEntries(
  attrs: Record<string, string>
): Array<[string, string]> {
  const priority = ["id", "class", "role", "aria-label", "type", "name", "href"]
  const entries = Object.entries(attrs)
    .filter(([name]) => !name.toLowerCase().startsWith("style"))
    .map(
      ([name, value]) =>
        [name, sanitizeDisplayAttribute(name, value)] as [string, string]
    )
  const score = (name: string) => {
    const index = priority.indexOf(name)
    if (index >= 0) return index
    if (name.startsWith("data-")) return priority.length
    return priority.length + 1
  }
  return entries
    .sort((a, b) => score(a[0]) - score(b[0]) || a[0].localeCompare(b[0]))
    .slice(0, 8)
}

function buildDomPreviewNode(
  snapshot?: ElementDomSnapshot,
  outerHTML?: string
): DomPreviewNode | null {
  const parsed = parseFirstElement(
    snapshot?.selectedElement.outerHTML ?? outerHTML
  )
  const attrs = snapshot
    ? snapshotAttributes(snapshot)
    : attrsFromElement(parsed)
  const selectedLabel = snapshot
    ? labelFromParts(snapshot.selectedElement.tagName, attrs)
    : parsed
      ? labelFromElement(parsed)
      : ""
  if (!selectedLabel) return null

  const childLabels = parsed
    ? Array.from(parsed.children)
        .slice(0, 5)
        .map((child) => labelFromElement(child))
    : []
  const hiddenChildCount = parsed
    ? Math.max(0, parsed.children.length - childLabels.length)
    : 0
  const ancestors = snapshot?.context?.ancestorPath ?? []
  const parentLabel =
    ancestors.length >= 2 ? ancestors[ancestors.length - 2] : undefined
  return { parentLabel, selectedLabel, childLabels, hiddenChildCount }
}

function breadcrumbParts(
  snapshot: ElementDomSnapshot | undefined,
  selector: string
): string[] {
  const fromSnapshot = snapshot?.context?.ancestorPath?.filter(Boolean)
  if (fromSnapshot?.length) return fromSnapshot.slice(-6)
  return selector
    .split(">")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(-5)
}

function flashSelection(selector: string, bbox?: Mark["bbox"]): boolean {
  let element: Element | null = null
  try {
    element = selector ? document.querySelector(selector) : null
  } catch {
    element = null
  }

  if (element) {
    element.scrollIntoView({
      block: "center",
      inline: "center",
      behavior: "smooth"
    })
  } else if (bbox && bbox.width > 0 && bbox.height > 0) {
    window.scrollTo({
      left: Math.max(0, bbox.x - window.innerWidth / 2),
      top: Math.max(0, bbox.y - window.innerHeight / 2),
      behavior: "smooth"
    })
  } else {
    return false
  }

  window.setTimeout(() => {
    const rect = element
      ? element.getBoundingClientRect()
      : bbox
        ? new DOMRect(
            bbox.x - window.scrollX,
            bbox.y - window.scrollY,
            bbox.width,
            bbox.height
          )
        : null
    if (!rect || rect.width < 1 || rect.height < 1) return
    const marker = document.createElement("div")
    Object.assign(marker.style, {
      position: "fixed",
      left: `${Math.max(0, rect.left)}px`,
      top: `${Math.max(0, rect.top)}px`,
      width: `${Math.max(1, rect.width)}px`,
      height: `${Math.max(1, rect.height)}px`,
      boxSizing: "border-box",
      border: "2px solid oklch(56.74% 0.1585 275.21)",
      borderRadius: "8px",
      background: "oklch(56.74% 0.1585 275.21 / 0.08)",
      boxShadow: "0 0 0 9999px oklch(18% 0.012 264 / 0.16)",
      pointerEvents: "none",
      zIndex: String(Z_PANEL - 1),
      transition: "opacity 220ms ease"
    })
    document.body.append(marker)
    window.setTimeout(() => {
      marker.style.opacity = "0"
      window.setTimeout(() => marker.remove(), 240)
    }, 1050)
  }, 220)

  return true
}

async function copyTextToClipboard(value: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return
    }
  } catch {
    /* fall back to a transient textarea below */
  }

  const textarea = document.createElement("textarea")
  textarea.value = value
  textarea.setAttribute("readonly", "true")
  Object.assign(textarea.style, {
    position: "fixed",
    left: "-9999px",
    top: "0",
    opacity: "0"
  })
  document.body.append(textarea)
  textarea.select()
  const copied = document.execCommand("copy")
  textarea.remove()
  if (!copied) throw new Error("Copy failed")
}

function CommentComposer({
  id,
  label,
  value,
  placeholder,
  rows,
  invalid,
  disabled,
  submitHint = "Cmd/Ctrl Enter to send",
  onChange,
  onSubmit
}: {
  id: string
  label: string
  value: string
  placeholder: string
  rows: number
  invalid?: boolean
  disabled?: boolean
  submitHint?: string
  onChange: (value: string) => void
  onSubmit?: () => void
}) {
  const trimmed = value.trim()
  const remaining = STORAGE_LIMITS.threadBody - value.length
  const showCount = remaining <= 400

  return (
    <label className="block" htmlFor={id}>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="block text-[10px] font-semibold uppercase text-[color:var(--yi-ext-text-label)]">
          {label}
        </span>
        <span
          className={`text-[10px] ${
            showCount
              ? remaining < 0
                ? "text-[color:var(--yi-ext-danger-text)]"
                : "text-[color:var(--yi-ext-text-muted)]"
              : "text-[color:var(--yi-ext-text-placeholder)]"
          }`}>
          {showCount ? `${Math.max(0, remaining)} left` : submitHint}
        </span>
      </div>
      <textarea
        id={id}
        value={value}
        rows={rows}
        maxLength={STORAGE_LIMITS.threadBody}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (!(e.metaKey || e.ctrlKey) || e.key !== "Enter") return
          if (!trimmed || disabled || !onSubmit) return
          e.preventDefault()
          onSubmit()
        }}
        placeholder={placeholder}
        aria-invalid={invalid ? true : undefined}
        className="youin-input box-border min-h-[var(--composer-min-h,7rem)] w-full resize-y rounded-md px-3 py-2.5 text-[13px] leading-snug text-[color:var(--yi-ext-text)] placeholder:text-[color:var(--yi-ext-text-placeholder)] disabled:cursor-not-allowed disabled:opacity-60"
        style={
          {
            "--composer-min-h": rows <= 3 ? "4.5rem" : "7rem"
          } as React.CSSProperties
        }
      />
    </label>
  )
}

function DomContextPreview({
  snapshot,
  selector,
  strategy,
  bbox,
  outerHTML
}: {
  snapshot?: ElementDomSnapshot
  selector: string
  strategy: DomStrategy
  bbox?: Mark["bbox"]
  outerHTML?: string
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle"
  )
  const [highlightState, setHighlightState] = useState<
    "idle" | "found" | "missing"
  >("idle")
  const node = buildDomPreviewNode(snapshot, outerHTML)
  const attrs = prioritizedAttributeEntries(
    snapshot
      ? snapshotAttributes(snapshot)
      : attrsFromElement(parseFirstElement(outerHTML))
  )
  const confidence = confidenceForStrategy(strategy)
  const breadcrumb = breadcrumbParts(snapshot, selector)

  if (!node && !breadcrumb.length) return null

  const copySelector = async () => {
    try {
      await copyTextToClipboard(selector)
      setCopyState("copied")
    } catch {
      setCopyState("failed")
    }
    window.setTimeout(() => setCopyState("idle"), 1400)
  }

  const highlightSelected = () => {
    const found = flashSelection(selector, bbox)
    setHighlightState(found ? "found" : "missing")
    window.setTimeout(() => setHighlightState("idle"), 1400)
  }

  return (
    <details className="group rounded-[var(--yi-radius-lg)] bg-[color:var(--yi-ext-surface-stat)] ring-1 ring-[color:var(--yi-ext-border-hairline)]">
      <summary className="flex min-h-10 cursor-pointer select-none items-center justify-between gap-3 rounded-[var(--yi-radius-lg)] px-3 text-[11px] font-semibold text-[color:var(--yi-ext-text-muted)] outline-none transition-colors hover:bg-[color:var(--yi-ext-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)] [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2">
          <span>DOM context</span>
          <span
            className={`hidden h-5 shrink-0 items-center rounded-full px-2 text-[10px] font-semibold group-open:inline-flex ${confidence.className}`}
            title={confidence.description}>
            {confidence.label}
          </span>
        </span>
        <span className="text-[10px] font-medium text-[color:var(--yi-ext-text-placeholder)] group-open:hidden">
          Show
        </span>
      </summary>

      <div className="flex flex-col gap-3 px-3 pb-3 pt-2">
        {breadcrumb.length ? (
          <div>
            <span className={fieldLabel}>Breadcrumb</span>
            <div className="flex flex-wrap items-center gap-1 text-[10px] leading-relaxed text-[color:var(--yi-ext-text-muted)]">
              {breadcrumb.map((part, index) => (
                <span
                  key={`${part}-${index}`}
                  className="inline-flex min-w-0 items-center gap-1">
                  {index > 0 ? (
                    <span className="text-[color:var(--yi-ext-text-placeholder)]">
                      /
                    </span>
                  ) : null}
                  <code className="max-w-[14rem] truncate rounded bg-[color:var(--yi-ext-surface-panel)] px-1.5 py-0.5 font-mono text-[10px] text-[color:var(--yi-ext-text-soft)]">
                    {part}
                  </code>
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {node ? (
          <div>
            <span className={fieldLabel}>Element tree</span>
            <div className="rounded-md bg-[color:var(--yi-ext-surface-panel)] px-2.5 py-2 font-mono text-[10px] leading-relaxed text-[color:var(--yi-ext-text-soft)] ring-1 ring-[color:var(--yi-ext-border-hairline)]">
              {node.parentLabel ? (
                <div className="truncate text-[color:var(--yi-ext-text-muted)]">
                  {node.parentLabel}
                </div>
              ) : null}
              <div className="truncate font-semibold text-[color:var(--yi-ext-text-title)]">
                {node.parentLabel ? "└─ " : ""}
                {node.selectedLabel}
              </div>
              {node.childLabels.map((label, index) => (
                <div
                  key={`${label}-${index}`}
                  className="truncate pl-4 text-[color:var(--yi-ext-text-muted)]">
                  └─ {label}
                </div>
              ))}
              {node.hiddenChildCount > 0 ? (
                <div className="pl-4 text-[color:var(--yi-ext-text-placeholder)]">
                  └─ +{node.hiddenChildCount} more
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {attrs.length ? (
          <div>
            <span className={fieldLabel}>Key attributes</span>
            <div className="flex flex-wrap gap-1.5">
              {attrs.map(([name, value]) => (
                <code
                  key={name}
                  className="max-w-full rounded bg-[color:var(--yi-ext-surface-panel)] px-1.5 py-1 font-mono text-[10px] leading-none text-[color:var(--yi-ext-text-soft)] ring-1 ring-[color:var(--yi-ext-border-hairline)] [overflow-wrap:anywhere]">
                  {name}="{value}"
                </code>
              ))}
            </div>
          </div>
        ) : null}

        <div>
          <span className={fieldLabel}>Selector</span>
          <p
            title={selector}
            className="rounded-md bg-[color:var(--yi-ext-surface-panel)] px-2.5 py-2 font-mono text-[10px] leading-snug text-[color:var(--yi-ext-text-muted)] ring-1 ring-[color:var(--yi-ext-border-hairline)] [overflow-wrap:anywhere]">
            {selector}
          </p>
          <p className="mt-1 text-[10px] text-[color:var(--yi-ext-text-placeholder)]">
            {confidence.description}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="min-h-9 rounded-md border border-transparent bg-[color:var(--yi-ext-surface-panel)] px-2 text-[11px] font-semibold text-[color:var(--yi-ext-link)] outline-none transition-colors hover:bg-[color:var(--yi-ext-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)]"
            onClick={() => void copySelector()}>
            {copyState === "copied"
              ? t("extension.panel.selectorCopied")
              : copyState === "failed"
                ? t("extension.panel.promptCopyFailed")
                : t("extension.panel.copySelector")}
          </button>
          <button
            type="button"
            className="min-h-9 rounded-md border border-transparent bg-[color:var(--yi-ext-surface-panel)] px-2 text-[11px] font-semibold text-[color:var(--yi-ext-link)] outline-none transition-colors hover:bg-[color:var(--yi-ext-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)]"
            onClick={highlightSelected}>
            {highlightState === "found"
              ? t("extension.panel.highlighted")
              : highlightState === "missing"
                ? t("extension.panel.notFound")
                : t("extension.panel.highlight")}
          </button>
        </div>
      </div>
    </details>
  )
}

const CapturePanel = () => {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<PanelMode>("create")
  const [capture, setCapture] = useState<ReviewCaptureDetail | null>(null)
  const [viewingMark, setViewingMark] = useState<Mark | null>(null)
  const [pageMarks, setPageMarks] = useState<Mark[]>([])
  const [feedbackListAnchorKind, setFeedbackListAnchorKind] = useState<
    "page" | null
  >(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [workspaceViews, setWorkspaceViews] = useState<WorkspaceView[]>([])
  const [selectedViewId, setSelectedViewId] = useState("all")
  const [projectId, setProjectId] = useState<string>("")
  const [body, setBody] = useState("")
  const [priority, setPriority] = useState<MarkPriority>("medium")
  const [replyDraft, setReplyDraft] = useState("")
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState("")
  const [editBody, setEditBody] = useState("")
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveWarning, setSaveWarning] = useState<string | null>(null)
  const [promptCopyState, setPromptCopyState] = useState<
    "idle" | "copied" | "failed"
  >("idle")
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [returnToList, setReturnToList] = useState(false)
  const [reattachMarkId, setReattachMarkId] = useState<string | null>(null)
  const [pendingListDeleteMarkId, setPendingListDeleteMarkId] = useState<
    string | null
  >(null)
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [syncStatus, setSyncStatusState] = useState<SyncStatus>({
    state: "idle"
  })
  const [fullImage, setFullImage] = useState<{
    src: string
    alt: string
  } | null>(null)

  const panelRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const reattachMarkIdRef = useRef<string | null>(null)
  const reattachCaptureRef = useRef<{
    captureId: string
    markId: string
  } | null>(null)
  const refreshMarksDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  // Prevent a late async open from undoing an immediate drawer close.
  const feedbackListRequestRef = useRef(0)

  useEffect(() => {
    void getSyncStatus().then(setSyncStatusState)
    void getSession().then((session) =>
      setIsSignedIn(Boolean(session?.user?.id))
    )
    const onStorage: Parameters<
      typeof chrome.storage.onChanged.addListener
    >[0] = (changes, area) => {
      if (area !== "local") return
      if (changes["youin:supabase-auth"]) {
        void getSession().then((session) =>
          setIsSignedIn(Boolean(session?.user?.id))
        )
      }
      if (changes[KEY_DATA_SCOPE] || changes[KEY_SYNC_STATUS]) {
        void getSyncStatus().then(setSyncStatusState)
      }
    }
    chrome.storage.onChanged.addListener(onStorage)
    return () => {
      chrome.storage.onChanged.removeListener(onStorage)
      if (refreshMarksDebounceRef.current != null) {
        clearTimeout(refreshMarksDebounceRef.current)
      }
    }
  }, [])

  const reloadMark = useCallback(async (markId: string) => {
    const marks = await getMarks()
    const mark = marks.find((p) => p.id === markId)
    if (mark) setViewingMark(mark)
  }, [])

  const reloadPageMarks = useCallback(
    async (pageUrl: string, projectIdOverride?: string) => {
      const targetProjectId = projectIdOverride ?? (await getActiveProjectId())
      const marks = await getMarksForPage(targetProjectId, pageUrl)
      setPageMarks(marks)
    },
    []
  )

  const refreshFeedbackList = useCallback(async () => {
    const settings = await getWidgetSettings()
    if (isHostDisabled(location.href, settings)) {
      setPageMarks([])
      return false
    }
    await reloadPageMarks(location.href)
    return true
  }, [reloadPageMarks])

  const scheduleReloadPageMarks = useCallback(
    (pageUrl: string, projectIdOverride?: string) => {
      if (refreshMarksDebounceRef.current != null) {
        clearTimeout(refreshMarksDebounceRef.current)
      }
      refreshMarksDebounceRef.current = setTimeout(() => {
        refreshMarksDebounceRef.current = null
        void reloadPageMarks(pageUrl, projectIdOverride)
      }, 100)
    },
    [reloadPageMarks]
  )

  const loadProjects = useCallback(async () => {
    const [projectRows, viewRows, activeProject] = await Promise.all([
      getProjects(),
      getWorkspaceViews(),
      getActiveProjectId()
    ])
    const nextProjectId = projectRows.some(
      (project) => project.id === activeProject
    )
      ? activeProject
      : projectRows[0]?.id || ""

    setProjects(projectRows)
    setWorkspaceViews(viewRows)
    setSelectedViewId((current) =>
      current === "all" || viewRows.some((view) => view.id === current)
        ? current
        : "all"
    )
    setProjectId(nextProjectId)
    if (nextProjectId && nextProjectId !== activeProject) {
      void setActiveProjectId(nextProjectId)
    }
  }, [])

  const resume = useCallback(() => {
    feedbackListRequestRef.current += 1
    if (refreshMarksDebounceRef.current != null) {
      clearTimeout(refreshMarksDebounceRef.current)
      refreshMarksDebounceRef.current = null
    }
    setOpen(false)
    setMode("create")
    setCapture(null)
    setViewingMark(null)
    setBody("")
    setPriority("medium")
    setReplyDraft("")
    setEditing(false)
    setEditTitle("")
    setEditBody("")
    setSaveError(null)
    setSaveWarning(null)
    setConfirmDelete(false)
    setReturnToList(false)
    setReattachMarkId(null)
    reattachMarkIdRef.current = null
    reattachCaptureRef.current = null
    setPendingListDeleteMarkId(null)
    setFullImage(null)
    setPageMarks([])
    setFeedbackListAnchorKind(null)
    setSelectedViewId("all")
    previousFocusRef.current?.focus?.()
    dispatchInternalEvent(EVENT_REVIEW_RESUME)
  }, [])

  const openFeedbackList = useCallback(
    async (anchorKind?: "page", toggle = true) => {
      const requestId = ++feedbackListRequestRef.current
      if (open && mode === "list") {
        setPendingListDeleteMarkId(null)
        if (toggle) resume()
        else setFeedbackListAnchorKind(anchorKind ?? null)
        return
      }

      const canOpen = await refreshFeedbackList()
      if (!canOpen || requestId !== feedbackListRequestRef.current) return

      await loadProjects()
      if (requestId !== feedbackListRequestRef.current) return
      setMode("list")
      setCapture(null)
      setViewingMark(null)
      setBody("")
      setReplyDraft("")
      setEditing(false)
      setSaveError(null)
      setSaveWarning(null)
      setConfirmDelete(false)
      setReturnToList(false)
      setReattachMarkId(null)
      reattachMarkIdRef.current = null
      setPendingListDeleteMarkId(null)
      setFeedbackListAnchorKind(anchorKind ?? null)
      previousFocusRef.current = document.activeElement as HTMLElement
      setOpen(true)
    },
    [loadProjects, mode, open, refreshFeedbackList, resume]
  )

  useEffect(() => {
    const onCap = (detail: ReviewCaptureDetail) => {
      const reattachId = reattachMarkIdRef.current
      if (reattachId) {
        reattachCaptureRef.current = detail.screenshotPending
          ? { captureId: detail.captureId, markId: reattachId }
          : null
        void (async () => {
          const now = Date.now()
          const markPatch: Partial<Mark> = {
            captureKind: detail.captureKind ?? "element",
            url: normalizePageUrlForMatch(detail.url) || detail.url,
            pageTitle: detail.pageTitle,
            elementFingerprint: detail.elementFingerprint,
            selector: detail.selector,
            strategy: detail.strategy,
            bbox: detail.bbox,
            viewport: detail.viewport,
            outerHTMLPreview:
              typeof detail.outerHTML === "string"
                ? detail.outerHTML.slice(0, STORAGE_LIMITS.outerHTMLPreview)
                : "",
            domSnapshot: detail.domSnapshot,
            updatedAt: now,
            syncError: undefined
          }
          if (detail.elementScreenshotDataUrl) {
            markPatch.screenshotDataUrl = detail.elementScreenshotDataUrl
          }
          await patchMark(reattachId, markPatch)
          reattachMarkIdRef.current = null
          setReattachMarkId(null)
          await reloadMark(reattachId)
          await reloadPageMarks(detail.url)
          setCapture(null)
          setMode("thread")
          setOpen(true)
          setSaveWarning(t("extension.panel.reattachedLocally"))
          dispatchInternalEvent(EVENT_REVIEW_PAUSE)
        })()
        return
      }
      setCapture(detail)
      setMode("create")
      setViewingMark(null)
      setBody("")
      setPriority("medium")
      setSaveError(null)
      setSaveWarning(null)
      setReattachMarkId(null)
      reattachMarkIdRef.current = null
      setReturnToList(false)
      setPendingListDeleteMarkId(null)
      void loadProjects()
      previousFocusRef.current = document.activeElement as HTMLElement
      setOpen(true)
      void reloadPageMarks(detail.url)
    }
    registerCaptureHandler(onCap)
    return () => registerCaptureHandler(null)
  }, [loadProjects, reloadMark, reloadPageMarks])

  useEffect(() => {
    registerCaptureUpdateHandler((patch) => {
      const reattach = reattachCaptureRef.current
      if (reattach?.captureId === patch.captureId) {
        if (!patch.screenshotPending) reattachCaptureRef.current = null
        if (patch.elementScreenshotDataUrl) {
          void patchMark(reattach.markId, {
            screenshotDataUrl: patch.elementScreenshotDataUrl,
            updatedAt: Date.now(),
            syncError: undefined
          }).then(() => reloadMark(reattach.markId))
        }
        return
      }
      setCapture((current) =>
        current?.captureId === patch.captureId
          ? { ...current, ...patch }
          : current
      )
    })
    return () => registerCaptureUpdateHandler(null)
  }, [reloadMark])

  useEffect(() => {
    const onToggleFeedbackList = (e: Event) => {
      if (isInternalEvent(e)) void openFeedbackList()
    }
    const onOpenPageMarks = (e: Event) => {
      if (isInternalEvent(e)) void openFeedbackList("page", false)
    }
    window.addEventListener(
      EVENT_REVIEW_TOGGLE_FEEDBACK_LIST,
      onToggleFeedbackList
    )
    window.addEventListener(EVENT_REVIEW_OPEN_PAGE_MARKS, onOpenPageMarks)
    return () => {
      window.removeEventListener(
        EVENT_REVIEW_TOGGLE_FEEDBACK_LIST,
        onToggleFeedbackList
      )
      window.removeEventListener(EVENT_REVIEW_OPEN_PAGE_MARKS, onOpenPageMarks)
    }
  }, [openFeedbackList])

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = getInternalEventDetail<Partial<OpenMarkDetail>>(e)
      const markId = detail?.markId
      if (!markId) return
      void (async () => {
        await loadProjects()
        const marks = await getMarks()
        const mark = marks.find((p) => p.id === markId)
        if (!mark) return
        setViewingMark(mark)
        setEditTitle(mark.title)
        setEditBody(mark.thread[0]?.body ?? "")
        setMode("thread")
        setCapture(null)
        setReplyDraft("")
        setSaveError(null)
        setSaveWarning(null)
        setConfirmDelete(false)
        setReturnToList(false)
        setPendingListDeleteMarkId(null)
        previousFocusRef.current = document.activeElement as HTMLElement
        setOpen(true)
        void reloadPageMarks(mark.url, mark.projectId)
      })()
    }
    window.addEventListener(EVENT_REVIEW_OPEN_MARK, onOpen)
    return () => window.removeEventListener(EVENT_REVIEW_OPEN_MARK, onOpen)
  }, [loadProjects, reloadPageMarks])

  useEffect(() => {
    if (!open || !viewingMark) return
    const onStorage: Parameters<
      typeof chrome.storage.onChanged.addListener
    >[0] = (changes, area) => {
      if (area !== "local") return
      if (
        changes[KEY_DATA_SCOPE] ||
        changes[KEY_PROJECTS] ||
        changes[KEY_ACTIVE_PROJECT]
      ) {
        void loadProjects()
      }
      if (changes[KEY_DATA_SCOPE] || changes[KEY_MARKS]) {
        void reloadMark(viewingMark.id)
        scheduleReloadPageMarks(viewingMark.url, viewingMark.projectId)
      }
    }
    chrome.storage.onChanged.addListener(onStorage)
    return () => chrome.storage.onChanged.removeListener(onStorage)
  }, [open, viewingMark, loadProjects, reloadMark, scheduleReloadPageMarks])

  useEffect(() => {
    if (!open || mode !== "list") return
    const onStorage: Parameters<
      typeof chrome.storage.onChanged.addListener
    >[0] = (changes, area) => {
      if (area !== "local") return
      if (
        changes[KEY_DATA_SCOPE] ||
        changes[KEY_PROJECTS] ||
        changes[KEY_ACTIVE_PROJECT] ||
        changes[KEY_WORKSPACE_VIEWS]
      ) {
        void loadProjects()
      }
      if (
        changes[KEY_DATA_SCOPE] ||
        changes[KEY_MARKS] ||
        changes[KEY_ACTIVE_PROJECT] ||
        changes[KEY_WIDGET_SETTINGS]
      ) {
        void refreshFeedbackList()
      }
    }
    chrome.storage.onChanged.addListener(onStorage)
    return () => chrome.storage.onChanged.removeListener(onStorage)
  }, [open, mode, loadProjects, refreshFeedbackList])

  useEffect(() => {
    if (!open || !capture || mode !== "create") return
    const onStorage: Parameters<
      typeof chrome.storage.onChanged.addListener
    >[0] = (changes, area) => {
      if (area !== "local") return
      if (
        changes[KEY_DATA_SCOPE] ||
        changes[KEY_PROJECTS] ||
        changes[KEY_ACTIVE_PROJECT]
      ) {
        void loadProjects()
      }
      if (changes[KEY_DATA_SCOPE] || changes[KEY_MARKS]) {
        scheduleReloadPageMarks(capture.url)
      }
    }
    chrome.storage.onChanged.addListener(onStorage)
    return () => chrome.storage.onChanged.removeListener(onStorage)
  }, [open, capture, mode, loadProjects, scheduleReloadPageMarks])

  useEffect(() => {
    if (
      !open ||
      (mode === "create" && !capture) ||
      (mode === "thread" && !viewingMark)
    )
      return
    if (saving) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.preventDefault()
      e.stopPropagation()
      resume()
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [open, capture, viewingMark, mode, saving, resume])

  useEffect(() => {
    if (!open) return
    const selector =
      mode === "create"
        ? "#capture-body"
        : mode === "thread"
          ? "#thread-reply"
          : "[data-feedback-list-primary]"
    const raf = requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>(selector)?.focus()
    })
    return () => cancelAnimationFrame(raf)
  }, [open, mode])

  useEffect(() => {
    if (!open) return
    const root = panelRef.current
    if (!root) return
    const focusables = root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    if (!focusables.length) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    const onTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    root.addEventListener("keydown", onTab)
    return () => root.removeEventListener("keydown", onTab)
  }, [
    open,
    mode,
    editing,
    confirmDelete,
    pendingListDeleteMarkId,
    saveError,
    saveWarning,
    undoAction
  ])

  const handleSave = async () => {
    if (!capture || !body.trim() || saving) return
    if (capture.screenshotPending) {
      setSaveError(t("extension.panel.waitForScreenshot"))
      return
    }
    if (capture.captureKind === "region" && !capture.elementScreenshotDataUrl) {
      setSaveError(
        capture.screenshotCaptureError ??
          t("extension.panel.regionCaptureFailed")
      )
      return
    }
    if (!projectId) {
      setSaveError(t("extension.panel.chooseProjectFirst"))
      return
    }
    setSaving(true)
    setSaveError(null)
    setSaveWarning(null)
    try {
      await setActiveProjectId(projectId)
      const mark = buildMarkFromCapture(capture, projectId, body.trim(), priority)
      const saved = await addMarkWithFallback(mark)
      if (!saved.ok || !saved.mark) {
        setSaveError(t("extension.panel.couldNotSave"))
        return
      }
      if (saved.warning) {
        setSaveWarning(saved.warning)
        setBody("")
      }
      setUndoAction({
        kind: "created",
        mark: saved.mark,
        message: saved.warning
          ? t("extension.panel.savedWithLimitations")
          : t("extension.panel.feedbackPosted")
      })
      const push = await pushMarkToWorkspace(saved.mark, {
        screenshotDataUrl: saved.mark.screenshotDataUrl
      })
      if (!push.skipped && !push.ok && push.error) {
        setSaveError(
          t("extension.panel.savedLocallySync", { error: push.error })
        )
        scheduleReloadPageMarks(capture.url)
        return
      }
      if (saved.warning) {
        scheduleReloadPageMarks(capture.url)
        return
      }
      resume()
    } catch (e) {
      setSaveError(
        e instanceof Error ? e.message : t("extension.capture.genericError")
      )
    } finally {
      setSaving(false)
    }
  }

  const copyAiPrompt = async (mark: Mark) => {
    try {
      await copyTextToClipboard(buildAiPromptFromMark(mark))
      setPromptCopyState("copied")
    } catch {
      setPromptCopyState("failed")
    }
    window.setTimeout(() => setPromptCopyState("idle"), 1600)
  }

  const startReattachPin = (pin: ElementPinModel) => {
    reattachMarkIdRef.current = pin.markId
    setReattachMarkId(pin.markId)
    setOpen(false)
    setSaveError(null)
    setSaveWarning(null)
    dispatchInternalEvent(EVENT_REVIEW_RESUME)
    dispatchInternalEvent(EVENT_REVIEW_START, {
      mode: "inspect"
    } satisfies ReviewStartDetail)
  }

  const retryMarkSync = async () => {
    if (!viewingMark || saving) return
    setSaving(true)
    setSaveError(null)
    try {
      if (!viewingMark.remoteMarkId) {
        await pushMarkToWorkspace(viewingMark, {
          screenshotDataUrl: viewingMark.screenshotDataUrl
        })
      }
      const result = await syncPendingMarksToWorkspace()
      await reloadMark(viewingMark.id)
      const refreshed = (await getMarks()).find((p) => p.id === viewingMark.id)
      if (!result.ok || refreshed?.syncState === "failed") {
        setSaveError(
          refreshed?.syncError ??
            result.error ??
            t("extension.panel.syncFailed")
        )
      }
    } finally {
      setSaving(false)
    }
  }

  const sendReply = async () => {
    if (!viewingMark || !replyDraft.trim() || saving) return
    const body = replyDraft.trim()
    setSaving(true)
    setSaveError(null)
    try {
      const next = await appendThreadComment(viewingMark.id, body, "You")
      if (!next) {
        setSaveError("Could not add reply.")
        return
      }
      setReplyDraft("")
      const op = viewingMark.remoteMarkId
        ? await enqueueMarkSyncOp(viewingMark.id, { type: "comment", body })
        : undefined
      const synced = await pushMarkCommentToWorkspace(viewingMark, body, op?.id)
      if ((synced.ok || synced.skipped) && op) {
        await removeMarkSyncOp(viewingMark.id, op.id)
      }
      if (!synced.skipped && !synced.ok && synced.error) {
        if (op) await markSyncFailure(viewingMark.id, synced.error, op.id)
        setSaveError(
          `Reply saved locally. ${synced.error} Open the extension popup to retry sync.`
        )
      }
      await reloadMark(viewingMark.id)
    } finally {
      setSaving(false)
    }
  }

  const updateMarkStatus = async (mark: Mark, status: MarkStatus) => {
    if (saving) return
    setSaving(true)
    setSaveError(null)
    try {
      await patchMark(mark.id, { status, updatedAt: Date.now() })
      const op = mark.remoteMarkId
        ? await enqueueMarkSyncOp(mark.id, { type: "status", status })
        : undefined
      const synced = await pushMarkStatusToWorkspace(mark, status, op?.id)
      if ((synced.ok || synced.skipped) && op) {
        await removeMarkSyncOp(mark.id, op.id)
      }
      if (!synced.skipped && !synced.ok && synced.error) {
        if (op) await markSyncFailure(mark.id, synced.error, op.id)
        setSaveError(
          `Status updated locally. ${synced.error} Open the extension popup to retry sync.`
        )
      }
      if (viewingMark?.id === mark.id) await reloadMark(mark.id)
      await reloadPageMarks(mark.url, mark.projectId)
    } finally {
      setSaving(false)
    }
  }

  const setMarkStatus = async (status: MarkStatus) => {
    if (!viewingMark) return
    await updateMarkStatus(viewingMark, status)
  }

  const confirmListDelete = async (mark: Mark) => {
    if (saving) return
    setSaving(true)
    setSaveError(null)
    try {
      const removed = await removeMark(mark.id)
      if (!removed) {
        setSaveError(t("extension.panel.couldNotDelete"))
        return
      }
      setUndoAction({
        kind: "deleted",
        mark: removed,
        message: t("extension.drawer.deleted")
      })
      setPendingListDeleteMarkId(null)
      await reloadPageMarks(mark.url, mark.projectId)
    } finally {
      setSaving(false)
    }
  }

  const restoreUndoAction = async () => {
    if (!undoAction) return
    const mark = undoAction.mark
    if (undoAction.kind === "created") await removeMark(mark.id)
    else await restoreMark(mark)
    setUndoAction(null)
    if (mode === "list") await refreshFeedbackList()
  }

  const saveEdit = async () => {
    if (!viewingMark || saving) return
    const title = editTitle.trim().slice(0, STORAGE_LIMITS.markTitle)
    const openingBody = editBody.trim().slice(0, STORAGE_LIMITS.threadBody)
    if (!title || !openingBody) {
      setSaveError("Title and opening feedback are required.")
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const thread = viewingMark.thread.length
        ? [
            { ...viewingMark.thread[0], body: openingBody },
            ...viewingMark.thread.slice(1)
          ]
        : [
            {
              id: makeThreadMessageId(),
              body: openingBody,
              createdAt: Date.now(),
              authorLabel: "You"
            }
          ]
      await patchMark(viewingMark.id, { title, thread, updatedAt: Date.now() })
      const op = viewingMark.remoteMarkId
        ? await enqueueMarkSyncOp(viewingMark.id, {
            type: "edit",
            title,
            openingBody
          })
        : undefined
      const synced = await pushMarkEditToWorkspace(viewingMark, {
        title,
        openingBody
      }, op?.id)
      if ((synced.ok || synced.skipped) && op) {
        await removeMarkSyncOp(viewingMark.id, op.id)
      }
      if (!synced.skipped && !synced.ok && synced.error) {
        if (op) await markSyncFailure(viewingMark.id, synced.error, op.id)
        setSaveError(
          `Edit saved locally. ${synced.error} Open the extension popup to retry sync.`
        )
      }
      setEditing(false)
      await reloadMark(viewingMark.id)
      scheduleReloadPageMarks(viewingMark.url, viewingMark.projectId)
    } finally {
      setSaving(false)
    }
  }

  const deleteMark = async () => {
    if (!viewingMark || saving) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    const mark = viewingMark
    setSaving(true)
    setSaveError(null)
    try {
      const removed = await removeMark(mark.id)
      if (!removed) {
        setSaveError(t("extension.panel.couldNotDelete"))
        return
      }
      setUndoAction({
        kind: "deleted",
        mark: removed,
        message: t("extension.panel.feedbackDeleted")
      })
      setViewingMark(null)
      setConfirmDelete(false)
      if (returnToList) {
        setMode("list")
        setReturnToList(false)
        await reloadPageMarks(mark.url, mark.projectId)
        return
      }
      setOpen(false)
      scheduleReloadPageMarks(mark.url, mark.projectId)
      dispatchInternalEvent(EVENT_REVIEW_RESUME)
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return undoAction ? (
      <div
        data-youin-extension-ui=""
        role="status"
        className="pointer-events-auto fixed bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-[var(--yi-radius-lg)] bg-[color:var(--yi-ext-surface-panel)] px-3 py-2 font-sans text-[12px] text-[color:var(--yi-ext-text-muted)] shadow-[var(--yi-ext-shadow-panel)] ring-1 ring-[color:var(--yi-ext-border-hairline)]"
        style={{ zIndex: Z_PANEL }}>
        {undoAction.message}
        <button
          type="button"
          className="font-semibold text-[color:var(--yi-ext-link)] underline underline-offset-2"
          onClick={() => void copyAiPrompt(undoAction.mark)}>
          {promptCopyState === "copied"
            ? t("extension.panel.promptCopied")
            : promptCopyState === "failed"
              ? t("extension.panel.promptCopyFailed")
              : t("extension.panel.copyAiPrompt")}
        </button>
        <button
          type="button"
          className="font-semibold text-[color:var(--yi-ext-link)] underline underline-offset-2"
          onClick={() => void restoreUndoAction()}>
          Undo
        </button>
      </div>
    ) : null
  }

  const selectProject = (id: string) => {
    setProjectId(id)
    void setActiveProjectId(id)
  }

  const openMarkFromList = (mark: Mark) => {
    const pin = createPinModel(mark)
    if (isElementPinModel(pin)) scrollElementPinIntoView(pin)
    dispatchInternalEvent(EVENT_REVIEW_PAUSE)
    setViewingMark(mark)
    setEditTitle(mark.title)
    setEditBody(mark.thread[0]?.body ?? "")
    setMode("thread")
    setCapture(null)
    setReplyDraft("")
    setEditing(false)
    setSaveError(null)
    setSaveWarning(null)
    setConfirmDelete(false)
    setReturnToList(true)
    setPendingListDeleteMarkId(null)
    void reloadPageMarks(mark.url, mark.projectId)
  }

  const backToFeedbackList = () => {
    setViewingMark(null)
    setReplyDraft("")
    setEditing(false)
    setSaveError(null)
    setSaveWarning(null)
    setConfirmDelete(false)
    setReturnToList(false)
    setMode("list")
    void refreshFeedbackList()
  }

  const panelSurface =
    "youin-capture-panel pointer-events-auto fixed inset-y-0 end-0 flex h-full w-[min(380px,calc(100vw-16px))] min-w-0 flex-col border-s border-[color:var(--yi-ext-border-hairline)] bg-[color:var(--yi-ext-surface-panel)] font-sans text-[color:var(--yi-ext-text)] shadow-[var(--yi-ext-shadow-dock)] tabular-nums antialiased motion-reduce:animate-none [font-feature-settings:'ss01','cv11'] animate-[youin-capture-dock-in_220ms_var(--yi-ease-out-expo)_both]"

  if (mode === "list") {
    const scopedMarks =
      feedbackListAnchorKind === "page"
        ? pageMarks.filter((mark) =>
            isPageAnchoredPinModel(createPinModel(mark))
          )
        : pageMarks
    const selectedView = workspaceViews.find(
      (view) => view.id === selectedViewId
    )
    const visibleMarks = selectedView
      ? filterMarksForWorkspaceView(scopedMarks, selectedView.filters)
      : scopedMarks
    const openMarks = visibleMarks.filter((mark) => mark.status !== "closed")
    const resolvedMarks = visibleMarks.filter(
      (mark) => mark.status === "closed"
    )

    return (
      <div
        data-youin-extension-ui=""
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-list-title"
        style={{ zIndex: Z_PANEL }}
        className={panelSurface}>
        <header className="flex shrink-0 items-start justify-between gap-3 px-4 pb-3 pt-5">
          <div className="min-w-0">
            <h2
              id="feedback-list-title"
              className="text-[14px] font-semibold leading-tight tracking-tight text-[color:var(--yi-ext-text-title)]">
              {t("extension.drawer.pageFeedback")}
            </h2>
            <p className="mt-1 text-[12px] leading-snug text-[color:var(--yi-ext-text-muted)]">
              {t("extension.drawer.openResolved", {
                open: openMarks.length,
                resolved: resolvedMarks.length
              })}
            </p>
          </div>
          <button
            type="button"
            data-feedback-list-primary=""
            className={headerCloseBtn}
            aria-label={t("extension.drawer.close")}
            onClick={resume}>
            <XIcon />
          </button>
        </header>
        <SyncStatusNotice status={syncStatus} />

        <label className="shrink-0 px-3 pb-1">
          <span className={fieldLabel}>{t("extension.drawer.view")}</span>
          <select
            className={selectCls}
            value={selectedViewId}
            onChange={(event) => setSelectedViewId(event.target.value)}>
            <option value="all">{t("extension.drawer.allViews")}</option>
            {workspaceViews.map((view) => (
              <option key={view.id} value={view.id}>
                {view.name}
              </option>
            ))}
          </select>
        </label>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-5 pt-3 [scrollbar-gutter:stable]">
          {visibleMarks.length === 0 ? (
            <div className="rounded-[var(--yi-radius-lg)] bg-[color:var(--yi-ext-surface-stat)] px-3 py-8 text-center ring-1 ring-[color:var(--yi-ext-border-hairline)]">
              <p className="text-[12px] font-semibold text-[color:var(--yi-ext-text-soft)]">
                {t("extension.drawer.empty")}
              </p>
              <p className="mt-1 text-[11px] leading-snug text-[color:var(--yi-ext-text-muted)]">
                {t("extension.drawer.emptyHint")}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <section>
                <h3 className="mb-2 px-1 text-[10px] font-semibold uppercase text-[color:var(--yi-ext-text-dim)]">
                  {t("extension.drawer.openSection")}
                </h3>
                {openMarks.length === 0 ? (
                  <p className="rounded-[var(--yi-radius-lg)] bg-[color:var(--yi-ext-surface-stat)] px-3 py-4 text-center text-[11px] text-[color:var(--yi-ext-text-muted)] ring-1 ring-[color:var(--yi-ext-border-hairline)]">
                    {t("extension.drawer.noOpenFeedback")}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {openMarks.map((mark) => (
                      <PageFeedbackRow
                        key={mark.id}
                        mark={mark}
                        disabled={saving}
                        pendingDeleteMarkId={pendingListDeleteMarkId}
                        onOpen={openMarkFromList}
                        onStatus={(nextMark, status) =>
                          void updateMarkStatus(nextMark, status)
                        }
                        onDelete={(nextMark) =>
                          setPendingListDeleteMarkId(nextMark.id)
                        }
                        onConfirmDelete={(nextMark) =>
                          void confirmListDelete(nextMark)
                        }
                        onCancelDelete={() => setPendingListDeleteMarkId(null)}
                      />
                    ))}
                  </ul>
                )}
              </section>

              {resolvedMarks.length ? (
                <section>
                  <h3 className="mb-2 px-1 text-[10px] font-semibold uppercase text-[color:var(--yi-ext-text-dim)]">
                    {t("extension.drawer.resolvedSection")}
                  </h3>
                  <ul className="space-y-2">
                    {resolvedMarks.map((mark) => (
                      <PageFeedbackRow
                        key={mark.id}
                        mark={mark}
                        disabled={saving}
                        pendingDeleteMarkId={pendingListDeleteMarkId}
                        onOpen={openMarkFromList}
                        onStatus={(nextMark, status) =>
                          void updateMarkStatus(nextMark, status)
                        }
                        onDelete={(nextMark) =>
                          setPendingListDeleteMarkId(nextMark.id)
                        }
                        onConfirmDelete={(nextMark) =>
                          void confirmListDelete(nextMark)
                        }
                        onCancelDelete={() => setPendingListDeleteMarkId(null)}
                      />
                    ))}
                  </ul>
                </section>
              ) : null}

              {saveError ? (
                <p
                  role="alert"
                  className="rounded-[var(--yi-radius-md)] border border-[color:var(--yi-ext-danger-border)] bg-[color:var(--yi-ext-danger-bg)] px-3 py-2 text-[12px] leading-snug text-[color:var(--yi-ext-danger-text)]">
                  {saveError}
                </p>
              ) : null}
            </div>
          )}
        </div>

        {undoAction ? (
          <div className="border-t border-[color:var(--yi-ext-border-hairline)] px-3 py-2 text-[11px] text-[color:var(--yi-ext-text-muted)]">
            {undoAction.message}
            <button
              type="button"
              className="ms-2 font-semibold text-[color:var(--yi-ext-link)] underline underline-offset-2"
              onClick={() => void copyAiPrompt(undoAction.mark)}>
              {promptCopyState === "copied"
                ? t("extension.panel.promptCopied")
                : promptCopyState === "failed"
                  ? t("extension.panel.promptCopyFailed")
                  : t("extension.panel.copyAiPrompt")}
            </button>
            <button
              type="button"
              className="ms-2 font-semibold text-[color:var(--yi-ext-link)] underline underline-offset-2"
              onClick={() => void restoreUndoAction()}>
              {t("extension.drawer.undo")}
            </button>
          </div>
        ) : null}
      </div>
    )
  }

  if (mode === "create" && capture) {
    const isRegionCapture = capture.captureKind === "region"
    const screenshotPending = Boolean(capture.screenshotPending)
    return (
      <>
        <div
          data-youin-extension-ui=""
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="capture-panel-title"
          aria-describedby={
            saveError
              ? "capture-panel-desc capture-panel-error"
              : saveWarning
                ? "capture-panel-desc capture-panel-warning"
                : "capture-panel-desc"
          }
          style={{ zIndex: Z_PANEL }}
          className={panelSurface}>
          <header className="flex shrink-0 items-start justify-between gap-2 px-4 pb-3 pt-5">
            <div className="min-w-0">
              <h2
                id="capture-panel-title"
                className="text-[14px] font-semibold leading-tight tracking-tight text-[color:var(--yi-ext-text-title)]">
                {t("extension.panel.leaveFeedback")}
              </h2>
              <p
                id="capture-panel-desc"
                className="mt-1 text-[12px] leading-snug text-[color:var(--yi-ext-text-muted)]">
                {isRegionCapture
                  ? t("extension.panel.regionAttached")
                  : t("extension.panel.elementAttached")}
              </p>
            </div>
            <button
              type="button"
              className={headerCloseBtn}
              aria-label={t("extension.panel.close")}
              onClick={resume}>
              <XIcon />
            </button>
          </header>
          <SyncStatusNotice status={syncStatus} />

          <div className="min-h-0 flex-1 overflow-y-auto [contain:layout] [scrollbar-gutter:stable]">
            <div className="flex flex-col gap-5 px-4 pb-6 pt-4">
              {screenshotPending ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="rounded-[var(--yi-radius-lg)] bg-[color:var(--yi-ext-surface-stat)] px-3 py-2.5 text-[12px] leading-snug text-[color:var(--yi-ext-text-muted)] ring-1 ring-[color:var(--yi-ext-border-hairline)]">
                  {t("extension.panel.capturingScreenshot")}
                </div>
              ) : capture.elementScreenshotDataUrl ? (
                <div className="overflow-hidden rounded-[var(--yi-radius-lg)] bg-[color:var(--yi-ext-surface-shade)] ring-1 ring-[color:var(--yi-ext-border-hairline)]">
                  <button
                    type="button"
                    className="block w-full cursor-zoom-in border-0 bg-transparent p-0"
                    aria-label={t("extension.panel.viewFullScreenshot")}
                    onClick={() =>
                      setFullImage({
                        src: capture.elementScreenshotDataUrl!,
                        alt: isRegionCapture
                          ? t("extension.panel.regionScreenshotAlt")
                          : t("extension.panel.elementScreenshotAlt")
                      })
                    }>
                    <img
                      src={capture.elementScreenshotDataUrl}
                      alt={
                        isRegionCapture
                          ? t("extension.panel.regionScreenshotAlt")
                          : t("extension.panel.elementScreenshotAlt")
                      }
                      className="max-h-44 w-full object-contain object-top"
                    />
                  </button>
                  <div className="flex justify-end border-t border-[color:var(--yi-ext-border-hairline)] px-2 py-1.5">
                    <button
                      type="button"
                      className={rowIconBtn}
                      aria-label={t("extension.panel.viewFull")}
                      title={t("extension.panel.viewFull")}
                      onClick={() =>
                        setFullImage({
                          src: capture.elementScreenshotDataUrl!,
                          alt: isRegionCapture
                            ? t("extension.panel.regionScreenshotAlt")
                            : t("extension.panel.elementScreenshotAlt")
                        })
                      }>
                      <MaximizeIcon />
                    </button>
                  </div>
                </div>
              ) : capture.screenshotCaptureError || isRegionCapture ? (
                <p
                  role={capture.screenshotCaptureError ? "alert" : undefined}
                  className="rounded-[var(--yi-radius-lg)] border border-[color:var(--yi-ext-danger-border)] bg-[color:var(--yi-ext-danger-bg)] px-3 py-2.5 text-[12px] leading-snug text-[color:var(--yi-ext-danger-text)]">
                  {capture.screenshotCaptureError ??
                    t("extension.panel.noScreenshot")}
                </p>
              ) : null}

              {!isRegionCapture ? (
                <DomContextPreview
                  snapshot={capture.domSnapshot}
                  selector={capture.selector}
                  strategy={capture.strategy}
                  bbox={capture.bbox}
                  outerHTML={capture.outerHTML}
                />
              ) : null}

              <CommentComposer
                id="capture-body"
                label={t("extension.panel.feedback")}
                value={body}
                rows={5}
                disabled={saving}
                invalid={Boolean(saveError)}
                placeholder={t("extension.panel.whatShouldChange")}
                onChange={setBody}
                onSubmit={() => void handleSave()}
              />

              {pageMarks.filter((mark) => mark.status !== "closed").length >
              0 ? (
                <div className="rounded-[var(--yi-radius-lg)] bg-[color:var(--yi-ext-surface-stat)] px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase text-[color:var(--yi-ext-text-dim)]">
                    {t("extension.panel.otherOnPage", {
                      count: pageMarks.filter(
                        (mark) => mark.status !== "closed"
                      ).length
                    })}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {pageMarks
                      .filter((mark) => mark.status !== "closed")
                      .slice(0, 5)
                      .map((mark) => (
                        <li key={mark.id}>
                          <button
                            type="button"
                            className="w-full truncate rounded-md border-0 bg-transparent px-2 py-1.5 text-left text-[11px] text-[color:var(--yi-ext-link)] outline-none hover:bg-[color:var(--yi-ext-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)]"
                            onClick={() => {
                              setViewingMark(mark)
                              setEditTitle(mark.title)
                              setEditBody(mark.thread[0]?.body ?? "")
                              setMode("thread")
                              setCapture(null)
                              setReplyDraft("")
                              setSaveError(null)
                              setSaveWarning(null)
                            }}>
                            {mark.title}
                          </button>
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}

              <details className="group rounded-[var(--yi-radius-lg)] bg-[color:var(--yi-ext-surface-stat)]">
                <summary className="flex min-h-9 cursor-pointer select-none items-center justify-between rounded-[var(--yi-radius-lg)] px-3 text-[11px] font-semibold text-[color:var(--yi-ext-text-muted)] outline-none transition-colors hover:bg-[color:var(--yi-ext-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)] [&::-webkit-details-marker]:hidden">
                  <span>{t("extension.panel.options")}</span>
                  <span className="text-[10px] font-medium text-[color:var(--yi-ext-text-placeholder)] group-open:hidden">
                    {t("extension.panel.optionsSummary")}
                  </span>
                </summary>
                <div className="flex flex-col gap-4 px-3 pb-3 pt-2">
                  <div>
                    <span className={fieldLabel}>
                      {t("extension.panel.project")}
                    </span>
                    <select
                      id="capture-project"
                      className={selectCls}
                      value={projectId}
                      onChange={(e) => selectProject(e.target.value)}>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <span className={fieldLabel}>
                      {t("extension.panel.priority")}
                    </span>
                    <select
                      id="capture-priority"
                      className={selectCls}
                      value={priority}
                      onChange={(e) =>
                        setPriority(e.target.value as MarkPriority)
                      }>
                      <option value="low">
                        {t("extension.panel.priorityLow")}
                      </option>
                      <option value="medium">
                        {t("extension.panel.priorityNormal")}
                      </option>
                      <option value="high">
                        {t("extension.panel.priorityHigh")}
                      </option>
                      <option value="critical">
                        {t("extension.panel.priorityUrgent")}
                      </option>
                    </select>
                  </div>
                </div>
              </details>

              {saveWarning ? (
                <p
                  id="capture-panel-warning"
                  role="status"
                  aria-live="polite"
                  className="rounded-[var(--yi-radius-lg)] border border-[color:var(--yi-warn-soft)] bg-[color:var(--yi-warn-soft)] px-3 py-2.5 text-[12px] leading-snug text-[color:var(--yi-warn)]">
                  {saveWarning}
                </p>
              ) : null}

              {saveError ? (
                <p
                  id="capture-panel-error"
                  role="alert"
                  aria-live="polite"
                  className="rounded-[var(--yi-radius-lg)] border border-[color:var(--yi-ext-danger-border)] bg-[color:var(--yi-ext-danger-bg)] px-3 py-2.5 text-[12px] leading-snug text-[color:var(--yi-ext-danger-text)]">
                  {saveError}
                </p>
              ) : null}

              <div className="flex gap-2">
                <button type="button" className={btnGhost} onClick={resume}>
                  {t("extension.panel.cancel")}
                </button>
                <button
                  type="button"
                  disabled={
                    saving || screenshotPending || !body.trim() || !projectId
                  }
                  aria-busy={saving}
                  className={btnPrimary}
                  onClick={() => void handleSave()}>
                  {screenshotPending
                    ? t("extension.panel.capturing")
                    : saving
                      ? t("extension.panel.posting")
                      : t("extension.panel.postFeedback")}
                </button>
              </div>
              <p className="text-center text-[10px] text-[color:var(--yi-ext-text-placeholder)]">
                {t("extension.panel.afterPostResume")}
                <span className="mt-0.5 block">
                  {isSignedIn
                    ? t("extension.panel.willSync")
                    : t("extension.panel.savedOnDevice")}
                </span>
              </p>
            </div>
          </div>
        </div>
        <FullImageOverlay
          image={fullImage}
          onClose={() => setFullImage(null)}
        />
      </>
    )
  }

  if (mode === "thread" && viewingMark) {
    const runtime = createPinRuntime(createPinModel(viewingMark))
    const threads = viewingMark.thread
      .slice()
      .sort((a, b) => a.createdAt - b.createdAt)
    const opener = threads[0]
    const screenshotSrc =
      viewingMark.screenshotUrl ?? viewingMark.screenshotDataUrl

    return (
      <>
        <div
          data-youin-extension-ui=""
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="thread-panel-title"
          style={{ zIndex: Z_PANEL }}
          className={panelSurface}>
          <header className="flex shrink-0 items-start justify-between gap-3 px-4 pb-3 pt-5">
            <div className="min-w-0 flex-1">
              {returnToList ? (
                <button
                  type="button"
                  className="mb-2 inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-[11px] font-semibold text-[color:var(--yi-ext-link)] outline-none hover:bg-[color:var(--yi-ext-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)]"
                  aria-label={t("extension.drawer.backToList")}
                  onClick={backToFeedbackList}>
                  <ArrowLeftIcon />
                  {t("extension.drawer.back")}
                </button>
              ) : null}
              <div className="flex min-w-0 items-center">
                <h2
                  id="thread-panel-title"
                  className="min-w-0 truncate text-[14px] font-semibold leading-tight tracking-tight text-[color:var(--yi-ext-text-title)]">
                  {t("extension.panel.threadTitle")}
                </h2>
              </div>
              <div className="mt-2 flex max-w-full flex-wrap items-center gap-1.5">
                <span
                  className={`${threadBadge} ${
                    viewingMark.status === "closed"
                      ? "bg-[color:var(--yi-ok-soft)] text-[color:var(--yi-ok)]"
                      : "bg-[color:var(--yi-mark-soft)] text-[color:var(--yi-mark)]"
                  }`}>
                  {viewingMark.status === "closed"
                    ? t("extension.panel.resolved")
                    : t("extension.panel.open")}
                </span>
                {viewingMark.syncState === "pending" ? (
                  <span
                    className={`${threadBadge} bg-[color:var(--yi-ext-surface-stat)] text-[color:var(--yi-ext-text-muted)]`}>
                    {t("extension.panel.pending")}
                  </span>
                ) : viewingMark.syncState === "failed" ? (
                  <span
                    className={`${threadBadge} bg-[color:var(--yi-ext-danger-bg)] text-[color:var(--yi-ext-danger-text)]`}>
                    {t("extension.panel.syncFailed")}
                  </span>
                ) : null}
                {runtime.kind === "page" ? (
                  <DashboardPageIndicator />
                ) : (
                  <span
                    className={`${threadBadge} ${threadHealthBadgeClass(runtime.health.label)}`}>
                    {markHealthLabel(runtime.health.label)}
                  </span>
                )}
              </div>
              <p className="mt-1 text-[12px] leading-snug text-[color:var(--yi-ext-text-muted)]">
                {runtime.kind === "page"
                  ? t("extension.drawer.dashboardPageDescription")
                  : runtime.health.description}
              </p>
            </div>
            <button
              type="button"
              className={headerCloseBtn}
              aria-label={t("extension.panel.close")}
              onClick={resume}>
              <XIcon />
            </button>
          </header>
          <SyncStatusNotice status={syncStatus} />

          <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-6 pt-4 [scrollbar-gutter:stable]">
            <div className="px-3">
              {editing ? (
                <div className="rounded-[var(--yi-radius-lg)] bg-[color:var(--yi-ext-surface-stat)] p-3">
                  <label className="block">
                    <span className={fieldLabel}>
                      {t("extension.panel.title")}
                    </span>
                    <input
                      value={editTitle}
                      maxLength={STORAGE_LIMITS.markTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="youin-input box-border min-h-9 w-full rounded-md px-3 text-[13px] text-[color:var(--yi-ext-text)]"
                    />
                  </label>
                  <div className="mt-3">
                    <CommentComposer
                      id="thread-edit-opening"
                      label={t("extension.panel.openingFeedback")}
                      value={editBody}
                      rows={4}
                      disabled={saving}
                      placeholder={t("extension.panel.whatShouldChange")}
                      onChange={setEditBody}
                      onSubmit={() => void saveEdit()}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className={btnGhost}
                      onClick={() => {
                        setEditing(false)
                        setEditTitle(viewingMark.title)
                        setEditBody(opener?.body ?? "")
                      }}>
                      {t("extension.panel.cancel")}
                    </button>
                    <button
                      type="button"
                      disabled={saving || !editTitle.trim() || !editBody.trim()}
                      className={btnPrimary}
                      onClick={() => void saveEdit()}>
                      {t("extension.panel.saveEdit")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-[var(--yi-radius-lg)] bg-[color:var(--yi-ext-surface-quote)] px-3 py-3 text-[13px] leading-relaxed text-[color:var(--yi-ext-text-soft)] ring-1 ring-[color:var(--yi-ext-border-hairline)] [overflow-wrap:anywhere]">
                  {opener?.body ?? viewingMark.title}
                </div>
              )}
              {runtime.kind === "element" &&
              runtime.health.health !== "attached" ? (
                <div className="mt-3 rounded-[var(--yi-radius-md)] bg-[color:var(--yi-ext-surface-stat)] px-3 py-2 text-[11px] leading-snug text-[color:var(--yi-ext-text-muted)]">
                  <p>{runtime.health.description}</p>
                  <p className="mt-1">
                    {t("extension.panel.reattachLimitHint")}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {runtime.health.rect ? (
                      <button
                        type="button"
                        className="inline-flex min-h-8 items-center rounded-md px-2 text-[11px] font-semibold text-[color:var(--yi-ext-link)] outline-none hover:bg-[color:var(--yi-ext-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)]"
                        onClick={() => scrollElementPinIntoView(runtime.pin)}>
                        {t("extension.panel.scrollToSavedPosition")}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={reattachMarkId === viewingMark.id}
                      className="inline-flex min-h-8 items-center rounded-md px-2 text-[11px] font-semibold text-[color:var(--yi-ext-link)] outline-none hover:bg-[color:var(--yi-ext-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)] disabled:opacity-50"
                      onClick={() => startReattachPin(runtime.pin)}>
                      {reattachMarkId === viewingMark.id
                        ? t("extension.panel.reattachWaiting")
                        : t("extension.panel.reattachElement")}
                    </button>
                    <button
                      type="button"
                      className="inline-flex min-h-8 items-center rounded-md px-2 text-[11px] font-semibold text-[color:var(--yi-ext-link)] outline-none hover:bg-[color:var(--yi-ext-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)]"
                      onClick={() => void copyAiPrompt(viewingMark)}>
                      {promptCopyState === "copied"
                        ? t("extension.panel.promptCopied")
                        : promptCopyState === "failed"
                          ? t("extension.panel.promptCopyFailed")
                          : t("extension.panel.copyAiPrompt")}
                    </button>
                  </div>
                </div>
              ) : null}
              {viewingMark.syncState === "failed" ? (
                <div className="mt-3 rounded-[var(--yi-radius-md)] border border-[color:var(--yi-ext-danger-border)] bg-[color:var(--yi-ext-danger-bg)] px-3 py-2">
                  {viewingMark.syncError ? (
                    <p className="text-[11px] leading-snug text-[color:var(--yi-ext-danger-text)]">
                      {viewingMark.syncError}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    disabled={saving}
                    className="mt-2 inline-flex min-h-9 items-center rounded-md px-2 text-[11px] font-semibold text-[color:var(--yi-ext-link)] outline-none hover:bg-[color:var(--yi-ext-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)] disabled:opacity-50"
                    onClick={() => void retryMarkSync()}>
                    {saving
                      ? t("extension.panel.syncing")
                      : t("extension.panel.retrySync")}
                  </button>
                </div>
              ) : null}
              {opener ? (
                <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-[color:var(--yi-ext-text-dim)]">
                  <p>
                    {opener.authorLabel} · {formatShortDate(opener.createdAt)}
                  </p>
                  {!editing ? (
                    <button
                      type="button"
                      className={rowIconBtn}
                      aria-label={t("extension.panel.edit")}
                      title={t("extension.panel.edit")}
                      onClick={() => setEditing(true)}>
                      <PencilIcon />
                    </button>
                  ) : null}
                </div>
              ) : (
                <p className="mt-2 text-[11px] text-[color:var(--yi-ext-text-dim)]">
                  {formatShortDate(viewingMark.createdAt)}
                </p>
              )}

              {screenshotSrc ? (
                <div className="mt-4 overflow-hidden rounded-[var(--yi-radius-lg)] bg-[color:var(--yi-ext-surface-shade)] ring-1 ring-[color:var(--yi-ext-border-hairline)]">
                  <button
                    type="button"
                    className="block w-full cursor-zoom-in border-0 bg-transparent p-0"
                    aria-label={t("extension.panel.viewFullSavedScreenshot")}
                    onClick={() =>
                      setFullImage({
                        src: screenshotSrc,
                        alt: t("extension.panel.savedElementScreenshotAlt")
                      })
                    }>
                    <img
                      src={screenshotSrc}
                      alt={t("extension.panel.savedElementScreenshotAlt")}
                      className="max-h-48 w-full object-contain object-top"
                    />
                  </button>
                  <div className="flex justify-end border-t border-[color:var(--yi-ext-border-hairline)] px-2 py-1.5">
                    <button
                      type="button"
                      className={rowIconBtn}
                      aria-label={t("extension.panel.viewFull")}
                      title={t("extension.panel.viewFull")}
                      onClick={() =>
                        setFullImage({
                          src: screenshotSrc,
                          alt: t("extension.panel.savedElementScreenshotAlt")
                        })
                      }>
                      <MaximizeIcon />
                    </button>
                  </div>
                </div>
              ) : null}

              {viewingMark.captureKind !== "region" ? (
                <div className="mt-4">
                  <DomContextPreview
                    snapshot={viewingMark.domSnapshot}
                    selector={viewingMark.selector}
                    strategy={viewingMark.strategy}
                    bbox={viewingMark.bbox}
                    outerHTML={viewingMark.outerHTMLPreview}
                  />
                </div>
              ) : null}

              {threads.length > 1 ? (
                <ul className="mt-6 flex flex-col gap-4 pt-1">
                  {threads.slice(1).map((m) => (
                    <li
                      key={m.id}
                      className="text-[12px] leading-snug [overflow-wrap:anywhere]">
                      <span className="font-semibold text-[color:var(--yi-ext-text-soft)]">
                        {m.authorLabel}:
                      </span>{" "}
                      <span className="text-[color:var(--yi-ext-text)]">
                        {m.body}
                      </span>
                      <div className="mt-1 text-[10px] text-[color:var(--yi-ext-text-placeholder)]">
                        {formatShortDate(m.createdAt)}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="mt-6">
                <CommentComposer
                  id="thread-reply"
                  label={t("extension.panel.reply")}
                  value={replyDraft}
                  rows={3}
                  disabled={saving}
                  placeholder={t("extension.panel.addReply")}
                  onChange={setReplyDraft}
                  onSubmit={() => void sendReply()}
                />
              </div>

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  disabled={saving || !replyDraft.trim()}
                  className="rounded-md border border-[color:var(--yi-ext-btn-primary-bg)] bg-[color:var(--yi-ext-accent)] px-4 py-2 text-[12px] font-semibold text-[color:var(--yi-ext-btn-primary-text)] outline-none transition-colors hover:border-[color:var(--yi-ext-btn-primary-hover)] hover:bg-[color:var(--yi-mark-hover)] disabled:opacity-40"
                  onClick={() => void sendReply()}>
                  {t("extension.panel.sendReply")}
                </button>
              </div>

              <div className="mt-5">
                <span className={fieldLabel}>
                  {t("extension.panel.status")}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={saving || viewingMark.status === "open"}
                    className="min-h-9 rounded-md border border-[color:var(--yi-ext-border)] bg-[color:var(--yi-ext-surface-input)] px-3 text-[12px] font-semibold text-[color:var(--yi-ext-text-muted)] outline-none transition-colors hover:border-[color:var(--yi-ext-border-strong)] hover:bg-[color:var(--yi-ext-surface-hover)] disabled:bg-[color:var(--yi-ext-surface-stat)] disabled:text-[color:var(--yi-ext-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)]"
                    onClick={() => void setMarkStatus("open" as MarkStatus)}>
                    {t("extension.panel.open")}
                  </button>
                  <button
                    type="button"
                    disabled={saving || viewingMark.status === "closed"}
                    className="min-h-9 rounded-md border border-[color:var(--yi-ext-border)] bg-[color:var(--yi-ext-surface-input)] px-3 text-[12px] font-semibold text-[color:var(--yi-ext-text-muted)] outline-none transition-colors hover:border-[color:var(--yi-ext-border-strong)] hover:bg-[color:var(--yi-ext-surface-hover)] disabled:bg-[color:var(--yi-ok-soft)] disabled:text-[color:var(--yi-ok)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)]"
                    onClick={() => void setMarkStatus("closed" as MarkStatus)}>
                    {t("extension.panel.resolved")}
                  </button>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-2">
                <button
                  type="button"
                  className={btnPrimary}
                  onClick={() => void copyAiPrompt(viewingMark)}>
                  {promptCopyState === "copied"
                    ? t("extension.panel.promptCopied")
                    : promptCopyState === "failed"
                      ? t("extension.panel.promptCopyFailed")
                      : t("extension.panel.copyAiPrompt")}
                </button>
                <a
                  href={`${WEB_APP_URL}/dashboard`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-9 items-center justify-center gap-1 rounded-md border border-[color:var(--yi-ext-border)] bg-[color:var(--yi-ext-surface-input)] px-3 text-[12.5px] font-semibold text-[color:var(--yi-ext-link)] no-underline outline-none transition-colors hover:border-[color:var(--yi-ext-border-strong)] hover:bg-[color:var(--yi-ext-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)]">
                  {t("extension.panel.openDashboard")}
                </a>
                {confirmDelete ? (
                  <div className="rounded-[var(--yi-radius-lg)] border border-[color:var(--yi-ext-danger-border)] bg-[color:var(--yi-ext-danger-bg)] px-3 py-3">
                    <p className="text-[12px] font-semibold text-[color:var(--yi-ext-danger-text)]">
                      {t("extension.panel.confirmDeleteTitle")}
                    </p>
                    <p className="mt-1 text-[11px] text-[color:var(--yi-ext-text-muted)]">
                      {t("extension.panel.confirmDeleteBody")}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        className={btnGhost}
                        onClick={() => setConfirmDelete(false)}>
                        {t("extension.panel.keepFeedback")}
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        className="flex w-full cursor-pointer items-center justify-center rounded-md border border-[color:var(--yi-ext-danger-text)] bg-[color:var(--yi-ext-danger-text)] px-3 py-2 text-[12.5px] font-semibold text-[color:var(--yi-paper)] outline-none hover:bg-[color:var(--yi-destructive)] disabled:opacity-50"
                        onClick={() => void deleteMark()}>
                        {t("extension.panel.confirmDelete")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={saving}
                    className="flex w-full cursor-pointer items-center justify-center rounded-md border border-[color:var(--yi-ext-danger-border)] bg-[color:var(--yi-ext-danger-bg)] px-3 py-2 text-[12.5px] font-semibold text-[color:var(--yi-ext-danger-text)] outline-none transition-colors hover:bg-[color:var(--yi-ext-surface-hover)] disabled:opacity-50"
                    onClick={() => void deleteMark()}>
                    {t("extension.panel.deleteFeedback")}
                  </button>
                )}
                <button type="button" className={btnGhost} onClick={resume}>
                  {t("extension.panel.close")}
                </button>
              </div>

              {saveError ? (
                <p
                  role="alert"
                  className="mt-3 text-[12px] text-[color:var(--yi-ext-danger-text)]">
                  {saveError}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        <FullImageOverlay
          image={fullImage}
          onClose={() => setFullImage(null)}
        />
      </>
    )
  }

  return null
}

function FullImageOverlay({
  image,
  onClose
}: {
  image: { src: string; alt: string } | null
  onClose: () => void
}) {
  useEffect(() => {
    if (!image) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [image, onClose])

  if (!image) return null
  return (
    <div
      data-youin-extension-ui=""
      role="dialog"
      aria-modal="true"
      aria-label="Full image preview"
      className="youin-full-image pointer-events-auto fixed inset-0 flex items-center justify-center bg-[oklch(18%_0.012_264_/_0.76)] p-4"
      style={{ zIndex: Z_MODAL }}
      onClick={onClose}>
      <button
        type="button"
        className="absolute right-3 top-3 inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border border-[color:var(--yi-ext-border)] bg-[color:var(--yi-paper)] text-[color:var(--yi-ink)] shadow-[var(--yi-shadow-popover)] outline-none hover:bg-[color:var(--yi-paper-elevated)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--yi-paper)]"
        aria-label="Close full image preview"
        onClick={onClose}>
        <XIcon />
      </button>
      <img
        src={image.src}
        alt={image.alt}
        className="max-h-[calc(100vh-48px)] max-w-[calc(100vw-32px)] object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}

export default CapturePanel
