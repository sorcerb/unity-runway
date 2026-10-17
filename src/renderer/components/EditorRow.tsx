import { useState } from 'react';
import { Menu, MenuItem } from '@mui/material';
import { EllipsisVerticalIcon } from "@heroicons/react/24/outline";
import { EditorModel } from '../models/EditorFolderModel';
import { EditorUpdates } from '../models/ReleaseModel';

// Short labels for the modules worth showing; sub-modules (Android SDK, OpenJDK...) and unknown ids stay in the tooltip.
const MODULE_LABELS: Record<string, string> = {
    'android': 'Android',
    'ios': 'iOS',
    'appletv': 'tvOS',
    'visionos': 'visionOS',
    'webgl': 'Web',
    'windows-il2cpp': 'Windows IL2CPP',
    'windows-server': 'Windows Server',
    'universal-windows-platform': 'UWP',
    'linux-mono': 'Linux',
    'linux-il2cpp': 'Linux IL2CPP',
    'linux-server': 'Linux Server',
    'mac-mono': 'macOS',
    'mac-server': 'macOS Server',
    'documentation': 'Docs',
};

const releaseKind = (version: string) => {
    const letter = version.match(/\d([abf])\d+$/)?.[1];
    return letter === 'a' ? 'alpha' : letter === 'b' ? 'beta' : null;
};

const lineOf = (version: string) => version.split('.').slice(0, 2).join('.');

interface EditorRowProps {
    editor: EditorModel;
    updates?: EditorUpdates;
    // `replace`: remove this editor after the install (patch updates only).
    installUpdate: (editor: EditorModel, version: string, replace: boolean) => void;
    addModules: (editor: EditorModel) => void;
    showInExplorer: (editor: EditorModel) => void;
    uninstall: (editor: EditorModel) => void;
}

const EditorRow = ({ editor, updates, installUpdate, addModules, showInExplorer, uninstall }: EditorRowProps) => {
    const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

    const run = (action: (editor: EditorModel) => void) => () => {
        setMenuAnchor(null);
        action(editor);
    };

    const kind = releaseKind(editor.version);
    const { patch, latest } = updates ?? {};
    const modules = (editor.modules ?? []).filter(id => MODULE_LABELS[id]);

    return (
        // The open menu's backdrop takes the hover away, so the row keeps its highlight while the menu is open.
        <div className={`flex mb-2 items-center justify-between rounded text-neutral-400 hover:bg-neutral-800 ${menuAnchor ? 'bg-neutral-800' : ''}`}>
            <div className="p-2 min-w-0 grow">
                <div className="flex items-center gap-2">
                    <b className="text-sm text-neutral-200">{editor.version}</b>
                    {kind && <span className="px-1.5 rounded bg-amber-900 text-amber-200">{kind}</span>}
                </div>
                <div className="mt-0.5 text-neutral-500 truncate">{editor.path}\{editor.version}</div>
                {modules.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1" title={editor.modules?.join(', ')}>
                        {modules.map(id => <span key={id} className="px-1.5 rounded bg-neutral-700 text-neutral-300">{MODULE_LABELS[id]}</span>)}
                    </div>
                )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
                {patch && (
                    <button
                        className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-500"
                        title={`Install ${patch} (same ${lineOf(editor.version)} line) and remove ${editor.version}`}
                        onClick={() => installUpdate(editor, patch, true)}
                    >
                        Update to {patch}
                    </button>
                )}
                {latest && (
                    <button
                        className="px-3 py-1 rounded bg-neutral-600 text-white hover:bg-neutral-500"
                        title={`Install ${latest} next to ${editor.version}; projects are upgraded when opened with it`}
                        onClick={() => installUpdate(editor, latest, false)}
                    >
                        Latest {latest}
                    </button>
                )}
            </div>
            <div className="p-2 me-4">
                <button
                    className={`text-center py-1 text-neutral rounded hover:bg-neutral-700 ${menuAnchor ? 'bg-neutral-700' : ''}`}
                    onClick={(e) => setMenuAnchor(e.currentTarget)}
                >
                    <EllipsisVerticalIcon className="h-6 w-6 mx-1 text-neutral-400" />
                </button>
                {/* A portal, so the page's overflow-hidden can't clip it; flips up when there is no room below. */}
                <Menu
                    anchorEl={menuAnchor}
                    open={menuAnchor != null}
                    onClose={() => setMenuAnchor(null)}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                    {patch && <MenuItem onClick={run(e => installUpdate(e, patch, true))}>Update to {patch}</MenuItem>}
                    {latest && <MenuItem onClick={run(e => installUpdate(e, latest, false))}>Install latest {latest}</MenuItem>}
                    <MenuItem onClick={run(addModules)}>Add modules</MenuItem>
                    <MenuItem onClick={run(showInExplorer)}>Show in explorer</MenuItem>
                    <MenuItem onClick={run(uninstall)} sx={{ color: 'error.light' }}>Uninstall</MenuItem>
                </Menu>
            </div>
        </div>
    );
}

export default EditorRow;
