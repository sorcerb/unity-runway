import { useEffect, useState } from "react";
import { EditorFolderModel } from "../models/EditorFolderModel";
import EditorFolderRow from "../components/EditorFolderRow";

const Editors = () => {
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
    const [editorFolders, setEditorFolders] = useState<EditorFolderModel[]>([]);

    const loadData = async () => {
        const p = await window.electron.getEditorFolders();
        setEditorFolders(p);
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleSelectFolder = async () => {
        const folderPath = await window.electron.selectFolder();
        if (folderPath) {
            setSelectedFolder(folderPath);
            const model: EditorFolderModel = { path: folderPath };
            await window.electron.addEditorFolder(model);
            loadData();
        }
    };

    const handleShowFolderInExplorer = async (path: string) => {
        await window.electron.showFolderInExplorer(path);
        loadData();
    };

    const handleRemoveProject = async (path: string) => {
        await window.electron.removeEditorFolder(path);
        loadData();
    };

    return (
        <>
            <div className="h-12 flex items-center justify-between">
                <h1 className="text-xl text-neutral-100">Editors</h1>

                <div className="flex gap-4">
                    <button className="px-4 py-1 bg-zinc-500 text-white rounded hover:bg-zinc-400" onClick={() => handleSelectFolder()}>
                        Add
                    </button>
                </div>
            </div>

            <div className="mt-5 text-xs">
                {editorFolders.map((editorFolder) => (
                    <EditorFolderRow
                        key={editorFolder.path}
                        model={editorFolder}
                        removeEditorFolder={handleRemoveProject}
                        showFolderInExplorer={handleShowFolderInExplorer}>
                    </EditorFolderRow>
                ))}
            </div>
        </>
    );
}

export default Editors;