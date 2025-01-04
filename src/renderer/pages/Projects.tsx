import { useEffect, useState } from "react";
import { ProjectModel } from "../models/ProjectModel";
import { GridColDef, DataGrid, GridSortItem, gridClasses } from "@mui/x-data-grid";
import RenameModal from "../components/RenameModal";
import TagsModal from "../components/TagsModal";
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
        if (selectedModel != null && newName != null && selectedModel?.name != newName.trim()) {
            await window.electron.renameProject(selectedModel.path, newName);
            loadData();
            handleRenameClose();
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
            const model = selectedModel;
            if (model != null) {
                model.tags = tags;
                await window.electron.updateProject(selectedModel.path, model);
            }
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
                id: ""
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
        const editorPath = model.selectedEditor ?? editors.find(s => s.version === model.editorVersion);
        if (editorPath) {
            const editorExe = editorPath.path + '\\' + editorPath.version + '\\Editor\\Unity.exe';
            await window.electron.launchProject(editorExe, model.path);
        }
    }

    const columns: GridColDef[] = getColumns(
        editors,
        openProject,
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
                    <button className="px-4 py-1 bg-blue-500 text-white rounded hover:bg-blue-400">
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

        </>
    );
}

export default Projects;