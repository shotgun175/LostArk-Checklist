import * as fs from "fs";
import * as path from "path";
import {
  BridgeWindow,
  buildBookmarklet,
  EXPORT_MESSAGE,
  extractExportCore,
  listenForBridgeExport,
  readBridgeMessage,
  READY_MESSAGE
} from "./lostark-helper-bridge";
import { parseExportFile } from "./validate-export";

const SCRIPT_PATH = path.resolve(__dirname, "../../../../../../tools/export-from-lostark-helper.js");
const FIXTURE_PATH = path.resolve(__dirname, "../../../../../../tools/fixtures/lostark-helper-export-synthetic.json");
const HELPER = "https://lostark-helper.com";
const APP = "https://loa-checklist.web.app";

function decode(bookmarklet: string): string {
  expect(bookmarklet.startsWith("javascript:void(")).toBe(true);
  return decodeURIComponent(bookmarklet.slice("javascript:void(".length, -1));
}

describe("bookmarklet", () => {
  const script = fs.readFileSync(SCRIPT_PATH, "utf8");

  it("takes collectExport and the converter from the export script", () => {
    const core = extractExportCore(script);
    expect(core).toContain("async function collectExport()");
    expect(core).toContain("function fromFirestoreValue(value)");
    expect(core).not.toContain("createObjectURL");
    expect(() => extractExportCore("no markers")).toThrow(/export-core markers/);
  });

  it("is valid JavaScript with no line comments and a reasonable length", () => {
    const bookmarklet = buildBookmarklet(script, APP, [HELPER]);
    const code = decode(bookmarklet);
    expect(() => new Function(`return ${code};`)).not.toThrow();
    expect(code.split("\n").some(line => line.trim().startsWith("//"))).toBe(false);
    expect(bookmarklet.length).toBeLessThan(12000);
  });

  it("opens and posts only to the app origin and runs only on the allowed origins", () => {
    const code = decode(buildBookmarklet(script, APP, [HELPER]));
    expect(code).toContain(`const APP_ORIGIN = "${APP}";`);
    expect(code).toContain(`const SOURCE_ORIGINS = ["${HELPER}"];`);
    expect(code).toContain('window.open(APP_ORIGIN + "/settings?import=lostark-helper", "_blank")');
    expect(code).toContain("target.postMessage({ type: \"lostark-helper:export\", json: payload }, APP_ORIGIN)");
    expect(code).toContain("event.source === target && event.origin === APP_ORIGIN");
    expect(code).not.toMatch(/postMessage\([^)]*"\*"/);
  });

  it("shows the wrong-site message before opening anything", async () => {
    const code = decode(buildBookmarklet(script, APP, [HELPER]));
    const alert = jest.fn();
    const open = jest.fn();
    const run = new Function("location", "alert", "window", `return ${code};`);
    await run({ origin: "https://example.com", pathname: "/checklist" }, alert, { open });
    expect(alert).toHaveBeenCalledWith(expect.stringContaining("This bookmark works on lostark-helper.com"));
    expect(open).not.toHaveBeenCalled();
  });

  it("says when the browser blocked the new tab", async () => {
    const code = decode(buildBookmarklet(script, APP, [HELPER]));
    const alert = jest.fn();
    const open = jest.fn().mockReturnValue(null);
    const run = new Function("location", "alert", "window", `return ${code};`);
    await run({ origin: HELPER, pathname: "/checklist" }, alert, { open });
    expect(open).toHaveBeenCalledWith(`${APP}/settings?import=lostark-helper`, "_blank");
    expect(alert).toHaveBeenCalledWith(expect.stringContaining("Allow pop-ups"));
  });
});

describe("readBridgeMessage", () => {
  const opener = {};
  const good = { origin: HELPER, source: opener, data: { type: EXPORT_MESSAGE, json: "{}" } };

  it("accepts the export from the opener on an allowed origin", () => {
    expect(readBridgeMessage(good, opener, [HELPER], false)).toEqual({ accept: true, json: "{}" });
  });

  it("ignores a message from another origin", () => {
    expect(readBridgeMessage({ ...good, origin: "https://lostark-helper.com.evil.example" }, opener, [HELPER], false))
      .toEqual({ accept: false, reason: "wrong-origin" });
    expect(readBridgeMessage({ ...good, origin: "http://localhost:4320" }, opener, [HELPER], false))
      .toEqual({ accept: false, reason: "wrong-origin" });
  });

  it("ignores a message from a window that is not the opener", () => {
    expect(readBridgeMessage({ ...good, source: {} }, opener, [HELPER], false)).toEqual({ accept: false, reason: "wrong-source" });
    expect(readBridgeMessage(good, null, [HELPER], false)).toEqual({ accept: false, reason: "wrong-source" });
  });

  it("ignores a message of the wrong shape", () => {
    [null, "text", { type: READY_MESSAGE, json: "{}" }, { type: EXPORT_MESSAGE }, { type: EXPORT_MESSAGE, json: {} }].forEach(data => {
      expect(readBridgeMessage({ ...good, data }, opener, [HELPER], false)).toEqual({ accept: false, reason: "wrong-shape" });
    });
  });

  it("accepts only once", () => {
    expect(readBridgeMessage(good, opener, [HELPER], true)).toEqual({ accept: false, reason: "already-received" });
  });
});

describe("listenForBridgeExport", () => {
  let listeners: Array<(event: MessageEvent) => void>;
  let opener: { postMessage: jest.Mock };
  let win: BridgeWindow;

  const dispatch = (message: { origin: string; source: unknown; data: unknown }) => {
    [...listeners].forEach(listener => listener(message as unknown as MessageEvent));
  };

  beforeEach(() => {
    jest.useFakeTimers();
    listeners = [];
    opener = { postMessage: jest.fn() };
    win = {
      opener,
      addEventListener: (_type, listener) => listeners.push(listener),
      removeEventListener: (_type, listener) => {
        listeners = listeners.filter(l => l !== listener);
      }
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("sends READY to the opener for each allowed origin, then again until the export arrives", () => {
    const stop = listenForBridgeExport(win, { allowedOrigins: [HELPER, "http://localhost:4320"], onExport: jest.fn(), onTimeout: jest.fn() });
    expect(opener.postMessage.mock.calls).toEqual([
      [{ type: READY_MESSAGE }, HELPER],
      [{ type: READY_MESSAGE }, "http://localhost:4320"]
    ]);
    jest.advanceTimersByTime(1000);
    expect(opener.postMessage).toHaveBeenCalledTimes(4);
    stop();
  });

  it("hands over the first valid export once, stops sending READY and stops listening", () => {
    const onExport = jest.fn();
    listenForBridgeExport(win, { allowedOrigins: [HELPER], onExport, onTimeout: jest.fn() });
    dispatch({ origin: "https://evil.example", source: opener, data: { type: EXPORT_MESSAGE, json: "{\"evil\":1}" } });
    dispatch({ origin: HELPER, source: {}, data: { type: EXPORT_MESSAGE, json: "{\"other\":1}" } });
    expect(onExport).not.toHaveBeenCalled();
    dispatch({ origin: HELPER, source: opener, data: { type: EXPORT_MESSAGE, json: "{\"first\":1}" } });
    dispatch({ origin: HELPER, source: opener, data: { type: EXPORT_MESSAGE, json: "{\"second\":1}" } });
    expect(onExport).toHaveBeenCalledTimes(1);
    expect(onExport).toHaveBeenCalledWith("{\"first\":1}");
    expect(listeners).toHaveLength(0);
    const sent = opener.postMessage.mock.calls.length;
    jest.advanceTimersByTime(5000);
    expect(opener.postMessage).toHaveBeenCalledTimes(sent);
  });

  it("gives up after the last READY", () => {
    const onTimeout = jest.fn();
    listenForBridgeExport(win, { allowedOrigins: [HELPER], onExport: jest.fn(), onTimeout, intervalMs: 100, maxReadyMessages: 3 });
    jest.advanceTimersByTime(1000);
    expect(opener.postMessage).toHaveBeenCalledTimes(3);
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(listeners).toHaveLength(0);
  });

  it("the handed-over text goes through the same validation as a file", () => {
    const fixture = fs.readFileSync(FIXTURE_PATH, "utf8");
    const onExport = jest.fn((json: string) => json);
    listenForBridgeExport(win, { allowedOrigins: [HELPER], onExport, onTimeout: jest.fn() });
    dispatch({ origin: HELPER, source: opener, data: { type: EXPORT_MESSAGE, json: "not json" } });
    expect(parseExportFile(onExport.mock.calls[0][0])).toMatchObject({ ok: false, errors: ["The file is not valid JSON."] });

    const second = jest.fn();
    listenForBridgeExport(win, { allowedOrigins: [HELPER], onExport: second, onTimeout: jest.fn() });
    dispatch({ origin: HELPER, source: opener, data: { type: EXPORT_MESSAGE, json: fixture } });
    const validation = parseExportFile(second.mock.calls[0][0]);
    expect(validation.ok).toBe(true);
    expect(validation.counts.characters).toBe(15);
  });
});
