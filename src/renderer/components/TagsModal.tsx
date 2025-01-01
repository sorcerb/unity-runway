import { Modal, Box, TextField, Button, IconButton, Chip } from "@mui/material";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { ProjectModel } from "../models/ProjectModel";
import { useState } from "react";

interface TagsModalProps {
    open: boolean;
    onClose: () => void;
    selectedModel: ProjectModel | null;
    tags: string[];
    onSetTags: (tags: string[]) => void;
    onSaveTags: () => void;
}

const TagsModal = ({ open, onClose, selectedModel, tags, onSetTags: onSetTags, onSaveTags: onSaveTags }: TagsModalProps) => {
    const [inputValue, setInputValue] = useState("");

    const onModalClose = () => {
        setInputValue("");
        onClose();
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
    };

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "," || e.key === "Enter") {
            e.preventDefault();
            const trimmedValue = inputValue.trim();
            if (trimmedValue && !tags.includes(trimmedValue)) {
                onSetTags([...tags, trimmedValue]);
            }
            setInputValue("");
        }
    };

    const handleDeleteTag = (tagToDelete: string) => {
        onSetTags(tags.filter((tag) => tag !== tagToDelete));
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            aria-labelledby="tags-modal-title"
            aria-describedby="tags-modal-description"
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
                    onClick={onModalClose}
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
                <h1 className="text-xl text-neutral-100 mb-3">Edit tags: <b>{selectedModel?.name}</b></h1>
                <Box sx={{ mt: 2, display: "flex", flexWrap: "wrap", gap: 1 }}>
                    {tags.map((tag, index) => (
                        <Chip
                            key={index}
                            label={tag}
                            onDelete={() => handleDeleteTag(tag)}
                            variant="outlined"
                        />
                    ))}
                </Box>
                <TextField
                    fullWidth
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleInputKeyDown}
                    placeholder="Type and press Enter or ',' to add a tag"
                    sx={{ mt: 2 }}
                />
                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
                    <Button variant="outlined" onClick={onModalClose}>
                        Cancel
                    </Button>
                    <Button variant="contained" color="primary" onClick={onSaveTags}>
                        Save
                    </Button>
                </Box>
            </Box>
        </Modal>
    );
};

export default TagsModal;