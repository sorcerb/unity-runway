import { useEffect, useMemo, useState } from "react";
import { Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel, InputLabel, MenuItem, Select } from "@mui/material";
import { EulaModel, ReleaseModel, ReleaseModuleModel } from "../models/ReleaseModel";
import { EditorModel } from "../models/EditorFolderModel";
import { formatSize } from "../utils/format";

const DEFAULT_EDITORS_PATH = 'C:\\Program Files\\Unity\\Hub\\Editor';
const BROWSE = '__browse__';

const CATEGORY_LABELS: Record<string, string> = {
    PLATFORM: 'Platforms',
    DEV_TOOL: 'Dev tools',
    PLUGIN: 'Plugins',
    LANGUAGE_PACK: 'Language packs',
    DOCUMENTATION: 'Documentation',
};

// A module installs together with its required sub-modules (e.g. Android SDK/NDK/OpenJDK).
const withRequired = (module: ReleaseModuleModel): ReleaseModuleModel[] =>
    [module, ...module.subModules.filter(s => s.required).flatMap(withRequired)];

const lineOf = (version: string) => version.split('.').slice(0, 2).join('.');
const compareVersions = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

// The editor whose modules a new install starts with: the newest installed one of the same line (an update),
// else the newest installed editor.
const previousEditor = (version: string, editors: EditorModel[]) => {
    const sorted = editors.filter(e => e.version !== version).sort((a, b) => compareVersions(b.version, a.version));
    return sorted.find(e => lineOf(e.version) === lineOf(version)) ?? sorted[0] ?? null;
};

interface InstallModalProps {
    version: string | null;
    defaultBasePath?: string;
    // An update of this editor: its modules are ticked and its folder is picked.
    from?: EditorModel;
    // Remove `from` once the new editor is installed (a patch update; a newer line installs side by side).
    replace?: boolean;
    onClose: () => void;
}

const InstallModal = ({ version, defaultBasePath, from, replace, onClose }: InstallModalProps) => {
    const [release, setRelease] = useState<ReleaseModel | null>(null);
    const [folders, setFolders] = useState<string[]>([]);
    const [basePath, setBasePath] = useState('');
    const [installedPath, setInstalledPath] = useState<string | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [installedModules, setInstalledModules] = useState<Set<string>>(new Set());
    const [eulaAccepted, setEulaAccepted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!version) {
            return;
        }
        setRelease(null);
        setSelected(new Set());
        setInstalledModules(new Set());
        setEulaAccepted(false);
        setError(null);

        Promise.all([window.electron.getRelease(version), window.electron.getEditorFolders(), window.electron.getEditors(null)])
            .then(([release, editorFolders, editors]) => {
                const paths = editorFolders.map(f => f.path);
                // An installed editor can only get modules added in place.
                const installedEditor = editors.find(e => e.version === version);
                const installedIn = installedEditor?.path ?? null;
                setInstalledPath(installedIn);
                const visible = new Set(release.modules.filter(m => !m.hidden).map(m => m.id));
                if (installedEditor) {
                    setInstalledModules(new Set((installedEditor.modules ?? []).filter(id => visible.has(id))));
                } else {
                    // Tick what the previous editor has, so an update keeps the same platforms.
                    setSelected(new Set(((from ?? previousEditor(version, editors))?.modules ?? []).filter(id => visible.has(id))));
                }
                setFolders(paths.length > 0 ? paths : [DEFAULT_EDITORS_PATH]);
                setBasePath(installedIn ?? from?.path ?? defaultBasePath ?? paths[0] ?? DEFAULT_EDITORS_PATH);
                setRelease(release);
            })
            .catch((e: Error) => setError(e.message));
    }, [version]);

    const visibleModules = useMemo(() => release?.modules.filter(m => !m.hidden) ?? [], [release]);
    const categories = useMemo(() => [...new Set(visibleModules.map(m => m.category))], [visibleModules]);

    const selectedPackages = visibleModules.filter(m => selected.has(m.id)).flatMap(withRequired);
    const eulas: EulaModel[] = selectedPackages.flatMap(m => m.eula);
    const editorDownload = installedPath ? 0 : release?.downloadSize ?? 0;
    const editorInstalled = installedPath ? 0 : release?.installedSize ?? 0;
    const downloadSize = editorDownload + selectedPackages.reduce((sum, m) => sum + m.downloadSize, 0);
    const installedSize = editorInstalled + selectedPackages.reduce((sum, m) => sum + m.installedSize, 0);
    const isUpdate = from != null && !installedPath;
    const replaces = isUpdate && replace ? from : undefined;
    const canInstall =release != null && (!installedPath || selected.size > 0) && (eulas.length === 0 || eulaAccepted);

    const toggle = (id: string) => {
        const next = new Set(selected);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelected(next);
        setEulaAccepted(false);
    };

    const handleFolderChange = async (value: string) => {
        if (value !== BROWSE) {
            setBasePath(value);
            return;
        }
        const folder = await window.electron.selectFolder('Select a folder for Unity editors...', 'Select Folder');
        if (folder) {
            setFolders(prev => prev.includes(folder) ? prev : [...prev, folder]);
            setBasePath(folder);
        }
    };

    const handleInstall = async () => {
        if (!release) {
            return;
        }
        try {
            await window.electron.startInstall({ version: release.version, basePath, moduleIds: [...selected], replaces });
            onClose();
        } catch (e) {
            setError((e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''));
        }
    };

    return (
        <Dialog open={version != null} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                {installedPath ? `Add modules to Unity ${version}` : replaces ? `Update Unity ${replaces.version} to ${version}` : `Install Unity ${version}`}
            </DialogTitle>
            <DialogContent dividers>
                {!release && !error && <div className="flex justify-center p-6"><CircularProgress /></div>}
                {error && <div className="text-red-300 text-sm mb-3">{error}</div>}

                {release && <>
                    {replaces && (
                        <div className="text-sm text-amber-300 mb-3">Unity {replaces.version} will be removed after the install.</div>
                    )}
                    {isUpdate && !replaces && (
                        <div className="text-sm text-neutral-400 mb-3">
                            Installs next to Unity {from.version}. Projects are upgraded when opened with the new version, so {from.version} is kept.
                        </div>
                    )}
                    <FormControl fullWidth size="small" sx={{ mt: 1 }}>
                        <InputLabel id="install-folder-label">Install location</InputLabel>
                        <Select
                            labelId="install-folder-label"
                            label="Install location"
                            value={basePath}
                            disabled={installedPath != null}
                            onChange={(e) => handleFolderChange(e.target.value)}
                        >
                            {(folders.includes(basePath) ? folders : [...folders, basePath]).map(f => <MenuItem key={f} value={f}>{f}</MenuItem>)}
                            <MenuItem value={BROWSE}><i>Browse...</i></MenuItem>
                        </Select>
                    </FormControl>
                    <div className="text-xs text-neutral-400 mt-1 mb-3">{basePath}\{release.version}</div>

                    {categories.map(category => (
                        <div key={category} className="mb-3">
                            <div className="text-sm text-neutral-200 font-bold mb-1">{CATEGORY_LABELS[category] ?? category}</div>
                            {visibleModules.filter(m => m.category === category).map(module => {
                                const packages = withRequired(module);
                                const isInstalled = installedModules.has(module.id);
                                return (
                                    <div key={module.id} className="flex items-center justify-between text-sm">
                                        <FormControlLabel
                                            control={<Checkbox size="small" checked={isInstalled || selected.has(module.id)} disabled={isInstalled} onChange={() => toggle(module.id)} />}
                                            label={<span title={module.description}>{module.name}{isInstalled && <span className="text-neutral-500"> (installed)</span>}</span>}
                                        />
                                        <span className="text-xs text-neutral-400 whitespace-nowrap">
                                            {formatSize(packages.reduce((sum, m) => sum + m.downloadSize, 0))}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    ))}

                    {eulas.length > 0 && (
                        <div className="mt-4 p-3 rounded border border-neutral-600 text-sm">
                            {eulas.map(eula => (
                                <div key={eula.url} className="mb-2">
                                    <div className="text-neutral-300">{eula.message}</div>
                                    <a className="text-blue-300 cursor-pointer underline" onClick={() => window.electron.openExternal(eula.url)}>{eula.label}</a>
                                </div>
                            ))}
                            <FormControlLabel
                                control={<Checkbox size="small" checked={eulaAccepted} onChange={(e) => setEulaAccepted(e.target.checked)} />}
                                label="I have read and accept the license terms"
                            />
                        </div>
                    )}
                </>}
            </DialogContent>
            <DialogActions sx={{ justifyContent: 'space-between', px: 3 }}>
                <span className="text-xs text-neutral-400">
                    {release && `Download ${formatSize(downloadSize)} · On disk ${formatSize(installedSize)}`}
                </span>
                <div className="flex gap-2">
                    <Button variant="outlined" onClick={onClose}>Cancel</Button>
                    <Button variant="contained" disabled={!canInstall} onClick={handleInstall}>{replaces ? 'Update' : 'Install'}</Button>
                </div>
            </DialogActions>
        </Dialog>
    );
};

export default InstallModal;
