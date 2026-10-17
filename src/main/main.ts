import { app, BrowserWindow } from 'electron';
import path from 'path';
import './ipcHandlers';
import './unityHub';
import './releases';
import './installer';
import { registerPreviewProtocol } from './previewProtocol';
import { initAutoUpdate } from './updater';
import * as packageJson from '../../package.json';

// Chromium locks its caches in the session data folder (userData by default), so a dev run next to the installed app
// fails with "Unable to move the cache" / "Gpu Cache Creation failed". Dev gets its own caches; config.json stays shared.
if (!app.isPackaged) {
  app.setPath('sessionData', path.join(app.getPath('userData'), 'dev-session'));
} else if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });
}

const appVersion = packageJson.version;

let mainWindow: BrowserWindow;

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 600,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
    },
    autoHideMenuBar: true,
    // Packaged builds take the icon from the executable (packagerConfig.icon); in dev point at the source asset.
    icon: app.isPackaged ? undefined : path.join(__dirname, '../../src/assets/icon.ico'),
  });

  mainWindow.setTitle(`Unity Runway ${appVersion}`);

  // and load the index.html of the app.
  // electron-vite sets ELECTRON_RENDERER_URL to the dev server in `dev`; built output loads from out/renderer.
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
  // DevTools: Ctrl+Shift+I. Not opened by default: its frontend floods the console with harmless
  // "Autofill.enable wasn't found" / "language-mismatch" errors; set RUNWAY_DEVTOOLS=1 to open it on start.
  if (!app.isPackaged && process.env['RUNWAY_DEVTOOLS'])
    mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  registerPreviewProtocol();
  createWindow();
  initAutoUpdate();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

export { mainWindow };