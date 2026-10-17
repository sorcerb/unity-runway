import { useEffect, useState } from "react";
import { FolderOpenIcon, TrashIcon } from "@heroicons/react/24/outline";
import { EditorFolderModel } from "../models/EditorFolderModel";
import UpdateSettings from "../components/UpdateSettings";

const Settings = () => {
    const [importing, setImporting] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [editorFolders, setEditorFolders] = useState<EditorFolderModel[]>([]);

    const loadEditorFolders = async () => setEditorFolders(await window.electron.getEditorFolders());

    useEffect(() => {
        loadEditorFolders();
    }, []);

    const handleAddEditorFolder = async () => {
        const folderPath = await window.electron.selectFolder('Select a folder with Unity editors...', 'Add Folder');
        if (folderPath) {
            await window.electron.addEditorFolder({ path: folderPath });
            loadEditorFolders();
        }
    };

    const handleRemoveEditorFolder = async (path: string) => {
        await window.electron.removeEditorFolder(path);
        loadEditorFolders();
    };

    const handleImportFromHub = async () => {
        setImporting(true);
        try {
            const [projects, folders] = await Promise.all([
                window.electron.importHubProjects(),
                window.electron.importHubEditorFolders(),
            ]);
            setMessage(projects.found === 0 && folders.found === 0
                ? 'Nothing to import: Unity Hub data was not found.'
                : `Imported ${projects.added} of ${projects.found} projects and ${folders.added} of ${folders.found} editor folders.`);
            loadEditorFolders();
        } catch (e) {
            setMessage((e as Error).message);
        } finally {
            setImporting(false);
        }
    };

    return (
        <>
            <div className="h-12 flex items-center justify-between">
                <h1 className="text-xl text-neutral-100">Settings</h1>
            </div>

            <div className="mt-5 p-4 rounded border border-neutral-700">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <b className="text-neutral-200">Editor folders</b>
                        <div className="text-xs mt-1">
                            Folders searched for installed editors, one sub-folder per version (<code>&lt;folder&gt;\6000.0.32f1\Editor\Unity.exe</code>).
                        </div>
                    </div>
                    <button
                        className="px-4 py-1 shrink-0 bg-neutral-600 text-white rounded hover:bg-neutral-500"
                        onClick={() => handleAddEditorFolder()}
                    >
                        Add folder
                    </button>
                </div>

                <div className="mt-3 text-xs">
                    {editorFolders.length === 0 && <div className="text-neutral-500">No folders added yet.</div>}
                    {editorFolders.map(folder => (
                        <div key={folder.path} className="flex items-center justify-between gap-2 px-2 py-1 rounded text-neutral-300 hover:bg-neutral-800">
                            <span className="truncate">{folder.path}</span>
                            <div className="flex shrink-0 gap-1">
                                <button
                                    className="p-1 rounded hover:bg-neutral-700"
                                    title="Show in explorer"
                                    onClick={() => window.electron.showFolderInExplorer(folder.path)}
                                >
                                    <FolderOpenIcon className="h-4 w-4 text-neutral-400" />
                                </button>
                                <button
                                    className="p-1 rounded hover:bg-red-700"
                                    title="Remove from list (the editors stay on disk)"
                                    onClick={() => handleRemoveEditorFolder(folder.path)}
                                >
                                    <TrashIcon className="h-4 w-4 text-neutral-400" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-5 p-4 rounded border border-neutral-700 flex items-center justify-between gap-4">
                <div>
                    <b className="text-neutral-200">Unity Hub</b>
                    <div className="text-xs mt-1">
                        Import the project list and editor install folders from Unity Hub. Already added items are skipped.
                    </div>
                    {message && <div className="text-xs mt-2 text-neutral-300">{message}</div>}
                </div>
                <button
                    className="px-4 py-1 shrink-0 bg-neutral-600 text-white rounded hover:bg-neutral-500 disabled:opacity-50"
                    disabled={importing}
                    onClick={() => handleImportFromHub()}
                >
                    {importing ? 'Importing...' : 'Import from Hub'}
                </button>
            </div>

            <UpdateSettings />
        </>
    );
}

export default Settings;
