import { Modal, Box, TextField, Button, IconButton } from "@mui/material";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { ProjectModel } from "../models/ProjectModel";

interface RenameModalProps {
    open: boolean;
    onClose: () => void;
    selectedModel: ProjectModel | null;
    newName: string | null;
    onSetNewName: (name: string) => void;
    onSaveRename: () => void;
}

const RenameModal = ({ open, onClose, selectedModel, newName, onSetNewName: onSetNewName, onSaveRename: onSaveRename }: RenameModalProps) => {
    return (
        <Modal
            open={open}
            onClose={onClose}
            aria-labelledby="rename-modal-title"
            aria-describedby="rename-modal-description"
        >
            <Box
                sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 400,
                    bgcolor: 'background.paper',
                    border: '2px solid #000',
                    boxShadow: 24,
                    p: 3,
                    borderRadius: 2,
                }}
            >
                <IconButton
                    onClick={onClose}
                    sx={{
                        width: 48,
                        height: 48,
                        position: 'absolute',
                        top: 14,
                        right: 14,
                        color: 'gray',
                    }}
                >
                    <XMarkIcon />
                </IconButton>
                <h1 className="text-xl text-neutral-100 mb-3">Rename</h1>
                <h3 className="text-xs text-neutral-300">
                    Path: <b>{selectedModel?.path}</b>
                </h3>
                <TextField
                    fullWidth
                    defaultValue={selectedModel?.name}
                    onChange={(e) => onSetNewName(e.target.value)}
                    sx={{ mt: 2 }}
                />
                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
                    <Button variant="outlined" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="contained" color="primary" onClick={onSaveRename}>
                        Rename
                    </Button>
                </Box>
            </Box>
        </Modal>
    );
};

export default RenameModal;