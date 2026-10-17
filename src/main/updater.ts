import { app, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import { mainWindow } from './main';
import { getAutoUpdate, setAutoUpdate } from '../renderer/stores/autoUpdateStore';
import { UpdateStatus } from '../renderer/models/UpdateModel';

// Updates of Runway itself from GitHub Releases: the release workflow uploads the installer and latest.yml,
// electron-updater finds them through `publish` in electron-builder.yml.

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

let status: UpdateStatus = { state: app.isPackaged ? 'idle' : 'unsupported', currentVersion: app.getVersion() };
let checkInterval: NodeJS.Timeout | null = null;

const setStatus = (next: Partial<UpdateStatus>) => {
    status = { ...status, ...next };
    mainWindow?.webContents.send('update-status', status);
};

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on('checking-for-update', () => setStatus({ state: 'checking', error: undefined }));
autoUpdater.on('update-not-available', () => setStatus({ state: 'latest' }));
autoUpdater.on('update-available', info => {
    setStatus({ state: 'available', version: info.version });
    if (getAutoUpdate()) {
        downloadUpdate();
    }
});
autoUpdater.on('download-progress', progress => setStatus({ state: 'downloading', percent: Math.floor(progress.percent) }));
autoUpdater.on('update-downloaded', info => setStatus({ state: 'downloaded', version: info.version }));
autoUpdater.on('error', error => setStatus({ state: 'error', error: error.message }));

const checkForUpdates = async (): Promise<UpdateStatus> => {
    // Busy or already found: a new check would only reset the state.
    if (status.state === 'unsupported' || status.state === 'checking' || status.state === 'downloading' || status.state === 'downloaded') {
        return status;
    }
    try {
        await autoUpdater.checkForUpdates();
    } catch {
        // Reported by the 'error' event.
    }
    return status;
};

const downloadUpdate = async (): Promise<void> => {
    if ((status.state !== 'available' && status.state !== 'error') || !status.version) {
        return;
    }
    setStatus({ state: 'downloading', percent: 0, error: undefined });
    try {
        await autoUpdater.downloadUpdate();
    } catch {
        // Reported by the 'error' event.
    }
};

const updateAutoUpdate = (enabled: boolean) => {
    if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
    }
    if (!enabled || !app.isPackaged) {
        return;
    }
    checkForUpdates();
    checkInterval = setInterval(checkForUpdates, CHECK_INTERVAL_MS);
    checkInterval.unref();
};

export const initAutoUpdate = () => updateAutoUpdate(getAutoUpdate());

ipcMain.handle('update:get-auto', () => getAutoUpdate());
ipcMain.handle('update:set-auto', (_event, enabled: boolean) => {
    setAutoUpdate(enabled);
    updateAutoUpdate(enabled);
});
ipcMain.handle('update:get-status', () => status);
ipcMain.handle('update:check', () => checkForUpdates());
ipcMain.handle('update:download', () => downloadUpdate());
ipcMain.handle('update:install', () => {
    if (status.state === 'downloaded') {
        autoUpdater.quitAndInstall(true, true);
    }
});
