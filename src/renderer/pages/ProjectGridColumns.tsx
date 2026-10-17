import { GridColDef, GridActionsCellItem, GridCellParams, GridRowParams, GridSortCellParams } from "@mui/x-data-grid";
import { ExclamationTriangleIcon, PlayIcon } from "@heroicons/react/24/outline";
import { Chip, FormControl, IconButton, MenuItem, Select, SelectChangeEvent } from "@mui/material";
import { ProjectModel } from "../models/ProjectModel";
import { EditorModel } from "../models/EditorFolderModel";

export const getColumns = (
    editors: EditorModel[],
    openProject: (model: ProjectModel) => Promise<void>,
    onEditorChange: (model: ProjectModel, editor: EditorModel | null) => Promise<void>,
    handleShowFolderInExplorer: (path: string) => Promise<void>,
    handleRenameOpen: (model: ProjectModel) => void,
    handleTagsOpen: (model: ProjectModel) => void,
    handleRemoveProject: (path: string) => Promise<void>,
    handleSetPreview: (model: ProjectModel) => Promise<void>
): GridColDef[] => {

    return [
        {
            field: "preview", headerName: "", sortable: false, width: 150, resizable: false,
            renderCell: (params: GridCellParams) => {
                return params.row.preview ? (
                    <img src={params.row.preview} alt="Preview" className="w-32 aspect-video my-1 p-0 object-cover rounded border border-neutral-600" />
                ) : (
                    <div className="w-32 aspect-video my-1 p-0 rounded border border-neutral-600"></div>
                );
            }
        },
        {
            field: 'name', headerName: 'Name', flex: 1,
            renderCell: (params: GridCellParams) => {
                return <>
                    <div className="text-neutral-200"><b>{params.row.name}</b><br />
                        {params.row.path}
                    </div>
                </>;
            }
        },
        {
            field: 'tags', headerName: 'Tags', flex: 1, sortable: false,
            renderCell: (params: GridCellParams) => {
                return <>
                    {params.row.tags.map((tag: string, index: number) => (
                        <Chip
                            key={index}
                            label={tag}
                            variant="outlined"
                            size="small" />
                    ))}
                </>;
            }
        },
        {
            field: 'modified', headerName: 'Opened', renderCell: (params: GridCellParams) => <>{params.row.modifiedText}</>,
            sortComparator: (_v1: unknown, _v2: unknown, cellParams1: GridSortCellParams, cellParams2: GridSortCellParams) => {
                const date1 = new Date(cellParams1.value);
                const date2 = new Date(cellParams2.value);
                return date1.getTime() - date2.getTime();
            }, width: 120
        },
        {
            field: 'editor', headerName: 'Editor', width: 120, sortable: false,
            renderCell: (params: GridCellParams<ProjectModel>) => {
                const row = params.row;
                const value = row.selectedEditor?.version ?? row.editorVersion;
                const isInstalled = (version: string) => editors.some(s => s.version === version);

                const handleChange = (event: SelectChangeEvent) => {
                    onEditorChange(row, editors.find(s => s.version === event.target.value) ?? null);
                };

                return <>
                    <div className="font-bold text-neutral-200">
                        <FormControl size="small" variant="standard">
                            <Select
                                id={`editor-version-${row.id}`}
                                value={value}
                                onChange={handleChange}
                            >
                                {!isInstalled(row.editorVersion) && (
                                    <MenuItem value={row.editorVersion}>{row.editorVersion}</MenuItem>
                                )}
                                {row.selectedEditor && row.selectedEditor.version !== row.editorVersion && !isInstalled(row.selectedEditor.version) && (
                                    <MenuItem value={row.selectedEditor.version}>{row.selectedEditor.version}</MenuItem>
                                )}
                                {editors.map((editor) => (
                                    <MenuItem key={editor.version} value={editor.version}>
                                        {editor.version}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </div>
                </>;
            }
        },
        {
            field: 'launch', type: 'actions', headerName: '', width: 50, sortable: false, resizable: false,
            getActions: (params: GridRowParams<ProjectModel>) => {
                const version = params.row.selectedEditor?.version ?? params.row.editorVersion;
                const editorExists = editors.some((s) => s.version === version);

                return editorExists
                    ? [
                        <GridActionsCellItem
                            icon={<PlayIcon className="w-6 text-green-300" />}
                            label="Launch project"
                            onClick={() => openProject(params.row)} />,
                    ]
                    : [
                        <IconButton title={`Unity ${version} is not installed`}>
                            <ExclamationTriangleIcon className="w-5 text-orange-500" />
                        </IconButton>
                    ];
            },
        },
        {
            field: 'actions', type: 'actions', headerName: '', width: 50, sortable: false, resizable: false, align: 'center',
            getActions: (params: GridRowParams<ProjectModel>) => [
                <GridActionsCellItem
                    label="Show in Explorer"
                    onClick={() => handleShowFolderInExplorer(params.row.path)}
                    showInMenu />,
                <GridActionsCellItem
                    label="Rename"
                    onClick={() => handleRenameOpen(params.row)}
                    showInMenu />,
                <GridActionsCellItem
                    label="Edit tags"
                    onClick={() => handleTagsOpen(params.row)}
                    showInMenu />,
                <GridActionsCellItem
                    label={params.row.preview ? 'Change preview' : 'Set preview'}
                    onClick={() => handleSetPreview(params.row)}
                    showInMenu />,
                <GridActionsCellItem
                    className="!text-red-200 hover:!bg-red-700"
                    label="Remove Project"
                    onClick={() => handleRemoveProject(params.row.path)}
                    showInMenu />,
            ],
        },
    ];
};
