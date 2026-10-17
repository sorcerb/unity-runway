import { execFile, spawn } from 'child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { promisify } from 'util';
import { getEditorFolders } from '../renderer/stores/projectStore';
import { EditorModel, ProjectTemplateModel } from '../renderer/models/EditorFolderModel';

// Editor folders hold one sub-folder per version: <base>/<version>/Editor/Unity.exe (the Unity Hub layout).
export const getEditorExePath = (basePath: string, version: string) => join(basePath, version, 'Editor', 'Unity.exe');

export const GetEditorVersions = (basePath: string): EditorModel[] => {
    if (!existsSync(basePath)) {
        return [];
    }

    const directories = readdirSync(basePath).filter((dir) => {
        const fullPath = join(basePath, dir);
        return statSync(fullPath).isDirectory();
    });

    const versions = directories.filter((dir) => existsSync(getEditorExePath(basePath, dir)));

    return versions.map(v => ({ path: basePath, version: v, modules: getInstalledModules(basePath, v) } as EditorModel));
}

// Unity Hub keeps the editor's module list in <editor>/modules.json (`selected` = installed);
// Runway writes the ids it installed to <editor>/runway-modules.json.
export const RUNWAY_MODULES_FILE = 'runway-modules.json';

const readJson = (file: string): unknown => {
    try {
        return JSON.parse(readFileSync(file, 'utf-8').replace(/^﻿/, ''));
    } catch {
        return null;
    }
};

export const getInstalledModules = (basePath: string, version: string): string[] => {
    const dir = join(basePath, version);
    const ids = new Set<string>();
    const hub = readJson(join(dir, 'modules.json'));
    if (Array.isArray(hub)) {
        hub.filter(m => m?.selected && typeof m.id === 'string').forEach(m => ids.add(m.id));
    }
    const runway = readJson(join(dir, RUNWAY_MODULES_FILE));
    if (Array.isArray(runway)) {
        runway.filter(id => typeof id === 'string').forEach(id => ids.add(id));
    }
    return [...ids];
};

export const getInstalledEditors = (): EditorModel[] =>
    getEditorFolders().flatMap(folder => GetEditorVersions(folder.path));

// Unity versions sort naturally with numeric collation: 6000.0.9f1 < 6000.0.85f1, and a(lpha) < b(eta) < f(inal).
export const compareVersions = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

// Resolves an editor coming from the renderer against what is actually installed, so its path is safe to act on.
export const findInstalledEditor = (editor: EditorModel | undefined) =>
    editor && getInstalledEditors().find(e => e.version === editor.version && e.path.toLowerCase() === editor.path?.toLowerCase());

// Spawn Unity directly (no cmd.exe shell) and fully detached: without a shared console
// a stray Ctrl+C / console close can't kill the editor, its import workers and ParrelSync clones,
// and the editor's exit code no longer matters to the launcher.
export const spawnEditor = async (editor: EditorModel, args: string[]) => {
    const editorPath = getEditorExePath(editor.path, editor.version);
    const child = spawn(editorPath, args, {
        cwd: dirname(editorPath),
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
    });

    await new Promise<void>((resolve, reject) => {
        child.once('spawn', resolve);
        child.once('error', reject);
    });

    child.unref();
};

// Project templates shipped with the editor (what Unity Hub offers for "New project"), read from each package's package.json.
export const getProjectTemplates = async (editor: EditorModel): Promise<ProjectTemplateModel[]> => {
    const dir = join(editor.path, editor.version, 'Editor', 'Data', 'Resources', 'PackageManager', 'ProjectTemplates');
    if (!existsSync(dir)) {
        return [];
    }
    const files = readdirSync(dir).filter(f => f.endsWith('.tgz'));
    const templates = await Promise.all(files.map(async (file): Promise<ProjectTemplateModel> => {
        const path = join(dir, file);
        try {
            const { stdout } = await promisify(execFile)(join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe'),
                ['-xOzf', path, 'package/package.json'], { windowsHide: true });
            const pkg = JSON.parse(stdout);
            return { path, name: pkg.name ?? file, displayName: pkg.displayName ?? pkg.name ?? file, description: pkg.description ?? '' };
        } catch {
            return { path, name: file, displayName: file.replace(/\.tgz$/, ''), description: '' };
        }
    }));
    return templates.sort((a, b) => a.displayName.localeCompare(b.displayName));
};

export const isEditorRunning = async (editor: EditorModel) => {
    const exe = getEditorExePath(editor.path, editor.version).toLowerCase();
    try {
        const { stdout } = await promisify(execFile)('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
            'Get-Process -Name Unity -ErrorAction SilentlyContinue | ForEach-Object { $_.Path }'], { windowsHide: true });
        return stdout.split(/\r?\n/).some(p => p.trim().toLowerCase() === exe);
    } catch {
        return false;
    }
};
