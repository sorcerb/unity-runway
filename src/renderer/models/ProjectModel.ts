
export interface ProjectModel {
    id: string;
    preview: string | null;
    path: string;
    name: string;
    tags: string[];
    modified: Date | null;
    modifiedText: string;
    editorVersion: string;
}