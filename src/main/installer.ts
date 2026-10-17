import { app, dialog, ipcMain, net } from 'electron';
import { spawn } from 'child_process';
import { createHash } from 'crypto';
import { once } from 'events';
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, statfsSync, writeFileSync } from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { ReadableStream as WebReadableStream } from 'stream/web';
import { mainWindow } from './main';
import { findInstalledEditor, getEditorExePath, getInstalledModules, isEditorRunning, RUNWAY_MODULES_FILE } from './editors';
import { GetEditorVersion } from './ipcHandlers';
import { ApiModule, fetchRelease, getWindowsDownload } from './releases';
import { addEditorFolder, getEditorFolders, getProjects, updateProject } from '../renderer/stores/projectStore';
import { EditorModel } from '../renderer/models/EditorFolderModel';
import { InstallRequest, InstallState } from '../renderer/models/ReleaseModel';
import { BOM, buildScript, q, Step, UNINSTALL, verifyIntegrity } from './installScript';

// Installs an editor the way Unity Hub does, without needing the Hub:
// 1. download the editor and module installers from download.unity3d.com and verify their integrity hashes;
// 2. run every install step from one elevated PowerShell script, so the user sees a single UAC prompt:
//    EXE  -> NSIS installer, silent: `/S /D=<editor dir>`  (modules: `/D` is the same editor dir)
//    ZIP  -> extracted into `destination` (Android SDK/NDK/JDK), optionally renamed via `extractedPathRename`
//    PO   -> language pack copied into Editor/Data/Localization

let state: InstallState | null = null;
let abortController: AbortController | null = null;

const publish = (update: Partial<InstallState>) => {
    state = { ...(state as InstallState), ...update };
    mainWindow?.webContents.send('install:progress', state);
};

const isRunning = () => state != null && (state.phase === 'downloading' || state.phase === 'installing' || state.phase === 'uninstalling');

const formatGB = (bytes: number) => `${(bytes / 1024 ** 3).toFixed(1)} GB`;

const EXTENSIONS: Record<string, string> = { EXE: 'exe', ZIP: 'zip', PO: 'po' };

const uninstallStep = (editor: EditorModel, optional = false): Step => ({
    name: `Unity ${editor.version}`, url: '', type: UNINSTALL, file: '', downloadSize: 0, destination: path.join(editor.path, editor.version), optional,
});

const buildSteps = async (request: InstallRequest, editorDir: string, tempDir: string) => {
    const release = await fetchRelease(request.version);
    const download = getWindowsDownload(release);
    const steps: Step[] = [];
    const resolve = (p: string) => path.normalize(p.replace('{UNITY_PATH}', editorDir));

    const add = (name: string, url: string, type: string, size: number, destination: string, extra: Partial<Step> = {}) => {
        if (!EXTENSIONS[type]) {
            throw new Error(`Unsupported package type "${type}" for ${name}.`);
        }
        const file = path.join(tempDir, `${steps.length}-${name.replace(/[^\w.-]+/g, '_')}.${EXTENSIONS[type]}`);
        steps.push({ name, url, type, file, downloadSize: size, destination, ...extra });
    };

    if (!existsSync(getEditorExePath(request.basePath, request.version))) {
        add(`Unity ${release.version}`, download.url, 'EXE', download.downloadSize.value, editorDir, { integrity: download.integrity });
    }

    const selected = new Set(request.moduleIds);
    const addModule = (module: ApiModule) => {
        // Modules with a custom command line (e.g. Visual Studio) run their own installer instead of NSIS flags.
        const args = module.cmd ? module.cmd.replace(/^\s*"?\{FILENAME\}"?\s*/, '') : undefined;
        add(module.name, module.url, module.type, module.downloadSize?.value ?? 0, resolve(module.destination ?? '{UNITY_PATH}'), {
            integrity: module.integrity || undefined,
            rename: module.extractedPathRename && { from: resolve(module.extractedPathRename.from), to: resolve(module.extractedPathRename.to) },
            args,
        });
        // Sub-modules install into folders their parent creates, so they go right after it.
        module.subModules?.filter(s => s.required || selected.has(s.id)).forEach(addModule);
    };

    for (const module of download.modules) {
        if (selected.has(module.id)) {
            addModule(module);
        }
    }

    if (steps.length === 0) {
        throw new Error(`Unity ${request.version} and the selected modules are already installed.`);
    }
    // Runs only once everything above succeeded; failing to remove the old editor does not fail the install.
    if (request.replaces) {
        steps.push(uninstallStep(request.replaces, true));
    }
    return { steps, installedSize: download.installedSize.value };
};

// The install folder may not exist yet; free space is reported for the closest existing ancestor.
const freeSpace = (target: string) => {
    let dir = target;
    while (!existsSync(dir) && path.dirname(dir) !== dir) {
        dir = path.dirname(dir);
    }
    const stats = statfsSync(dir);
    return stats.bavail * stats.bsize;
};

const downloadSteps = async (steps: Step[], signal: AbortSignal) => {
    const total = steps.reduce((sum, s) => sum + s.downloadSize, 0);
    let received = 0;
    let lastPublish = 0;

    for (const step of steps.filter(s => s.url)) {
        publish({ phase: 'downloading', step: `Downloading ${step.name}`, received, total });

        const response = await net.fetch(step.url, { signal });
        if (!response.ok || !response.body) {
            throw new Error(`Failed to download ${step.name}: ${response.status} ${response.statusText}`);
        }

        const md5 = createHash('md5');
        const out = createWriteStream(step.file);
        try {
            for await (const chunk of Readable.fromWeb(response.body as WebReadableStream<Uint8Array>)) {
                md5.update(chunk);
                received += chunk.length;
                if (!out.write(chunk)) {
                    await once(out, 'drain');
                }
                if (Date.now() - lastPublish > 250) {
                    lastPublish = Date.now();
                    publish({ received, total: Math.max(total, received) });
                }
            }
        } finally {
            out.end();
            await once(out, 'close');
        }

        verifyIntegrity(step, md5.digest());
    }
};

const runElevated = async (scriptFile: string, statusFile: string, steps: Step[]) => {
    const outer = `try { $p = Start-Process -FilePath 'powershell.exe' -Verb RunAs -Wait -PassThru -WindowStyle Hidden `
        + `-ArgumentList ${q(`-NoProfile -ExecutionPolicy Bypass -File "${scriptFile}"`)}; exit $p.ExitCode } catch { exit 1223 }`;

    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(outer, 'utf16le').toString('base64')], {
        windowsHide: true,
        stdio: 'ignore',
    });

    const readStatus = () => {
        try {
            return readFileSync(statusFile, 'utf-8').replace(BOM, '').trim();
        } catch {
            return '';
        }
    };

    const poll = setInterval(() => {
        const status = readStatus();
        const index = Number(status);
        if (status !== '' && Number.isInteger(index) && steps[index]) {
            const verb = steps[index].type === UNINSTALL ? 'Removing' : 'Installing';
            publish({ step: `${verb} ${steps[index].name}`, received: index, total: steps.length });
        }
    }, 500);

    try {
        const [code] = await once(child, 'exit') as [number | null];
        if (code === 1223) {
            throw new Error('Administrator permission is required.');
        }
        const [result, ...warnings] = readStatus().split(/\r?\n/).map(l => l.trim());
        if (code !== 0 || result !== 'done') {
            throw new Error(result.startsWith('error:') ? result.slice('error:'.length).trim() : `Installer exited with code ${code}.`);
        }
        return warnings.filter(Boolean);
    } finally {
        clearInterval(poll);
    }
};

const install = async (request: InstallRequest) => {
    const editorDir = path.join(request.basePath, request.version);
    const tempDir = path.join(app.getPath('temp'), 'unity-runway', request.version);
    abortController = new AbortController();
    state = { version: request.version, phase: 'downloading', step: 'Preparing...', received: 0, total: 0 };
    publish({});

    try {
        rmSync(tempDir, { recursive: true, force: true });
        mkdirSync(tempDir, { recursive: true });

        const { steps, installedSize } = await buildSteps(request, editorDir, tempDir);

        const downloadSize = steps.reduce((sum, s) => sum + s.downloadSize, 0);
        const sameDrive = path.parse(tempDir).root.toLowerCase() === path.parse(editorDir).root.toLowerCase();
        const neededOnTarget = installedSize + (sameDrive ? downloadSize : 0);
        if (freeSpace(editorDir) < neededOnTarget) {
            throw new Error(`Not enough disk space: about ${formatGB(neededOnTarget)} is needed on ${path.parse(editorDir).root}.`);
        }
        if (!sameDrive && freeSpace(tempDir) < downloadSize) {
            throw new Error(`Not enough disk space for downloads: ${formatGB(downloadSize)} is needed in ${tempDir}.`);
        }

        await downloadSteps(steps, abortController.signal);

        publish({ phase: 'installing', step: 'Waiting for administrator permission...', received: 0, total: steps.length });
        const statusFile = path.join(tempDir, 'status.txt');
        const scriptFile = path.join(tempDir, 'install.ps1');
        // Remembered so the next update of this editor offers the same modules.
        const modules = [...new Set([...getInstalledModules(request.basePath, request.version), ...request.moduleIds])];
        const record = { file: path.join(editorDir, RUNWAY_MODULES_FILE), content: JSON.stringify(modules) };
        writeFileSync(scriptFile, buildScript(steps, statusFile, record), 'utf-8');
        const warnings = await runElevated(scriptFile, statusFile, steps);

        if (!getEditorFolders().some(f => f.path.toLowerCase() === request.basePath.toLowerCase())) {
            addEditorFolder({ path: request.basePath });
        }
        if (request.replaces) {
            switchProjects(request.replaces.version, { path: request.basePath, version: request.version });
        }
        publish({
            phase: 'done',
            step: request.replaces ? `Unity ${request.replaces.version} updated to ${request.version}` : `Unity ${request.version} installed`,
            warning: warnings.length > 0 ? `Could not remove ${warnings.join('; ')}` : undefined,
            received: steps.length,
            total: steps.length,
        });
    } catch (error) {
        if (abortController.signal.aborted) {
            publish({ phase: 'cancelled', step: 'Installation cancelled' });
        } else {
            console.error('Editor installation failed:', error);
            publish({ phase: 'error', step: 'Installation failed', error: (error as Error).message });
        }
    } finally {
        abortController = null;
        rmSync(tempDir, { recursive: true, force: true, maxRetries: 3 });
    }
};

const uninstall = async (editor: EditorModel) => {
    const tempDir = path.join(app.getPath('temp'), 'unity-runway', `uninstall-${editor.version}`);
    state = { version: editor.version, phase: 'uninstalling', step: 'Waiting for administrator permission...', received: 0, total: 1 };
    publish({});

    try {
        rmSync(tempDir, { recursive: true, force: true });
        mkdirSync(tempDir, { recursive: true });

        const steps = [uninstallStep(editor)];
        const statusFile = path.join(tempDir, 'status.txt');
        const scriptFile = path.join(tempDir, 'uninstall.ps1');
        writeFileSync(scriptFile, buildScript(steps, statusFile), 'utf-8');
        await runElevated(scriptFile, statusFile, steps);

        publish({ phase: 'done', step: `Unity ${editor.version} removed`, received: 1, total: 1 });
    } catch (error) {
        console.error('Editor removal failed:', error);
        publish({ phase: 'error', step: 'Removal failed', error: (error as Error).message });
    } finally {
        rmSync(tempDir, { recursive: true, force: true, maxRetries: 3 });
    }
};

// Projects that open with `version`: picked explicitly, or saved with it and nothing else picked.
const projectsUsing = (version: string) =>
    getProjects().filter(p => (p.selectedEditor?.version ?? GetEditorVersion(p.path)) === version);

// After an update replaced an editor, its projects open with the new one (Runway asks before upgrading them on launch).
const switchProjects = (fromVersion: string, to: EditorModel) =>
    projectsUsing(fromVersion).forEach(p => updateProject(p.path, { selectedEditor: to }));

const busyMessage = () => `Unity ${state?.version} is being ${state?.phase === 'uninstalling' ? 'removed' : 'installed'}, wait until it finishes.`;

ipcMain.handle('install:start', async (_event, request: InstallRequest) => {
    if (isRunning()) {
        throw new Error(busyMessage());
    }
    if (!request?.version || !request.basePath || !path.isAbsolute(request.basePath)) {
        throw new Error('Invalid install request.');
    }
    if (request.replaces) {
        const replaces = findInstalledEditor(request.replaces);
        if (!replaces || replaces.version === request.version) {
            throw new Error(`Unity ${request.replaces.version} is not installed.`);
        }
        if (await isEditorRunning(replaces)) {
            throw new Error(`Close Unity ${replaces.version} first: it is removed after the update.`);
        }
        request = { ...request, replaces };
    }
    if (isRunning()) {
        throw new Error(busyMessage());
    }
    // Runs in the background; progress is pushed through `install:progress`.
    install(request);
});

// Asks for confirmation; resolves to false when the user cancelled.
ipcMain.handle('editors:uninstall', async (_event, target: EditorModel) => {
    if (isRunning()) {
        throw new Error(busyMessage());
    }
    const editor = findInstalledEditor(target);
    if (!editor) {
        throw new Error(`Unity ${target?.version} is not installed.`);
    }
    if (await isEditorRunning(editor)) {
        throw new Error(`Close Unity ${editor.version} before removing it.`);
    }

    const projects = projectsUsing(editor.version).length;
    const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: 'Uninstall editor',
        message: `Uninstall Unity ${editor.version}?`,
        detail: `${path.join(editor.path, editor.version)} will be deleted with all its modules.`
            + (projects > 0 ? `\n\n${projects} project${projects === 1 ? ' uses' : 's use'} this version.` : ''),
        buttons: ['Uninstall', 'Cancel'],
        defaultId: 1,
        cancelId: 1,
    });
    if (response !== 0) {
        return false;
    }
    if (isRunning()) {
        throw new Error(busyMessage());
    }
    uninstall(editor);
    return true;
});

// Downloads can be cancelled; once the elevated installers run they have to finish.
ipcMain.handle('install:cancel', () => {
    if (state?.phase === 'downloading') {
        abortController?.abort();
    }
});

ipcMain.handle('install:get-state', () => state);

ipcMain.handle('install:dismiss', () => {
    if (!isRunning()) {
        state = null;
        mainWindow?.webContents.send('install:progress', state);
    }
});
