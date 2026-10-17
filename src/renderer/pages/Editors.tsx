import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EditorModel } from "../models/EditorFolderModel";
import { EditorUpdates } from "../models/ReleaseModel";
import EditorRow from "../components/EditorRow";
import InstallModal from "../components/InstallModal";
import { useInstallState } from "../hooks/useInstallState";

const compareVersions = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

const errorMessage = (e: unknown) => (e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '');

const Editors = () => {
    const navigate = useNavigate();
    const [editors, setEditors] = useState<EditorModel[] | null>(null);
    const [updates, setUpdates] = useState<Record<string, EditorUpdates>>({});
    const [install, setInstall] = useState<{ version: string; from?: EditorModel; replace?: boolean } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const loadData = async () => {
        const all = await window.electron.getEditors(null);
        setEditors(all.sort((a, b) => compareVersions(b.version, a.version) || a.path.localeCompare(b.path)));
        window.electron.checkEditorUpdates().then(setUpdates).catch(() => setUpdates({}));
    };

    useInstallState(loadData);

    useEffect(() => {
        loadData();
    }, []);

    const handleUninstall = async (editor: EditorModel) => {
        setError(null);
        try {
            await window.electron.uninstallEditor(editor);
        } catch (e) {
            setError(errorMessage(e));
        }
    };

    return (
        <>
            <div className="h-12 flex items-center justify-between">
                <h1 className="text-xl text-neutral-100">Editors</h1>

                <button className="px-4 py-1 bg-blue-500 text-white rounded hover:bg-blue-400" onClick={() => navigate('/install')}>
                    Install
                </button>
            </div>

            {error && <div className="mt-3 text-sm text-red-300">{error}</div>}

            <div className="mt-5 text-xs">
                {editors?.length === 0 && (
                    <div className="text-sm text-neutral-400">
                        No editors found. Install one, or add the folder with your editors in <a className="text-blue-300 cursor-pointer hover:underline" onClick={() => navigate('/settings')}>Settings</a>.
                    </div>
                )}
                {editors?.map((editor) => (
                    <EditorRow
                        key={`${editor.path}|${editor.version}`}
                        editor={editor}
                        updates={updates[editor.version]}
                        installUpdate={(from, version, replace) => setInstall({ version, from, replace })}
                        addModules={(e) => setInstall({ version: e.version })}
                        showInExplorer={(e) => window.electron.showFolderInExplorer(`${e.path}\\${e.version}`)}
                        uninstall={handleUninstall}
                    />
                ))}
            </div>

            <InstallModal version={install?.version ?? null} from={install?.from} replace={install?.replace} onClose={() => setInstall(null)} />
        </>
    );
}

export default Editors;
