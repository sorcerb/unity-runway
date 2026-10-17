import { app, ipcMain } from 'electron';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { addEditorFolder, addProject, getEditorFolders, getProjects } from '../renderer/stores/projectStore';

// Unity Hub keeps its state as JSON files in %APPDATA%/UnityHub.
const hubDataPath = () => path.join(app.getPath('appData'), 'UnityHub');
const DEFAULT_EDITORS_PATH = 'C:\\Program Files\\Unity\\Hub\\Editor';

const readHubJson = <T>(fileName: string): T | null => {
    try {
        return JSON.parse(readFileSync(path.join(hubDataPath(), fileName), 'utf-8')) as T;
    } catch {
        return null;
    }
};

interface HubProject {
    path: string;
    title?: string;
    lastModified?: number;
}

export const importHubProjects = () => {
    const hubProjects = readHubJson<{ data: Record<string, HubProject> }>('projects-v1.json');
    if (!hubProjects) {
        return { found: 0, added: 0 };
    }

    const known = new Set(getProjects().map(p => p.path.toLowerCase()));
    const candidates = Object.values(hubProjects.data ?? {}).filter(p => p.path && existsSync(p.path));
    let added = 0;

    for (const project of candidates) {
        if (known.has(project.path.toLowerCase())) {
            continue;
        }
        addProject({
            id: project.path,
            path: project.path,
            name: project.title || path.basename(project.path),
            tags: [],
            preview: null,
            modified: null,
            modifiedText: '',
            editorVersion: '',
            selectedEditor: null,
            // Hub's lastModified is when the project was last opened from the Hub.
            lastOpened: project.lastModified ? new Date(project.lastModified).toISOString() : undefined,
        });
        added++;
    }

    return { found: candidates.length, added };
};

export const importHubEditorFolders = () => {
    const folders = new Set<string>([DEFAULT_EDITORS_PATH]);

    const secondaryPath = readHubJson<string>('secondaryInstallPath.json');
    if (secondaryPath) {
        folders.add(secondaryPath);
    }

    // Editors located manually in the Hub are keyed by <base>/<version>/Editor/Unity.exe.
    const binaries = readHubJson<Record<string, unknown>>('installedEditorBinaryMetadata.json');
    for (const exePath of Object.keys(binaries ?? {})) {
        folders.add(path.dirname(path.dirname(path.dirname(exePath))));
    }

    const known = new Set(getEditorFolders().map(f => f.path.toLowerCase()));
    const existing = [...folders].filter(f => existsSync(f));
    let added = 0;

    for (const folder of existing) {
        if (!known.has(folder.toLowerCase())) {
            addEditorFolder({ path: folder });
            added++;
        }
    }

    return { found: existing.length, added };
};

ipcMain.handle('hub:import-projects', () => importHubProjects());
ipcMain.handle('hub:import-editor-folders', () => importHubEditorFolders());
