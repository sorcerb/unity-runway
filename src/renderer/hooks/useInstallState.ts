import { useEffect, useRef, useState } from "react";
import { InstallState } from "../models/ReleaseModel";

// Current editor installation, pushed from the main process. `onFinished` fires once when an install completes.
export const useInstallState = (onFinished?: () => void) => {
    const [state, setState] = useState<InstallState | null>(null);
    const onFinishedRef = useRef(onFinished);
    onFinishedRef.current = onFinished;

    useEffect(() => {
        window.electron.getInstallState().then(setState);
        let lastPhase: string | undefined;
        return window.electron.onInstallProgress((next) => {
            setState(next);
            if (next?.phase === 'done' && lastPhase !== 'done') {
                onFinishedRef.current?.();
            }
            lastPhase = next?.phase;
        });
    }, []);

    return state;
};
