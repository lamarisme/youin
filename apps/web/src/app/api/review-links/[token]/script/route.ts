import { NextResponse, type NextRequest } from "next/server";

import { getActiveReviewLinkByToken } from "@/lib/review-links/public";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ token: string }>;
};

function buildWidgetScript(options: {
  endpoint: string;
  workspaceName: string;
}): string {
  const endpoint = JSON.stringify(options.endpoint);
  const workspaceName = JSON.stringify(options.workspaceName);

  return `
(function () {
  if (window.__youinGuestReview) return;
  window.__youinGuestReview = true;

  var ENDPOINT = ${endpoint};
  var WORKSPACE_NAME = ${workspaceName};
  var host = document.createElement("div");
  var selectedElement = null;
  var selectedPoint = null;
  var overlay = null;

  host.id = "youin-guest-review";
  document.documentElement.appendChild(host);
  var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;

  root.innerHTML = [
    "<style>",
    ":host{all:initial;position:fixed;right:20px;bottom:20px;z-index:2147483647;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#191716}",
    ".button{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;gap:8px;min-height:42px;border-radius:8px;background:#d83b2f;color:white;padding:0 14px;font:600 13px/1 system-ui;box-shadow:0 16px 40px rgba(25,23,22,.22);cursor:pointer}",
    ".button:hover{background:#bf3128}",
    ".dot{width:8px;height:8px;border-radius:999px;background:white;box-shadow:0 0 0 3px rgba(255,255,255,.22)}",
    ".panel{box-sizing:border-box;width:min(360px,calc(100vw - 32px));margin-bottom:10px;border:1px solid rgba(25,23,22,.12);border-radius:8px;background:#fffefa;box-shadow:0 18px 60px rgba(25,23,22,.24);overflow:hidden}",
    ".panel[hidden]{display:none}",
    ".head{padding:12px 14px;border-bottom:1px solid rgba(25,23,22,.08)}",
    ".eyebrow{margin:0 0 3px;color:#8a8178;font:600 10px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;letter-spacing:.06em}",
    ".title{margin:0;color:#191716;font:650 14px/1.25 system-ui}",
    ".body{display:grid;gap:9px;padding:12px 14px}",
    "label{display:grid;gap:4px;color:#5f5851;font:600 11px/1.2 system-ui}",
    "input,textarea{box-sizing:border-box;width:100%;border:1px solid rgba(25,23,22,.14);border-radius:6px;background:#fff;color:#191716;padding:9px 10px;font:13px/1.35 system-ui;outline:none}",
    "textarea{min-height:86px;resize:vertical}",
    "input:focus,textarea:focus{border-color:#d83b2f;box-shadow:0 0 0 3px rgba(216,59,47,.12)}",
    ".row{display:grid;grid-template-columns:1fr 1fr;gap:8px}",
    ".actions{display:flex;justify-content:flex-end;gap:8px;padding:0 14px 14px}",
    ".secondary,.primary{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;min-height:34px;border-radius:6px;padding:0 11px;font:600 12px/1 system-ui;cursor:pointer}",
    ".secondary{background:#f1eee9;color:#5f5851}",
    ".primary{background:#d83b2f;color:white}",
    ".primary[aria-disabled='true']{opacity:.58;cursor:wait}",
    ".status{min-height:16px;margin:0;padding:0 14px 12px;color:#8a8178;font:12px/1.35 system-ui}",
    "@media(max-width:520px){:host{right:12px;bottom:12px}.row{grid-template-columns:1fr}}",
    "</style>",
    "<form class='panel' hidden>",
    "<div class='head'><p class='eyebrow'>YouIn review</p><p class='title'></p></div>",
    "<div class='body'>",
    "<label>Task title<input name='title' maxlength='180' required></label>",
    "<label>Comment<textarea name='comment' maxlength='2000' placeholder='What should change?'></textarea></label>",
    "<div class='row'><label>Name<input name='reviewerName' maxlength='120' autocomplete='name'></label><label>Email<input name='reviewerEmail' maxlength='180' autocomplete='email'></label></div>",
    "</div>",
    "<div class='actions'><button class='secondary' type='button'>Cancel</button><button class='primary' type='submit'>Send mark</button></div>",
    "<p class='status' role='status'></p>",
    "</form>",
    "<button class='button' type='button'><span class='dot'></span><span>Mark UI</span></button>"
  ].join("");

  var button = root.querySelector(".button");
  var form = root.querySelector("form");
  var formTitle = root.querySelector(".title");
  var cancel = root.querySelector(".secondary");
  var submit = root.querySelector(".primary");
  var status = root.querySelector(".status");

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\\\$&");
  }

  function selectorFor(element) {
    if (!element || element.nodeType !== 1) return "";
    if (element.id) return "#" + cssEscape(element.id);
    var attrNames = ["data-testid", "data-test", "aria-label", "name"];
    for (var i = 0; i < attrNames.length; i += 1) {
      var attr = element.getAttribute(attrNames[i]);
      if (attr && /^[\\w .:-]+$/.test(attr)) return element.tagName.toLowerCase() + "[" + attrNames[i] + "='" + attr + "']";
    }
    var parts = [];
    var current = element;
    while (current && current.nodeType === 1 && current.tagName !== "HTML" && parts.length < 6) {
      var tag = current.tagName.toLowerCase();
      var index = 1;
      var sibling = current;
      while ((sibling = sibling.previousElementSibling)) {
        if (sibling.tagName === current.tagName) index += 1;
      }
      parts.unshift(tag + ":nth-of-type(" + index + ")");
      current = current.parentElement;
    }
    return parts.join(" > ");
  }

  function snapshotFor(element) {
    if (!element || element.nodeType !== 1) return null;
    var rect = element.getBoundingClientRect();
    var attrs = {};
    for (var i = 0; i < Math.min(element.attributes.length, 16); i += 1) {
      var item = element.attributes[i];
      attrs[item.name] = String(item.value || "").slice(0, 500);
    }
    return {
      selectedElement: {
        tagName: element.tagName.toLowerCase(),
        textContent: String(element.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 500),
        attributes: attrs,
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        }
      }
    };
  }

  function viewportString() {
    return window.innerWidth + "x" + window.innerHeight + "@" + Math.round(window.devicePixelRatio * 100) / 100;
  }

  function removeOverlay() {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
  }

  function drawOverlay(element) {
    removeOverlay();
    if (!element || element.nodeType !== 1) return;
    var rect = element.getBoundingClientRect();
    overlay = document.createElement("div");
    overlay.setAttribute("aria-hidden", "true");
    overlay.style.cssText = [
      "position:fixed",
      "left:" + Math.max(0, rect.left - 2) + "px",
      "top:" + Math.max(0, rect.top - 2) + "px",
      "width:" + Math.max(0, rect.width + 4) + "px",
      "height:" + Math.max(0, rect.height + 4) + "px",
      "border:2px solid #d83b2f",
      "border-radius:6px",
      "box-shadow:0 0 0 9999px rgba(25,23,22,.08)",
      "pointer-events:none",
      "z-index:2147483646"
    ].join(";");
    document.documentElement.appendChild(overlay);
  }

  function defaultTitle(element) {
    var text = String(element && element.textContent ? element.textContent : "").replace(/\\s+/g, " ").trim();
    if (text) return text.slice(0, 70);
    return "Feedback on " + (element && element.tagName ? element.tagName.toLowerCase() : "selected element");
  }

  function showForm(element) {
    selectedElement = element;
    formTitle.textContent = "Send feedback to " + WORKSPACE_NAME;
    form.elements.title.value = defaultTitle(element);
    form.elements.comment.value = "";
    status.textContent = "";
    form.hidden = false;
    form.elements.comment.focus();
  }

  function hideForm() {
    form.hidden = true;
    selectedElement = null;
    selectedPoint = null;
    status.textContent = "";
    removeOverlay();
  }

  function captureClick(event) {
    var path = typeof event.composedPath === "function" ? event.composedPath() : [];
    if (path.indexOf(host) >= 0) return;
    event.preventDefault();
    event.stopPropagation();
    document.removeEventListener("click", captureClick, true);
    document.documentElement.style.cursor = "";
    selectedPoint = { x: event.clientX, y: event.clientY };
    drawOverlay(event.target);
    showForm(event.target);
  }

  button.addEventListener("click", function () {
    form.hidden = true;
    status.textContent = "Click the element you want to mark.";
    document.documentElement.style.cursor = "crosshair";
    document.addEventListener("click", captureClick, true);
  });

  cancel.addEventListener("click", hideForm);

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!selectedElement) return;
    submit.setAttribute("aria-disabled", "true");
    status.textContent = "Sending...";
    fetch(ENDPOINT, {
      method: "POST",
      mode: "cors",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: form.elements.title.value,
        comment: form.elements.comment.value,
        reviewerName: form.elements.reviewerName.value,
        reviewerEmail: form.elements.reviewerEmail.value,
        page: window.location.href,
        selector: selectorFor(selectedElement),
        viewport: viewportString(),
        browser: window.navigator.userAgent,
        domSnapshot: snapshotFor(selectedElement),
        capturedAt: new Date().toISOString(),
        point: selectedPoint
      })
    }).then(function (response) {
      if (!response.ok) {
        return response.json().catch(function () { return {}; }).then(function (data) {
          throw new Error(data.error || "Could not send feedback.");
        });
      }
      return response.json();
    }).then(function () {
      status.textContent = "Sent. Your feedback is now in YouIn.";
      window.setTimeout(hideForm, 900);
    }).catch(function (error) {
      status.textContent = error && error.message ? error.message : "Could not send feedback.";
    }).finally(function () {
      submit.removeAttribute("aria-disabled");
    });
  });
})();`;
}

export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const { token } = await context.params;
  const link = await getActiveReviewLinkByToken(token);
  if (!link) {
    return new NextResponse(
      "console.warn('YouIn review link is invalid or expired.');",
      {
        status: 404,
        headers: {
          "content-type": "application/javascript; charset=utf-8",
          "cache-control": "no-store",
        },
      },
    );
  }

  const endpoint = new URL(
    `/api/review-links/${encodeURIComponent(link.token)}/marks`,
    request.nextUrl.origin,
  ).toString();

  return new NextResponse(
    buildWidgetScript({
      endpoint,
      workspaceName: link.workspaceName,
    }),
    {
      headers: {
        "content-type": "application/javascript; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}
