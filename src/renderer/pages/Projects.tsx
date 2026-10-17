import { useEffect, useMemo, useState } from "react";
import { ProjectModel } from "../models/ProjectModel";
import { GridColDef, DataGrid, GridSortItem, gridClasses } from "@mui/x-data-grid";
import RenameModal from "../components/RenameModal";
import TagsModal from "../components/TagsModal";
import NewProjectModal from "../components/NewProjectModal";
import { Box, InputAdornment, TextField } from "@mui/material";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { EditorModel } from "../models/EditorFolderModel";
import { getColumns } from "./ProjectGridColumns";

const Projects = () => {

    const [projects, setProjects] = useState<ProjectModel[]>([]);
    const [sortModel, setSortModel] = useState([{ field: 'modified', sort: 'desc' } as GridSortItem]);

    const [editors, setEditors] = useState<EditorModel[]>([]);

    const [filteredRows, setFilteredRows] = useState<ProjectModel[]>(projects);

    const [selectedModel, setSelectedModel] = useState<ProjectModel | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [renameModal, setRenameModal] = useState(false);
    const [newName, setNewName] = useState<string | null>(null);

    const [newProjectModal, setNewProjectModal] = useState(false);

    const [tagsModal, setTagsModal] = useState(false);
    const [tags, setTags] = useState<string[]>([]);

    const handleRenameOpen = (model: ProjectModel) => {
        setSelectedModel(model);
        return setRenameModal(true);
    }
    const handleRenameClose = () => {
        setNewName(null);
        setSelectedModel(null);
        return setRenameModal(false)
    };

    const handleSaveRename = async () => {
        if (selectedModel != null && newName != null && newName.trim() && selectedModel?.name != newName.trim()) {
            const result = await window.electron.renameProject(selectedModel.path, newName);
            loadData();
            // On failure the main process shows the error; keep the modal open so the name can be corrected.
            if (result.success) {
                handleRenameClose();
            }
        }
    };


    const handleTagsOpen = (model: ProjectModel) => {
        setSelectedModel(model);
        setTags(model.tags);
        return setTagsModal(true);
    }
    const handleTagsClose = () => {
        setTags([]);
        setSelectedModel(null);
        return setTagsModal(false)
    };

    const handleSaveTags = async () => {
        if (selectedModel != null && tags != null && selectedModel?.tags != tags) {
            await window.electron.updateProject(selectedModel.path, { tags });
            loadData();
            handleTagsClose();
        }
    };

    const loadData = async () => {
        const p = await window.electron.getProjects();
        setProjects(p);
        filterRows(searchTerm);
    };

    const loadEditors = async () => {
        const editors = await window.electron.getEditors(null);
        setEditors(editors);
    }

    useEffect(() => {
        loadEditors().then(() => {
            loadData();
        });
    }, []);

    useEffect(() => {
        filterRows(searchTerm);
    }, [projects]);

    const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
        const term = event.target.value.toLowerCase();
        setSearchTerm(term);
        const filtered = projects.filter(
            (project) =>
                project.name.toLowerCase().includes(term) ||
                project.tags.find(s => s.toLowerCase().includes(term))
        );
        setFilteredRows(filtered);
    };

    const clearSearch = () => {
        setSearchTerm('');
        filterRows('');
    }

    const filterRows = (term: string) => {
        const lowerCaseTerm = term.toLowerCase();
        const filtered = projects.filter(
            (project) =>
                project.name.toLowerCase().includes(lowerCaseTerm) ||
                project.tags.find(s => s.toLowerCase().includes(lowerCaseTerm))
        );
        setFilteredRows(filtered);
    };

    // Where new projects go by default: the folders existing projects live in, most recently opened first.
    const projectLocations = useMemo(() => {
        const recent = [...projects].sort((a, b) => (b.lastOpened ?? '').localeCompare(a.lastOpened ?? ''));
        return [...new Set(recent.map(p => p.path.replace(/[\\/][^\\/]+[\\/]?$/, '')))];
    }, [projects]);

    const handleSelectFolder = async () => {
        const folderPath = await window.electron.selectFolder();
        if (folderPath) {
            const folderName = folderPath.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? "";
            const model: ProjectModel = {
                path: folderPath, name: folderName, tags: [],
                preview: null,
                modified: null,
                modifiedText: "",
                editorVersion: "",
                id: "",
                selectedEditor: null
            };
            await window.electron.addProject(model);
            loadData();
        }
    };

    const handleShowFolderInExplorer = async (path: string) => {
        await window.electron.showFolderInExplorer(path);
        loadData();
    };

    const handleRemoveProject = async (path: string) => {
        await window.electron.removeProject(path);
        loadData();
    };

    const openProject = async (model: ProjectModel) => {
        const editor = model.selectedEditor ?? editors.find(s => s.version === model.editorVersion);
        if (editor) {
            const result = await window.electron.launchProject(editor, model.path);
            if (result.success) {
                loadData();
            }
        }
    }

    const handleEditorChange = async (model: ProjectModel, editor: EditorModel | null) => {
        // Following the project's own version is the default, so don't pin it explicitly.
        const selectedEditor = editor?.version === model.editorVersion ? null : editor;
        await window.electron.updateProject(model.path, { selectedEditor });
        setProjects(prev => prev.map(p => p.path === model.path ? { ...p, selectedEditor } : p));
    }

    const columns: GridColDef[] = getColumns(
        editors,
        openProject,
        handleEditorChange,
        handleShowFolderInExplorer,
        handleRenameOpen,
        handleTagsOpen,
        handleRemoveProject
    )

    return (
        <>
            <div className="h-12 mb-4 flex items-center justify-between">
                <h1 className="text-xl text-neutral-100">Projects</h1>
                <TextField
                    value={searchTerm}
                    onChange={handleSearch}
                    size="small"
                    className="mx-1"
                    placeholder="Search..."
                    slotProps={{
                        input: {
                            startAdornment: (
                                <>
                                    <InputAdornment position="start">
                                        <MagnifyingGlassIcon className="w-5" />
                                    </InputAdornment>
                                </>
                            ),
                            endAdornment: (
                                <>
                                    <InputAdornment position="end">
                                        {searchTerm.length > 0 &&
                                            <XMarkIcon className="w-5 cursor-pointer" onClick={clearSearch} />
                                        }
                                        {searchTerm.length === 0 &&
                                            <div className="w-5"></div>
                                        }
                                    </InputAdornment>

                                </>
                            ),
                        },
                    }}
                />

                <div className="flex gap-4">
                    <button className="px-4 py-1 bg-neutral-600 text-white rounded hover:bg-neutral-500" onClick={() => handleSelectFolder()}>
                        Add
                    </button>
                    <button className="px-4 py-1 bg-blue-500 text-white rounded hover:bg-blue-400" onClick={() => { loadEditors(); setNewProjectModal(true); }}>
                        New
                    </button>
                </div>
            </div>


            <Box sx={{ height: 'calc(100vh - 80px)' }}>
                <DataGrid style={{ overflow: 'hidden', minWidth: 0 }}
                    rows={filteredRows}
                    columns={columns}
                    getRowHeight={() => 'auto'}
                    pageSizeOptions={[filteredRows.length]}
                    hideFooterPagination={true}
                    hideFooter
                    disableColumnMenu={true}
                    sortModel={sortModel}
                    onSortModelChange={(model) => setSortModel(model)}
                    sx={{
                        '.MuiDataGrid-cell': {
                            display: 'flex',
                            alignItems: 'center',
                        },
                        '&, [class^=MuiDataGrid]': { border: 'none' },
                        [`& .${gridClasses.columnHeader}, & .${gridClasses.cell}`]: {
                            outline: 'transparent',
                        },
                        [`& .${gridClasses.columnHeader}: focus - within, & .${gridClasses.cell}: focus - within`]: {
                            outline: 'none',
                        },
                        "& .MuiDataGrid-cell:focus-within, & .MuiDataGrid-cell:focus": {
                            outline: "none !important",
                        },
                        "& .MuiDataGrid-columnHeader:focus-within, & .MuiDataGrid-columnHeader:focus":
                        {
                            outline: "none !important",
                        },
                    }}
                />
            </Box>

            <RenameModal
                open={renameModal}
                onClose={handleRenameClose}
                selectedModel={selectedModel}
                newName={newName}
                onSetNewName={setNewName}
                onSaveRename={handleSaveRename}
            />

            <TagsModal
                open={tagsModal}
                onClose={handleTagsClose}
                selectedModel={selectedModel}
                tags={tags}
                onSetTags={setTags}
                onSaveTags={handleSaveTags}
            />

            <NewProjectModal
                open={newProjectModal}
                editors={editors}
                locations={projectLocations}
                onClose={() => setNewProjectModal(false)}
                onCreated={loadData}
            />

        </>
    );
}

export default Projects;