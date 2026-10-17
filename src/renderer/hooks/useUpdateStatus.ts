import { useEffect, useState } from "react";
import { UpdateStatus } from "../models/UpdateModel";

// Status of Runway's own update, pushed from the main process.
export const useUpdateStatus = () => {
    const [status, setStatus] = useState<UpdateStatus | null>(null);

    useEffect(() => {
        window.electron.getUpdateStatus().then(setStatus);
        return window.electron.onUpdateStatus(setStatus);
    }, []);

    return status;
};
