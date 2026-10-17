import Store from 'electron-store';
import { ProjectModel } from '../models/ProjectModel';
import { EditorFolderModel } from '../models/EditorFolderModel';

const store = new Store<{ data: ProjectModel[] }>({ defaults: { data: [] } });

export const getProjects = (): ProjectModel[] => {
    const currentData: ProjectModel[] = store.get('Projects', [] as ProjectModel[]);
    return currentData;
};
export const addProject = (newObj: ProjectModel): void => {
    const currentData: ProjectModel[] = store.get('Projects', [] as ProjectModel[]);
    if (!currentData.some(s => s.path == newObj.path))
        store.set('Projects', [...currentData, newObj]);
};

export const updateProject = (path: string, updatedObj: Partial<ProjectModel>): void => {
    const currentData: ProjectModel[] = store.get('Projects') || [];
    const updatedData: ProjectModel[] = currentData.map((obj) => (obj.path === path ? { ...obj, ...updatedObj } : obj));
    store.set('Projects', updatedData);
};

export const removeProject = (path: string): void => {
    const currentData: ProjectModel[] = store.get('Projects') || [];
    const updatedData: ProjectModel[] = currentData.filter((obj) => obj.path !== path);
    store.set('Projects', updatedData);
};

export const renameProject = (path: string, newName: string): void => {
    const currentData: ProjectModel[] = store.get('Projects') || [];
    const updatedData: ProjectModel[] = currentData.map((obj) => {
        if (obj.path === path) {
            const newPath = obj.path.replace(/[^\\/]+$/, newName);
            return { ...obj, path: newPath, name: newName };
        }
        return obj;
    });
    store.set('Projects', updatedData);
};


export const getEditorFolders = (): EditorFolderModel[] => {
    const currentData: EditorFolderModel[] = store.get('EditorFolders', [] as EditorFolderModel[]);
    return currentData;
};

export const addEditorFolder = (newObj: EditorFolderModel): void => {
    const currentData: EditorFolderModel[] = store.get('EditorFolders', [] as EditorFolderModel[]);
    if (!currentData.some(s => s.path == newObj.path))
        store.set('EditorFolders', [...currentData, newObj]);
};

export const removeEditorFolder = (path: string): void => {
    const currentData: EditorFolderModel[] = store.get('EditorFolders') || [];
    const updatedData: EditorFolderModel[] = currentData.filter((obj) => obj.path !== path);
    store.set('EditorFolders', updatedData);
};