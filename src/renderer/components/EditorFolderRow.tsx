import { useEffect, useRef, useState } from 'react';
import { EllipsisVerticalIcon } from "@heroicons/react/24/outline";
import { EditorFolderModel, EditorModel } from '../models/EditorFolderModel';

const EditorFolderRow = (props: { model: EditorFolderModel; removeEditorFolder: (path: string) => void, showFolderInExplorer: (path: string) => void }) => {
    const [editors, setEditors] = useState<EditorModel[]>([]);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchModifiedDate = async () => {
            const editorVersions = await window.electron.getEditors(props.model.path);
            if (editorVersions) {
                setEditors(editorVersions);
            } else {
                setEditors([]);
            }
        };

        fetchModifiedDate();
    }, [props.model.path]);


    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const handleDropdownToggle = () => {
        setDropdownOpen(!dropdownOpen);
    };

    const handleShowInExplorer = () => {
        props.showFolderInExplorer(props.model.path);
        setDropdownOpen(false);
    };

    const handleRemove = () => {
        props.removeEditorFolder(props.model.path);
    };

    return (
        <>
            <div className="flex mb-10 items-center justify-between rounded text-neutral-400 hover:bg-neutral-800">
                <div className="p-2">
                    <b className="text-neutral-200">{props.model.path}</b><br />

                    {editors.map((editor) => (
                        <div key={editor.version} className="ms-3 my-1">{editor.version}</div>
                    ))}

                </div>
                <div className="p-2 me-4 w-10 relative">
                    <button
                        className="text-center py-1 text-neutral rounded hover:bg-neutral-700"
                        onClick={handleDropdownToggle}
                    >
                        <EllipsisVerticalIcon className="h-6 w-6 mx-1 text-neutral-400" />
                    </button>
                    {dropdownOpen && (
                        <div ref={dropdownRef} className="absolute right-7 top-7 mt-2 w-52 bg-neutral-900 border border-neutral-600 shadow-lg rounded z-50">
                            <button
                                className="block w-full px-4 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-700"
                                onClick={handleShowInExplorer}
                            >
                                Show in explorer
                            </button>
                            <button
                                className="block w-full px-4 py-2 text-left text-sm text-red-200 hover:bg-red-700"
                                onClick={handleRemove}
                            >
                                Remove from list
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

export default EditorFolderRow;