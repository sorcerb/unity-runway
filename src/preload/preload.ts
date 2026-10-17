import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { ProjectModel } from '../renderer/models/ProjectModel';
import { EditorFolderModel, EditorModel, NewProjectRequest, ProjectTemplateModel } from '../renderer/models/EditorFolderModel';
import { EditorUpdates, InstallRequest, InstallState, ReleaseModel, ReleasePage, ReleaseStream } from '../renderer/models/ReleaseModel';
import { UpdateStatus } from '../renderer/models/UpdateModel';

type Result = { success: boolean; message: string };

const api = {
  selectFolder: async (title?: string, buttonLabel?: string): Promise<string | null> => {
    const folder = await ipcRenderer.invoke('dialog:select-folder', title, buttonLabel);
    return folder || null;
  },
  getProjects: (): Promise<ProjectModel[]> => ipcRenderer.invoke('get-projects'),
  addProject: (newObj: ProjectModel): Promise<void> => ipcRenderer.invoke('add-project', newObj),
  updateProject: (path: string, updatedObj: Partial<ProjectModel>): Promise<void> => ipcRenderer.invoke('update-project', path, updatedObj),
  removeProject: (path: string): Promise<void> => ipcRenderer.invoke('remove-project', path),
  renameProject: (path: string, newName: string): Promise<Result> => ipcRenderer.invoke('rename', path, newName),
  launchProject: (editor: EditorModel, projectPath: string): Promise<Result> => ipcRenderer.invoke('launch-project', editor, projectPath),
  createProject: (request: NewProjectRequest): Promise<Result> => ipcRenderer.invoke('create-project', request),
  getProjectTemplates: (editor: EditorModel): Promise<ProjectTemplateModel[]> => ipcRenderer.invoke('editors:templates', editor),

  getEditorFolders: (): Promise<EditorFolderModel[]> => ipcRenderer.invoke('get-editor-folders'),
  addEditorFolder: (newObj: EditorFolderModel): Promise<void> => ipcRenderer.invoke('add-editor-folder', newObj),
  removeEditorFolder: (path: string): Promise<void> => ipcRenderer.invoke('remove-editor-folder', path),

  showFolderInExplorer: async (folderPath: string) => {
    return await ipcRenderer.invoke('show-folder-in-explorer', folderPath);
  },
  getEditors: async (folderPath: string | null): Promise<EditorModel[]> => {
    return await ipcRenderer.invoke('get-editor-versions', folderPath);
  },
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('open-external', url),

  importHubProjects: (): Promise<{ found: number; added: number }> => ipcRenderer.invoke('hub:import-projects'),
  importHubEditorFolders: (): Promise<{ found: number; added: number }> => ipcRenderer.invoke('hub:import-editor-folders'),

  listReleases: (stream: ReleaseStream | null, search: string, offset: number): Promise<ReleasePage> => ipcRenderer.invoke('releases:list', stream, search, offset),
  getRelease: (version: string): Promise<ReleaseModel> => ipcRenderer.invoke('releases:get', version),
  checkEditorUpdates: (): Promise<Record<string, EditorUpdates>> => ipcRenderer.invoke('releases:check-updates'),

  startInstall: (request: InstallRequest): Promise<void> => ipcRenderer.invoke('install:start', request),
  cancelInstall: (): Promise<void> => ipcRenderer.invoke('install:cancel'),
  dismissInstall: (): Promise<void> => ipcRenderer.invoke('install:dismiss'),
  uninstallEditor: (editor: EditorModel): Promise<boolean> => ipcRenderer.invoke('editors:uninstall', editor),
  getInstallState: (): Promise<InstallState | null> => ipcRenderer.invoke('install:get-state'),
  onInstallProgress: (callback: (state: InstallState | null) => void) => {
    const listener = (_event: IpcRendererEvent, state: InstallState | null) => callback(state);
    ipcRenderer.on('install:progress', listener);
    return () => { ipcRenderer.removeListener('install:progress', listener); };
  },

  getAutoUpdate: (): Promise<boolean> => ipcRenderer.invoke('update:get-auto'),
  setAutoUpdate: (enabled: boolean): Promise<void> => ipcRenderer.invoke('update:set-auto', enabled),
  getUpdateStatus: (): Promise<UpdateStatus> => ipcRenderer.invoke('update:get-status'),
  checkForUpdates: (): Promise<UpdateStatus> => ipcRenderer.invoke('update:check'),
  downloadUpdate: (): Promise<void> => ipcRenderer.invoke('update:download'),
  installUpdate: (): Promise<void> => ipcRenderer.invoke('update:install'),
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => {
    const listener = (_event: IpcRendererEvent, status: UpdateStatus) => callback(status);
    ipcRenderer.on('update-status', listener);
    return () => { ipcRenderer.removeListener('update-status', listener); };
  },
}

contextBridge.exposeInMainWorld('electron', api);


export type ElectronAPI = typeof api;