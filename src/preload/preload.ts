// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from 'electron';
import { ProjectModel } from '../renderer/models/ProjectModel';
import { EditorFolderModel } from '../renderer/models/EditorFolderModel';

const api = {
  selectFolder: async (): Promise<string | null> => {
    const folder = await ipcRenderer.invoke('dialog:select-folder');
    return folder || null;
  },
  getProjects: (): Promise<ProjectModel[]> => ipcRenderer.invoke('get-projects'),
  addProject: (newObj: ProjectModel): Promise<void> => ipcRenderer.invoke('add-project', newObj),
  updateProject: (path: string, updatedObj: Partial<ProjectModel>): Promise<void> => ipcRenderer.invoke('update-project', path, updatedObj),
  removeProject: (path: string): Promise<void> => ipcRenderer.invoke('remove-project', path),
  renameProject: (path: string, newName: string): Promise<void> => ipcRenderer.invoke('rename', path, newName),
  lunchProject: (editorPath: string, projectPath: string): Promise<void> => ipcRenderer.invoke('launch-project', editorPath, projectPath),

  getEditorFolders: (): Promise<EditorFolderModel[]> => ipcRenderer.invoke('get-editor-folders'),
  addEditorFolder: (newObj: EditorFolderModel): Promise<void> => ipcRenderer.invoke('add-editor-folder', newObj),
  removeEditorFolder: (path: string): Promise<void> => ipcRenderer.invoke('remove-editor-folder', path),

  showFolderInExplorer: async (folderPath: string) => {
    return await ipcRenderer.invoke('show-folder-in-explorer', folderPath);
  },
  getEditors: async (folderPath: string | null) => {
    return await ipcRenderer.invoke('get-editor-versions', folderPath);
  },
}

contextBridge.exposeInMainWorld('electron', api);


export type ElectronAPI = typeof api;