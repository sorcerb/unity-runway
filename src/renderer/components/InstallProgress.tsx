import { LinearProgress } from "@mui/material";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { useInstallState } from "../hooks/useInstallState";
import { formatSize } from "../utils/format";

const InstallProgress = () => {
    const state = useInstallState();
    if (!state) {
        return null;
    }

    const running = state.phase === 'downloading' || state.phase === 'installing' || state.phase === 'uninstalling';
    const percent = state.total > 0 ? Math.min(100, (state.received / state.total) * 100) : 0;

    return (
        <div className="p-3 rounded-md bg-neutral-900 border border-neutral-700 text-xs">
            <div className="flex items-start justify-between gap-1">
                <b className="text-neutral-200">Unity {state.version}</b>
                {!running && (
                    <XMarkIcon className="w-4 shrink-0 cursor-pointer text-neutral-400 hover:text-neutral-200" onClick={() => window.electron.dismissInstall()} />
                )}
            </div>
            <div className={`mt-1 break-words ${state.phase === 'error' ? 'text-red-300' : state.phase === 'done' ? 'text-green-300' : 'text-neutral-400'}`}>
                {state.error ?? state.step}
            </div>
            {state.warning && <div className="mt-1 break-words text-amber-300">{state.warning}</div>}

            {running && <>
                <LinearProgress
                    className="mt-2"
                    variant={state.total > 0 ? 'determinate' : 'indeterminate'}
                    value={percent}
                />
                <div className="mt-1 flex justify-between text-neutral-500">
                    <span>
                        {state.total === 0 ? '' : state.phase === 'downloading'
                            ? `${formatSize(state.received)} / ${formatSize(state.total)}`
                            : `Step ${Math.min(state.received + 1, state.total)} of ${state.total}`}
                    </span>
                    {state.phase === 'downloading' && (
                        <a className="cursor-pointer hover:text-neutral-200" onClick={() => window.electron.cancelInstall()}>Cancel</a>
                    )}
                </div>
            </>}
        </div>
    );
};

export default InstallProgress;
