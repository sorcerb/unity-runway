import { GridColDef, GridActionsCellItem, GridCellParams, GridRowParams, GridSortCellParams } from "@mui/x-data-grid";
import { ChevronUpDownIcon, ExclamationTriangleIcon, PlayIcon } from "@heroicons/react/24/outline";
import { Box, Chip, FormControl, IconButton, MenuItem, Select, SelectChangeEvent } from "@mui/material";
import { ProjectModel } from "../models/ProjectModel";
import { EditorModel } from "../models/EditorFolderModel";
import React, { useEffect } from "react";

export const getColumns = (
    editors: EditorModel[],
    openProject: (model: ProjectModel) => Promise<void>,
    handleShowFolderInExplorer: (path: string) => Promise<void>,
    handleRenameOpen: (model: ProjectModel) => void,
    handleTagsOpen: (model: ProjectModel) => void,
    handleRemoveProject: (path: string) => Promise<void>
): GridColDef[] => {

    return [
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
                            size="small" />
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
            field: 'editor', headerName: 'Editor', width: 120,
            renderCell: (params: GridCellParams) => {

                const [editor, setEditor] = React.useState('');

                const handleChange = (event: SelectChangeEvent) => {
                    setEditor(event.target.value as string);
                    if (editors.some(s => s.version === event.target.value)) {
                        const matchingEditor = editors.find(s => s.version === event.target.value);
                        params.row.selectedEditor = matchingEditor ?? null;
                    } else {
                        params.row.selectedEditor = null;
                    }
                    params.api.updateRows([params.row]);
                };

                useEffect(() => {
                    if (editors.some(s => s.version === params.row.editorVersion)) {
                        const matchingEditor = editors.find(s => s.version === params.row.editorVersion);
                        setEditor(matchingEditor?.version || '');
                    } else {
                        setEditor(params.row.editorVersion);
                    }

                }, []);

                return <>
                    <div className="font-bold text-neutral-200">
                        <FormControl size="small" variant="standard">
                            <Select
                                id={`editor-version-${params.row.version}`}
                                value={editor}
                                onChange={handleChange}
                            >
                                {!editors.some((s) => s.version === params.row.editorVersion) && (
                                    <MenuItem value={params.row.editorVersion}>{params.row.editorVersion}</MenuItem>
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
                const [showLaunch, setShowLaunch] = React.useState(false);

                React.useEffect(() => {
                    let editorExists = false;
                    if (params.row.selectedEditor != null) {
                        editorExists = editors.some((s) => s.version === params.row.selectedEditor?.version);
                    } else {
                        editorExists = editors.some((s) => s.version === params.row.editorVersion);
                    }
                    setShowLaunch(editorExists);
                }, [params.row.selectedEditor]);

                return showLaunch
                    ? [
                        <GridActionsCellItem
                            icon={<PlayIcon className="w-6 text-green-300" />}
                            label="Launch project"
                            onClick={() => openProject(params.row)} />,
                    ]
                    : [
                        <IconButton>
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
                    className="!text-red-200 hover:!bg-red-700"
                    label="Remove Project"
                    onClick={() => handleRemoveProject(params.row.path)}
                    showInMenu />,
            ],
        },
    ];
};
