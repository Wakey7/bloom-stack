const { app, BrowserWindow, protocol, session } = require("electron");
const { readFile } = require("node:fs/promises");
const path = require("node:path");

const APP_SCHEME = "bloom-stack";
const APP_HOST = "game";
const APP_ROOT = path.resolve(__dirname, "..");
const APP_USER_MODEL_ID = "com.squirrel.bloom_stack.BloomStack";
const SMOKE_TEST = process.argv.includes("--smoke-test");
let blockedExternalRequests = 0;
const CONTENT_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
]);

function registerAppScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ]);
}

function resolveAppRequest(requestUrl) {
  const parsed = new URL(requestUrl);
  if (parsed.host !== APP_HOST) return null;
  const relativePath = decodeURIComponent(parsed.pathname).replace(/^\/+/, "") || "index.html";
  const filePath = path.resolve(APP_ROOT, relativePath);
  const relativeToRoot = path.relative(APP_ROOT, filePath);
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) return null;
  const normalized = relativeToRoot.replaceAll("\\", "/");
  if (!["index.html", "styles.css"].includes(normalized) && !normalized.startsWith("src/")) return null;
  return filePath;
}

function registerLocalProtocol() {
  protocol.handle(APP_SCHEME, async (request) => {
    const filePath = resolveAppRequest(request.url);
    if (!filePath) return new Response("Not found", { status: 404 });
    try {
      const body = await readFile(filePath);
      const contentType = CONTENT_TYPES.get(path.extname(filePath).toLowerCase()) || "application/octet-stream";
      return new Response(body, { headers: { "Content-Type": contentType } });
    } catch (error) {
      if (error?.code === "ENOENT") return new Response("Not found", { status: 404 });
      throw error;
    }
  });
}

async function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#171411",
    title: "晴空叠阵 · Bloom Stack",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      devTools: !app.isPackaged,
    },
  });

  mainWindow.removeMenu();
  mainWindow.webContents.setUserAgent(
    `BloomStack/${app.getVersion()} Electron/${process.versions.electron} Chrome/${process.versions.chrome}`,
  );
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, targetUrl) => {
    if (!targetUrl.startsWith(`${APP_SCHEME}://${APP_HOST}/`)) event.preventDefault();
  });
  if (!SMOKE_TEST) mainWindow.once("ready-to-show", () => mainWindow.show());

  try {
    await mainWindow.loadURL(`${APP_SCHEME}://${APP_HOST}/index.html`);
    if (SMOKE_TEST) {
      const rendererState = await mainWindow.webContents.executeJavaScript(`({
        title: document.title,
        readyState: document.readyState,
        boardPresent: Boolean(document.querySelector("#board")),
        encounterCount: document.querySelectorAll("#encounter-select option").length,
        protocol: location.protocol,
        nodeRequire: typeof require,
        nodeProcess: typeof process
      })`);
      const result = { ...rendererState, blockedExternalRequests };
      const passed = result.readyState === "complete"
        && result.boardPresent
        && result.encounterCount === 5
        && result.protocol === `${APP_SCHEME}:`
        && result.nodeRequire === "undefined"
        && result.nodeProcess === "undefined"
        && result.blockedExternalRequests === 0;
      process.stdout.write(`DESKTOP_SMOKE ${JSON.stringify({ passed, ...result })}\n`);
      app.exit(passed ? 0 : 1);
    }
  } catch (error) {
    if (SMOKE_TEST) {
      process.stderr.write(`DESKTOP_SMOKE_ERROR ${error.stack || error}\n`);
      app.exit(1);
      return;
    }
    throw error;
  }
}

function launchApp() {
  app.setAppUserModelId(APP_USER_MODEL_ID);
  registerAppScheme();

  app.whenReady().then(() => {
    registerLocalProtocol();
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ["http://*/*", "https://*/*"] },
      (_details, callback) => {
        blockedExternalRequests += 1;
        callback({ cancel: true });
      },
    );
    void createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) void createWindow();
    });
  });

  app.on("window-all-closed", () => app.quit());
}

if (require("electron-squirrel-startup")) {
  app.quit();
} else {
  launchApp();
}
