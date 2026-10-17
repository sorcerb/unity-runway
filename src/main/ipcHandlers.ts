import { dialog, ipcMain, shell } from 'electron';
import { closeSync, existsSync, openSync, readdirSync, readFileSync, renameSync, statSync } from 'fs';
import { compareVersions, findInstalledEditor, GetEditorVersions, getProjectTemplates, spawnEditor } from './editors';
import { addEditorFolder, addProject, getEditorFolders, getProjects, removeEditorFolder, removeProject, renameProject, updateProject } from '../renderer/stores/projectStore';
import { ProjectModel } from '../renderer/models/ProjectModel';
import { EditorFolderModel, EditorModel, NewProjectRequest } from '../renderer/models/EditorFolderModel';
import { mainWindow } from './main';
import { toPreviewUrl } from './previewProtocol';
import { formatDistanceToNow } from 'date-fns';
import path from 'path';

type Result = { success: boolean; message: string };

ipcMain.handle('dialog:select-folder', async (_event, title?: string, buttonLabel?: string) => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: title ?? 'Select a project to open...',
        buttonLabel: buttonLabel ?? 'Add Project',
        properties: ['openDirectory'],
    });

    return result.filePaths[0] || null;
});

ipcMain.handle('get-projects', () => {
    const projects = getProjects();
    projects.forEach(project => {
        const preview = GetPreview(project.path);
        project.preview = preview ? toPreviewUrl(preview) : null;
        project.id = project.path;
        // Prefer the time the launcher last opened the project; fall back to the folder mtime for projects never opened from here.
        const m = project.lastOpened ? FormatModified(new Date(project.lastOpened)) : GetModified(project.path);
        project.modified = m?.modified || null;
        project.modifiedText = m?.modifiedText || "";

        project.editorVersion = GetEditorVersion(project.path) || "unknown";
    })
    return projects;
});

const GetPreview = (folderPath: string) => {
    const exists = existsSync(`${folderPath}/preview.png`);
    if (exists) {
        return `${folderPath}/preview.png`;
    } else {
        const existsJpg = existsSync(`${folderPath}/preview.jpg`);
        if (existsJpg) {
            return `${folderPath}/preview.jpg`;
        } else {
            return null;
        }
    }
}

const GetModified = (folderPath: string) => {
    try {
        const stats = statSync(folderPath);
        return FormatModified(stats.mtime);
    } catch (error) {
        console.error('Error fetching folder modified date:', error);
        return null;
    }
}

const FormatModified = (date: Date) => {
    let formattedDate = formatDistanceToNow(date, { addSuffix: true });
    formattedDate = formattedDate.replace(/^about\s/, '');

    return { modified: date, modifiedText: formattedDate };
}

// Unity keeps Temp/UnityLockfile exclusively open while the project is loaded.
// The file itself can survive a crash, so only a failed open (not mere existence) means the project is open.
const IsProjectOpen = (folderPath: string) => {
    const lockPath = path.join(folderPath, 'Temp', 'UnityLockfile');
    try {
        closeSync(openSync(lockPath, 'r+'));
        return false;
    } catch (error) {
        return (error as NodeJS.ErrnoException).code !== 'ENOENT';
    }
}

export const GetEditorVersion = (folderPath: string) => {
    try {
        const versionFilePath = path.join(folderPath, 'ProjectSettings', 'ProjectVersion.txt');

        const fileContent = readFileSync(versionFilePath, 'utf-8');

        const versionLine = fileContent.split('\n').find(line => line.startsWith('m_EditorVersion:'));

        if (!versionLine) {
            throw new Error('Version line not found in ProjectVersion.txt');
        }

        const versionMatch = versionLine.match(/m_EditorVersion:\s*([\d]+\.[\d]+\.[\d]+[a-zA-Z\d]*)/);

        if (!versionMatch || !versionMatch[1]) {
            throw new Error('Invalid version format in ProjectVersion.txt');
        }

        return versionMatch[1];
    } catch (error) {
        console.error('Error reading project version:', error);
        return null;
    }
}

ipcMain.handle('add-project', (_event, newObj: ProjectModel) => {
    addProject(newObj);
});

ipcMain.handle('update-project', (_event, path: string, updatedObj: Partial<ProjectModel>) => {
    updateProject(path, updatedObj);
});

ipcMain.handle('remove-project', (_event, path: string) => {
    removeProject(path);
});

ipcMain.handle('rename', async (_event, folderPath: string, newName: string) => {
    try {
        newName = newName.trim();
        const oldName = path.basename(folderPath);
        const parentDir = path.dirname(folderPath);

        const newFolderPath = path.join(parentDir, newName);

        if (IsProjectOpen(folderPath)) {
            throw new Error('The project is open in Unity. Close the editor before renaming.');
        }
        if (existsSync(newFolderPath)) {
            throw new Error(`A folder named "${newName}" already exists.`);
        }

        renameSync(folderPath, newFolderPath);

        const files = readdirSync(newFolderPath);

        files.forEach((file) => {
            if (file.startsWith(oldName)) {
                const oldFilePath = path.join(newFolderPath, file);
                const newFileName = file.replace(oldName, newName);
                const newFilePath = path.join(newFolderPath, newFileName);

                renameSync(oldFilePath, newFilePath);
            }
        });
        renameProject(folderPath, newName);

        return { success: true, message: 'Folder and files renamed successfully.' };
    } catch (error) {
        console.error('Error renaming folder and files:', error);
        dialog.showMessageBox(mainWindow, { type: 'error', title: 'Rename failed', message: (error as Error)?.message });
        return { success: false, message: (error as Error)?.message };
    }
});

ipcMain.handle('launch-project', async (_event, editor: EditorModel, projectPath: string) => {
    try {
        if (!projectPath || !editor) {
            throw new Error('Both projectPath and editor must be provided.');
        }

        const projectVersion = GetEditorVersion(projectPath);
        if (projectVersion && projectVersion !== editor.version) {
            const isDowngrade = compareVersions(editor.version, projectVersion) < 0;
            const { response } = await dialog.showMessageBox(mainWindow, {
                type: 'warning',
                title: 'Editor version mismatch',
                message: `Open ${path.basename(projectPath)} with Unity ${editor.version}?`,
                detail: `The project was saved with Unity ${projectVersion}. Opening it with ${isDowngrade ? 'an older' : 'a newer'} version `
                    + `will ${isDowngrade ? 'downgrade it, which Unity does not support and may break the project' : 'upgrade it and reimport all assets; this can not be undone'}.\n\n`
                    + 'Make sure you have a backup or a committed version control state.',
                buttons: [isDowngrade ? 'Downgrade' : 'Upgrade', 'Cancel'],
                defaultId: 1,
                cancelId: 1,
            });
            if (response !== 0) {
                return { success: false, message: 'Cancelled by user.' };
            }
        }

        await spawnEditor(editor, ['-projectPath', projectPath]);

        updateProject(projectPath, { lastOpened: new Date().toISOString() });

        return { success: true, message: `Unity project at ${projectPath} is launching...` };
    } catch (error) {
        console.error('Error in launch-unity-project:', error);
        return { success: false, message: (error as Error)?.message };
    }
});

ipcMain.handle('editors:templates', async (_event, editor: EditorModel) => {
    const installed = findInstalledEditor(editor);
    return installed ? getProjectTemplates(installed) : [];
});

// Unity creates the project itself (as Unity Hub does): `-createProject <path>`, plus `-cloneFromTemplate <tgz>` for a template.
ipcMain.handle('create-project', async (_event, request: NewProjectRequest): Promise<Result> => {
    try {
        const editor = findInstalledEditor(request?.editor);
        if (!editor) {
            throw new Error(`Unity ${request?.editor?.version} is not installed.`);
        }
        const name = request.name?.trim();
        if (!name || /[<>:"/\\|?*\x00-\x1f]/.test(name) || /[. ]$/.test(name)) {
            throw new Error('The project name is empty or contains characters not allowed in a folder name.');
        }
        if (!request.parentDir || !path.isAbsolute(request.parentDir) || !existsSync(request.parentDir)) {
            throw new Error('Choose an existing folder for the project.');
        }
        const projectPath = path.join(request.parentDir, name);
        if (existsSync(projectPath)) {
            throw new Error(`${projectPath} already exists.`);
        }

        const args = ['-createProject', projectPath];
        if (request.template) {
            const template = (await getProjectTemplates(editor)).find(t => t.path === request.template);
            if (!template) {
                throw new Error('The selected template was not found in this editor.');
            }
            args.push('-cloneFromTemplate', template.path);
        }
        await spawnEditor(editor, args);

        // ProjectVersion.txt appears only once Unity has created the project, so pin the editor until then.
        addProject({
            id: projectPath, path: projectPath, name, tags: [], preview: null, modified: null, modifiedText: '', editorVersion: '',
            selectedEditor: { path: editor.path, version: editor.version }, lastOpened: new Date().toISOString(),
        });
        return { success: true, message: `Creating ${projectPath}...` };
    } catch (error) {
        console.error('Error creating a project:', error);
        return { success: false, message: (error as Error).message };
    }
});


ipcMain.handle('get-editor-folders', () => {
    return getEditorFolders();
});

ipcMain.handle('add-editor-folder', (_event, newObj: EditorFolderModel) => {
    addEditorFolder(newObj);
});

ipcMain.handle('remove-editor-folder', (_event, path: string) => {
    removeEditorFolder(path);
});


ipcMain.handle('show-folder-in-explorer', async (_event, folderPath) => {
    try {
        if (folderPath && path.isAbsolute(folderPath)) {
            await shell.openPath(folderPath);
            return { success: true };
        } else {
            return { success: false, error: 'Invalid folder path' };
        }
    } catch (error) {
        console.error('Error opening folder in Explorer:', error);
        return { success: false, error: (error as Error)?.message };
    }
});

ipcMain.handle('open-external', async (_event, url: string) => {
    if (/^https:\/\//.test(url)) {
        await shell.openExternal(url);
    }
});

ipcMain.handle('get-editor-versions', async (_event, basePath: string) => {
    try {
        let editorVersions: EditorModel[] = [];
        if (basePath) {
            editorVersions = GetEditorVersions(basePath);
        } else {
            const editorFolders = getEditorFolders();
            for (const folder of editorFolders) {
                const versions = GetEditorVersions(folder.path);
                editorVersions = [...editorVersions, ...versions];
            }
        }

        return editorVersions;

    } catch (error) {
        console.error('Error while fetching editor versions:', error);
        throw new Error('Unable to fetch editor versions.');
    }
});
