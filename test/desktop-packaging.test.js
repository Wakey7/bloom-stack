import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const desktopMain = await readFile(new URL("../desktop/main.cjs", import.meta.url), "utf8");
const indexHtml = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("desktop scripts preserve the browser development server", () => {
  assert.equal(packageJson.scripts.start, "node scripts/serve.mjs");
  assert.match(packageJson.scripts["start:desktop"], /electron-forge start/);
  assert.match(packageJson.scripts["smoke:desktop"], /electron \. --smoke-test/);
  assert.match(packageJson.scripts["package:desktop"], /--platform=win32 --arch=x64/);
  assert.match(packageJson.scripts["make:desktop"], /--platform=win32 --arch=x64/);
});

test("desktop dependencies are pinned to the approved versions", () => {
  assert.deepEqual(packageJson.dependencies, {
    "electron-squirrel-startup": "1.0.1",
  });
  assert.deepEqual(packageJson.devDependencies, {
    "@electron-forge/cli": "7.11.2",
    "@electron-forge/maker-squirrel": "7.11.2",
    electron: "44.4.1",
  });
});

test("Electron window keeps Node isolated from game code", () => {
  assert.match(desktopMain, /nodeIntegration:\s*false/);
  assert.match(desktopMain, /contextIsolation:\s*true/);
  assert.match(desktopMain, /sandbox:\s*true/);
  assert.match(desktopMain, /setUserAgent/);
  assert.match(desktopMain, /setWindowOpenHandler\(\(\) => \(\{ action: "deny" \}\)\)/);
  assert.match(desktopMain, /require\("electron-squirrel-startup"\)/);
  assert.match(desktopMain, /app\.setAppUserModelId\(APP_USER_MODEL_ID\)/);
});

test("desktop renderer has an offline-only content security policy", () => {
  assert.match(indexHtml, /Content-Security-Policy/);
  assert.match(indexHtml, /connect-src 'none'/);
  assert.match(indexHtml, /object-src 'none'/);
});
