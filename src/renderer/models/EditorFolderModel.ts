
export interface EditorFolderModel {
    path: string;
}

export interface EditorModel {
    path: string;
    version: string;
    modules?: string[];   // installed module ids (e.g. windows-il2cpp)
}

export interface ProjectTemplateModel {
    path: string;         // the template .tgz inside the editor
    name: string;         // package name, e.g. com.unity.template.urp-blank
    displayName: string;
    description: string;
}

export interface NewProjectRequest {
    editor: EditorModel;
    parentDir: string;
    name: string;
    template: string | null;   // ProjectTemplateModel.path; null = empty project
}