import { useEffect, useMemo, useState } from "react";
import { Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select, TextField } from "@mui/material";
import { EditorModel, ProjectTemplateModel } from "../models/EditorFolderModel";

const BROWSE = '__browse__';
const EMPTY = '__empty__';

const compareVersions = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
const isFinal = (version: string) => !/\d[ab]\d+$/.test(version);
const editorKey = (editor: EditorModel) => `${editor.path}|${editor.version}`;

// Unity Hub starts with 3D URP: `urp-blank` in newer editors, `3d-cross-platform` in older Unity 6; else whatever the editor ships.
const defaultTemplate = (templates: ProjectTemplateModel[]) =>
    templates.find(t => t.name.endsWith('.urp-blank')) ?? templates.find(t => t.name.endsWith('.3d-cross-platform')) ?? templates[0];

interface NewProjectModalProps {
    open: boolean;
    editors: EditorModel[];
    // Folders other projects live in, most recently used first; the first one is the default location.
    locations: string[];
    onClose: () => void;
    onCreated: () => void;
}

const NewProjectModal = ({ open, editors, locations, onClose, onCreated }: NewProjectModalProps) => {
    const sortedEditors = useMemo(() => [...editors].sort((a, b) => compareVersions(b.version, a.version)), [editors]);
    const [editor, setEditor] = useState('');
    const [templates, setTemplates] = useState<ProjectTemplateModel[] | null>(null);
    const [template, setTemplate] = useState(EMPTY);
    const [name, setName] = useState('My project');
    const [folders, setFolders] = useState<string[]>([]);
    const [parentDir, setParentDir] = useState('');
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) {
            return;
        }
        const newestFinal = sortedEditors.find(e => isFinal(e.version)) ?? sortedEditors[0];
        setEditor(newestFinal ? editorKey(newestFinal) : '');
        setName('My project');
        setFolders(locations);
        setParentDir(locations[0] ?? '');
        setError(null);
        setCreating(false);
    }, [open]);

    const selectedEditor = sortedEditors.find(e => editorKey(e) === editor);

    useEffect(() => {
        if (!open || !selectedEditor) {
            return;
        }
        setTemplates(null);
        setError(null);
        const load = async () => {
            try {
                const list = await window.electron.getProjectTemplates(selectedEditor);
                setTemplates(list);
                setTemplate(defaultTemplate(list)?.path ?? EMPTY);
            } catch (e) {
                // Still allow an empty project when the templates can't be read.
                setTemplates([]);
                setTemplate(EMPTY);
                setError(`Could not read the templates: ${(e as Error).message}`);
            }
        };
        load();
    }, [open, editor]);

    const handleFolderChange = async (value: string) => {
        if (value !== BROWSE) {
            setParentDir(value);
            return;
        }
        const folder = await window.electron.selectFolder('Select a folder for the new project...', 'Select Folder');
        if (folder) {
            setFolders(prev => prev.includes(folder) ? prev : [folder, ...prev]);
            setParentDir(folder);
        }
    };

    const handleCreate = async () => {
        if (!selectedEditor) {
            return;
        }
        setCreating(true);
        setError(null);
        const result = await window.electron.createProject({
            editor: selectedEditor,
            parentDir,
            name,
            template: template === EMPTY ? null : template,
        });
        setCreating(false);
        if (result.success) {
            onCreated();
            onClose();
        } else {
            setError(result.message);
        }
    };

    const canCreate = selectedEditor != null && templates != null && name.trim() !== '' && parentDir !== '' && !creating;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>New project</DialogTitle>
            <DialogContent dividers>
                {sortedEditors.length === 0 ? (
                    <div className="text-sm text-neutral-300">No editors installed. Install one on the Install page first.</div>
                ) : <>
                    <FormControl fullWidth size="small" sx={{ mt: 1 }}>
                        <InputLabel id="new-project-editor-label">Editor version</InputLabel>
                        <Select labelId="new-project-editor-label" label="Editor version" value={editor} onChange={(e) => setEditor(e.target.value)}>
                            {sortedEditors.map(e => (
                                <MenuItem key={editorKey(e)} value={editorKey(e)}>
                                    {e.version}
                                    {sortedEditors.filter(o => o.version === e.version).length > 1 && <span className="ms-2 text-neutral-500">{e.path}</span>}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <div className="text-sm text-neutral-200 font-bold mt-4 mb-2">Template</div>
                    {templates == null ? (
                        <div className="flex justify-center p-4"><CircularProgress size={24} /></div>
                    ) : (
                        <div className="grid grid-cols-2 gap-2">
                            {[...templates, { path: EMPTY, name: '', displayName: 'Empty', description: 'A blank project with the built-in render pipeline and no extra packages.' }].map(t => (
                                <div
                                    key={t.path}
                                    className={`p-2 rounded border cursor-pointer ${template === t.path ? 'border-blue-400 bg-neutral-800' : 'border-neutral-700 hover:bg-neutral-800'}`}
                                    onClick={() => setTemplate(t.path)}
                                >
                                    <div className="text-sm text-neutral-200">{t.displayName}</div>
                                    <div className="text-xs text-neutral-400 mt-1 line-clamp-3">{t.description}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    <TextField
                        fullWidth
                        size="small"
                        label="Project name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        sx={{ mt: 3 }}
                    />

                    <FormControl fullWidth size="small" sx={{ mt: 2 }}>
                        <InputLabel id="new-project-folder-label">Location</InputLabel>
                        <Select labelId="new-project-folder-label" label="Location" value={parentDir} onChange={(e) => handleFolderChange(e.target.value)}>
                            {folders.map(f => <MenuItem key={f} value={f}>{f}</MenuItem>)}
                            <MenuItem value={BROWSE}><i>Browse...</i></MenuItem>
                        </Select>
                    </FormControl>
                    {parentDir && name.trim() && <div className="text-xs text-neutral-400 mt-1">{parentDir}\{name.trim()}</div>}

                    {error && <div className="text-red-300 text-sm mt-3">{error}</div>}
                </>}
            </DialogContent>
            <DialogActions sx={{ px: 3 }}>
                <Button variant="outlined" onClick={onClose}>Cancel</Button>
                <Button variant="contained" disabled={!canCreate} onClick={handleCreate}>Create</Button>
            </DialogActions>
        </Dialog>
    );
};

export default NewProjectModal;
