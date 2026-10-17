import { EditorModel } from "./EditorFolderModel";

// Trimmed view of the Unity Release API (main/releases.ts)
// for the current platform. Download URLs stay in the main process; the renderer only picks versions and module ids.

export type ReleaseStream = 'LTS' | 'SUPPORTED' | 'TECH' | 'BETA' | 'ALPHA';

export interface EulaModel {
    url: string;
    label: string;
    message: string;
}

export interface ReleaseModuleModel {
    id: string;
    name: string;
    description: string;
    category: string;
    downloadSize: number;
    installedSize: number;
    required: boolean;
    hidden: boolean;
    preSelected: boolean;
    eula: EulaModel[];
    subModules: ReleaseModuleModel[];
}

export interface ReleaseModel {
    version: string;
    releaseDate: string;
    stream: ReleaseStream;
    recommended: boolean;
    releaseNotesUrl: string | null;
    downloadSize: number;
    installedSize: number;
    modules: ReleaseModuleModel[];
    installed: boolean;
}

export interface ReleasePage {
    total: number;
    offset: number;
    results: ReleaseModel[];
}

// Newer releases for an installed editor: `patch` of the same major.minor line, `latest` from a newer line.
export interface EditorUpdates {
    patch?: string;
    latest?: string;
}

export interface InstallRequest {
    version: string;
    basePath: string;
    moduleIds: string[];
    // An installed editor (usually an older patch of the same line) removed once the new one is installed.
    replaces?: EditorModel;
}

export type InstallPhase = 'downloading' | 'installing' | 'uninstalling' | 'done' | 'error' | 'cancelled';

export interface InstallState {
    version: string;
    phase: InstallPhase;
    step: string;
    received: number;
    total: number;
    error?: string;
    // Finished, but something optional did not (e.g. the replaced editor could not be removed).
    warning?: string;
}
