import { dialog, ipcMain, shell } from 'electron';
import { existsSync, readdirSync, readFileSync, renameSync, statSync } from 'fs';
import { addEditorFolder, addProject, getEditorFolders, getProjects, removeEditorFolder, removeProject, renameProject, updateProject } from '../renderer/stores/projectStore';
import { ProjectModel } from '../renderer/models/ProjectModel';
import { EditorFolderModel, EditorModel } from '../renderer/models/EditorFolderModel';
import { mainWindow } from './main';
import { formatDistanceToNow } from 'date-fns';
import path, { join } from 'path';
import { exec } from 'child_process';

ipcMain.handle('dialog:select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Select a project to open...',
        buttonLabel: 'Add Project',
        properties: ['openDirectory'],
    });

    return result.filePaths[0] || null;
});

ipcMain.handle('get-projects', () => {
    const projects = getProjects();
    projects.forEach(project => {
        project.preview = GetPreview(project.path);
        project.id = project.path;
        const m = GetModified(project.path);
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
        const modifiedDate = stats.mtime;

        let formattedDate = formatDistanceToNow(modifiedDate, { addSuffix: true });
        formattedDate = formattedDate.replace(/^about\s/, '');

        return { modified: stats.mtime, modifiedText: formattedDate };
    } catch (error) {
        console.error('Error fetching folder modified date:', error);
        return null;
    }
}

const GetEditorVersion = (folderPath: string) => {
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
        const oldName = path.basename(folderPath);
        const parentDir = path.dirname(folderPath);

        const newFolderPath = path.join(parentDir, newName);

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
        return { success: false, message: (error as Error)?.message };
    }
});

ipcMain.handle('launch-project', async (_event, editorPath: string, projectPath: string) => {
    try {
        if (!projectPath || !editorPath) {
            throw new Error('Both folderPath and unityEditorPath must be provided.');
        }

        const command = `"${editorPath}" -projectPath "${projectPath}"`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error('Error launching Unity project:', error);
                throw error;
            }

            if (stderr) {
                console.warn('Unity stderr:', stderr);
            }

            console.log('Unity stdout:', stdout);
        });

        return { success: true, message: `Unity project at ${projectPath} is launching...` };
    } catch (error) {
        console.error('Error in launch-unity-project:', error);
        return { success: false, message: (error as Error)?.message };
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

const GetEditorVersions = (basePath: string): EditorModel[] => {
    const directories = readdirSync(basePath).filter((dir) => {
        const fullPath = join(basePath, dir);
        return statSync(fullPath).isDirectory();
    });

    const versions = directories.filter((dir) => {
        const editorExePath = join(basePath, dir, 'Editor', 'Unity.exe');
        return existsSync(editorExePath);
    });

    return versions.map(v => ({ path: basePath, version: v } as EditorModel));
}