import { GridColDef, GridActionsCellItem, GridCellParams, GridRowParams, GridSortCellParams } from "@mui/x-data-grid";
import { ExclamationTriangleIcon, PlayIcon } from "@heroicons/react/24/outline";
import { Chip } from "@mui/material";
import { ProjectModel } from "../models/ProjectModel";
import { EditorModel } from "../models/EditorFolderModel";

export const getColumns = (
    editors: EditorModel[],
    openProject: (model: ProjectModel) => Promise<void>,
    handleShowFolderInExplorer: (path: string) => Promise<void>,
    handleRenameOpen: (model: ProjectModel) => void,
    handleTagsOpen: (model: ProjectModel) => void,
    handleRemoveProject: (path: string) => Promise<void>
): GridColDef[] => [
        {
            field: 'lunch', type: 'actions', headerName: '', width: 50, sortable: false, resizable: false,
            getActions: (params: GridRowParams<ProjectModel>) => {
                const showLunch = editors.some((s) => s.version === params.row.editorVersion);

                return showLunch
                    ? [
                        <GridActionsCellItem
                            icon={<PlayIcon className="w-6 text-green-300" />}
                            label="Lunch project"
                            onClick={() => openProject(params.row)}
                        />,
                    ]
                    : [];
            },
        },
        {
            field: "preview", headerName: "", sortable: false, width: 120, resizable: false,
            renderCell: (params: GridCellParams) => {
                return params.row.preview ? (
                    <img src={params.row.preview} alt="Preview" className="w-24 h-24 my-1 p-0 object-cover rounded border border-neutral-600" />
                ) : (
                    <div className="w-24 h-24 my-1 p-0 rounded border border-neutral-600"></div>
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
                            size="small"
                        />
                    ))}
                </>;
            }
        },
        {
            field: 'modified', headerName: 'Modified', renderCell: (params: GridCellParams) => <>{params.row.modifiedText}</>,
            sortComparator: (_v1: unknown, _v2: unknown, cellParams1: GridSortCellParams, cellParams2: GridSortCellParams) => {
                const date1 = new Date(cellParams1.value);
                const date2 = new Date(cellParams2.value);
                return date1.getTime() - date2.getTime();
            }, width: 120
        },
        {
            field: 'editor', headerName: 'Editor', width: 130,
            renderCell: (params: GridCellParams) => {
                return <>
                    <div className="font-bold text-neutral-200">
                        {!editors.some(s => s.version === params.row.editorVersion) && <ExclamationTriangleIcon className="w-5 me-1 inline text-orange-500" />}
                        {params.row.editorVersion}
                    </div>
                </>;
            }
        },
        {
            field: 'actions', type: 'actions', headerName: '', width: 50, sortable: false, resizable: false, align: 'center',
            getActions: (params: GridRowParams<ProjectModel>) => [
                <GridActionsCellItem
                    label="Show in Explorer"
                    onClick={() => handleShowFolderInExplorer(params.row.path)}
                    showInMenu
                />,
                <GridActionsCellItem
                    label="Rename"
                    onClick={() => handleRenameOpen(params.row)}
                    showInMenu
                />,
                <GridActionsCellItem
                    label="Edit tags"
                    onClick={() => handleTagsOpen(params.row)}
                    showInMenu
                />,
                <GridActionsCellItem
                    className="!text-red-200 hover:!bg-red-700"
                    label="Remove Project"
                    onClick={() => handleRemoveProject(params.row.path)}
                    showInMenu
                />,
            ],
        },
    ];
