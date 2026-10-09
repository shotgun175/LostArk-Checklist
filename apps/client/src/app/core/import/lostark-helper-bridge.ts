/**
 * One-click import from lostark-helper.com.
 *
 * The "Send to Lost Ark Checklist" bookmark runs on lostark-helper.com, gathers the same data as
 * tools/export-from-lostark-helper.js (its export-core block is copied into the bookmark), opens
 * Settings with ?import=lostark-helper and hands the data over with postMessage after a handshake:
 * Settings posts READY to window.opener for each allowed source origin, the bookmark accepts READY
 * only from the app origin and then posts the export, as a JSON string, only to the app origin.
 */

export const IMPORT_QUERY_PARAM = "import";
export const IMPORT_QUERY_VALUE = "lostark-helper";
export const READY_MESSAGE = "loa-checklist:ready";
export const EXPORT_MESSAGE = "lostark-helper:export";

/** Published path of the export script; the build copies tools/export-from-lostark-helper.js there. */
export const EXPORT_SCRIPT_URL = "/assets/export-from-lostark-helper.js";

const CORE_PATTERN = /\/\/ BEGIN export-core[^\n]*\n([\s\S]*?)\/\/ END export-core/;

/** Returns the code between the export-core markers of the export script. */
export function extractExportCore(script: string): string {
  const match = CORE_PATTERN.exec(script.replace(/\r\n/g, "\n"));
  if (!match) {
    throw new Error("BEGIN/END export-core markers not found in the export script");
  }
  return match[1];
}

/** Drops comment-only lines, indentation and blank lines; the export-core block has comments only on their own lines. */
function compact(code: string): string {
  return code
    .split("\n")
    .map(line => line.trim())
    .filter(line => line !== "" && !line.startsWith("//"))
    .join("\n");
}

/**
 * Builds the bookmark's javascript: URL from the export script.
 *
 * @param script Text of tools/export-from-lostark-helper.js.
 * @param appOrigin Origin of this app, which the bookmark opens and posts to.
 * @param sourceOrigins Origins the bookmark agrees to run on (lostark-helper.com, plus a local test page in the emulator build).
 */
export function buildBookmarklet(script: string, appOrigin: string, sourceOrigins: string[]): string {
  const code = `(async () => {
const APP_ORIGIN = ${JSON.stringify(appOrigin)};
const SOURCE_ORIGINS = ${JSON.stringify(sourceOrigins)};
${compact(extractExportCore(script))}
if (!SOURCE_ORIGINS.includes(location.origin)) {
alert("This bookmark works on lostark-helper.com. Open https://lostark-helper.com/checklist, wait for your checklist to load, then click the bookmark again.");
return;
}
if (!location.pathname.startsWith("/checklist")) {
alert("Open the Checklist page first (https://lostark-helper.com/checklist) and wait for it to load, so the rest bonus is up to date. Then click the bookmark again.");
return;
}
const target = window.open(APP_ORIGIN + "/settings?${IMPORT_QUERY_PARAM}=${IMPORT_QUERY_VALUE}", "_blank");
if (!target) {
alert("The browser blocked the new tab. Allow pop-ups for lostark-helper.com and click the bookmark again, or use Copy script in Lost Ark Checklist (Settings, How to export).");
return;
}
let ready = false;
let payload = null;
let sent = false;
const send = () => {
if (ready && payload !== null && !sent) {
sent = true;
window.removeEventListener("message", onMessage);
target.postMessage({ type: ${JSON.stringify(EXPORT_MESSAGE)}, json: payload }, APP_ORIGIN);
}
};
function onMessage(event) {
if (event.source === target && event.origin === APP_ORIGIN && event.data && event.data.type === ${JSON.stringify(READY_MESSAGE)}) {
ready = true;
send();
}
}
window.addEventListener("message", onMessage);
try {
payload = JSON.stringify(await collectExport());
send();
} catch (error) {
window.removeEventListener("message", onMessage);
target.close();
alert("Sending to Lost Ark Checklist failed: " + (error && error.message ? error.message : error));
}
})()`;
  return `javascript:void(${encodeURIComponent(code)})`;
}

export interface BridgeMessage {
  origin: string;
  source: unknown;
  data: unknown;
}

export type BridgeDecision =
  | { accept: true; json: string }
  | { accept: false; reason: "already-received" | "wrong-source" | "wrong-origin" | "wrong-shape" };

/** Decides whether a message event is the export from the bookmark: from our opener, an allowed origin, the right shape, and only once. */
export function readBridgeMessage(message: BridgeMessage, opener: unknown, allowedOrigins: readonly string[], alreadyReceived: boolean): BridgeDecision {
  if (alreadyReceived) {
    return { accept: false, reason: "already-received" };
  }
  if (!opener || message.source !== opener) {
    return { accept: false, reason: "wrong-source" };
  }
  if (!allowedOrigins.includes(message.origin)) {
    return { accept: false, reason: "wrong-origin" };
  }
  const data = message.data as { type?: unknown; json?: unknown } | null;
  if (typeof data !== "object" || data === null || data.type !== EXPORT_MESSAGE || typeof data.json !== "string") {
    return { accept: false, reason: "wrong-shape" };
  }
  return { accept: true, json: data.json };
}

/** The parts of window the listener uses, so tests can pass a stand-in. */
export interface BridgeWindow {
  opener: { postMessage(message: unknown, targetOrigin: string): void } | null;
  addEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  removeEventListener(type: "message", listener: (event: MessageEvent) => void): void;
}

export interface BridgeListenerOptions {
  allowedOrigins: readonly string[];
  /** Called once with the JSON text of the export. */
  onExport: (json: string) => void;
  /** Called once when no export arrived after every READY was sent. */
  onTimeout: () => void;
  intervalMs?: number;
  maxReadyMessages?: number;
}

/**
 * Posts READY to the opener (each allowed origin, so it only reaches lostark-helper.com) until the export
 * arrives or maxReadyMessages were sent, and accepts the first valid export. Returns a function that stops it.
 */
export function listenForBridgeExport(win: BridgeWindow, options: BridgeListenerOptions): () => void {
  const opener = win.opener;
  const intervalMs = options.intervalMs ?? 1000;
  const maxReadyMessages = options.maxReadyMessages ?? 60;
  let received = false;
  let readySent = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  const stop = () => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
    win.removeEventListener("message", onMessage);
  };

  function onMessage(event: MessageEvent): void {
    const decision = readBridgeMessage({ origin: event.origin, source: event.source, data: event.data }, opener, options.allowedOrigins, received);
    if (!decision.accept) {
      return;
    }
    received = true;
    stop();
    options.onExport(decision.json);
  }

  const sendReady = () => {
    if (readySent >= maxReadyMessages) {
      stop();
      options.onTimeout();
      return;
    }
    readySent++;
    options.allowedOrigins.forEach(origin => {
      try {
        opener?.postMessage({ type: READY_MESSAGE }, origin);
      } catch {
        // The opener may have closed; the next tick or the timeout handles it.
      }
    });
  };

  win.addEventListener("message", onMessage);
  sendReady();
  timer = setInterval(sendReady, intervalMs);
  return stop;
}
