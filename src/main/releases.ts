import { ipcMain, net } from 'electron';
import { compareVersions, getInstalledEditors } from './editors';
import { EditorUpdates, ReleaseModel, ReleaseModuleModel, ReleasePage, ReleaseStream } from '../renderer/models/ReleaseModel';

// Public Unity Release API, the documented counterpart of the GraphQL API the Hub itself uses.
const API_URL = 'https://services.api.unity.com/unity/editor/release/v1/releases';
const PAGE_SIZE = 25; // API maximum

interface ApiSize { value: number; unit: string }
interface ApiEula { url: string; label: string; message: string }

export interface ApiModule {
    id: string;
    name: string;
    description: string;
    category: string;
    url: string;
    type: 'EXE' | 'ZIP' | 'PO' | string;
    downloadSize: ApiSize;
    installedSize: ApiSize;
    required: boolean;
    hidden: boolean;
    preSelected: boolean;
    integrity?: string;
    destination?: string;
    extractedPathRename?: { from: string; to: string };
    cmd?: string;
    eula?: ApiEula[];
    subModules?: ApiModule[];
}

export interface ApiDownload {
    url: string;
    type: string;
    platform: string;
    architecture: string;
    downloadSize: ApiSize;
    installedSize: ApiSize;
    integrity?: string;
    modules: ApiModule[];
}

export interface ApiRelease {
    version: string;
    releaseDate: string;
    stream: ReleaseStream;
    recommended: boolean;
    releaseNotes?: { url: string };
    shortRevision: string;
    downloads: ApiDownload[];
}

interface ApiPage { offset: number; limit: number; total: number; results: ApiRelease[] }

const queryReleases = async (params: Record<string, string | number>): Promise<ApiPage> => {
    const query = new URLSearchParams({
        platform: 'WINDOWS',
        architecture: 'X86_64',
        order: 'RELEASE_DATE_DESC',
        limit: String(PAGE_SIZE),
        ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    });
    const response = await net.fetch(`${API_URL}?${query}`);
    if (!response.ok) {
        throw new Error(`Unity Release API responded with ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<ApiPage>;
};

// The `version` filter is a prefix match, so look for the exact version among the results.
export const fetchRelease = async (version: string): Promise<ApiRelease> => {
    const page = await queryReleases({ version });
    const release = page.results.find(r => r.version === version);
    if (!release) {
        throw new Error(`Unity ${version} was not found in the release API.`);
    }
    return release;
};

export const getWindowsDownload = (release: ApiRelease) => {
    const download = release.downloads.find(d => d.platform === 'WINDOWS' && d.type === 'EXE');
    if (!download) {
        throw new Error(`Unity ${release.version} has no Windows installer.`);
    }
    return download;
};

const toModuleModel = (m: ApiModule): ReleaseModuleModel => ({
    id: m.id,
    name: m.name,
    description: m.description,
    category: m.category,
    downloadSize: m.downloadSize?.value ?? 0,
    installedSize: m.installedSize?.value ?? 0,
    required: m.required,
    hidden: m.hidden,
    preSelected: m.preSelected,
    eula: (m.eula ?? []).map(({ url, label, message }) => ({ url, label, message })),
    subModules: (m.subModules ?? []).map(toModuleModel),
});

const toReleaseModel = (release: ApiRelease, installed: Set<string>): ReleaseModel => {
    const download = release.downloads.find(d => d.platform === 'WINDOWS' && d.type === 'EXE');
    return {
        version: release.version,
        releaseDate: release.releaseDate,
        stream: release.stream,
        recommended: release.recommended,
        releaseNotesUrl: release.releaseNotes?.url ?? null,
        downloadSize: download?.downloadSize?.value ?? 0,
        installedSize: download?.installedSize?.value ?? 0,
        modules: (download?.modules ?? []).map(toModuleModel),
        installed: installed.has(release.version),
    };
};

const installedVersions = () => new Set(getInstalledEditors().map(e => e.version));

ipcMain.handle('releases:list', async (_event, stream: ReleaseStream | null, search: string, offset: number): Promise<ReleasePage> => {
    const params: Record<string, string | number> = { offset };
    if (stream) {
        params.stream = stream;
    }
    if (search.trim()) {
        params.version = search.trim();
    }
    const page = await queryReleases(params);
    const installed = installedVersions();
    return { total: page.total, offset: page.offset, results: page.results.map(r => toReleaseModel(r, installed)) };
});

ipcMain.handle('releases:get', async (_event, version: string): Promise<ReleaseModel> =>
    toReleaseModel(await fetchRelease(version), installedVersions()));

// What an update keeps: a final (LTS / Supported / Tech: 6000.6.0f1) updates to a final, a beta (6000.7.0b3) to a beta,
// an alpha to an alpha.
const releaseKind = (version: string) => {
    const letter = /^\d+\.\d+\.\d+([a-z])\d+/.exec(version)?.[1];
    return letter === 'a' ? 'alpha' : letter === 'b' ? 'beta' : 'final';
};

const lineOf = (version: string) => version.split('.').slice(0, 2).join('.');

const KIND_STREAMS: Record<string, ReleaseStream | undefined> = { alpha: 'ALPHA', beta: 'BETA', final: undefined };

// For every installed editor:
// `patch`  - the newest release of the same major.minor line and kind (6000.0.32f1 -> 6000.0.85f1, 6000.7.0b3 -> 6000.7.0b9);
// `latest` - the newest release of the same kind from a newer line (6000.5.1f1 -> 6000.6.6f1).
ipcMain.handle('releases:check-updates', async (): Promise<Record<string, EditorUpdates>> => {
    const installed = getInstalledEditors().map(e => e.version);
    const installedSet = new Set(installed);
    const lines = [...new Set(installed.map(lineOf))];

    // Newest first: one page of a line has its latest finals, and its betas until the line went final.
    const releasesByLine = new Map<string, string[]>();
    await Promise.all(lines.map(async (line) => {
        try {
            const page = await queryReleases({ version: `${line}.` });
            releasesByLine.set(line, page.results.map(r => r.version));
        } catch (error) {
            console.error(`Failed to check updates for ${line}:`, error);
        }
    }));

    // The newest version of each kind: the most recent page holds the latest patch of every line still being released.
    const latestByKind = new Map<string, string>();
    await Promise.all([...new Set(installed.map(releaseKind))].map(async (kind) => {
        try {
            const stream = KIND_STREAMS[kind];
            const page = await queryReleases(stream ? { stream } : {});
            const newest = page.results.map(r => r.version).filter(v => releaseKind(v) === kind).sort(compareVersions).pop();
            if (newest) {
                latestByKind.set(kind, newest);
            }
        } catch (error) {
            console.error(`Failed to check the latest ${kind} release:`, error);
        }
    }));

    const isNew = (candidate: string | undefined, version: string) =>
        candidate != null && compareVersions(candidate, version) > 0 && !installedSet.has(candidate);

    const updates: Record<string, EditorUpdates> = {};
    for (const version of installed) {
        const patch = releasesByLine.get(lineOf(version))?.find(v => releaseKind(v) === releaseKind(version));
        const latest = latestByKind.get(releaseKind(version));
        const result: EditorUpdates = {
            patch: isNew(patch, version) ? patch : undefined,
            latest: latest && lineOf(latest) !== lineOf(version) && isNew(latest, version) ? latest : undefined,
        };
        if (result.patch || result.latest) {
            updates[version] = result;
        }
    }
    return updates;
});
