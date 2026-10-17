import { useEffect, useState } from "react";
import { LinearProgress, Switch } from "@mui/material";
import { useUpdateStatus } from "../hooks/useUpdateStatus";
import { UpdateStatus } from "../models/UpdateModel";

const GITHUB_URL = 'https://github.com/sorcerb/unity-runway';

// One button walks through the update: check -> download -> restart and install.
const updateButton = (status: UpdateStatus) => {
    switch (status.state) {
        case 'available':
            return { label: `Update to ${status.version}`, action: window.electron.downloadUpdate };
        case 'downloaded':
            return { label: 'Restart and install', action: window.electron.installUpdate };
        case 'error':
            return status.version
                ? { label: `Update to ${status.version}`, action: window.electron.downloadUpdate }
                : { label: 'Check for updates', action: window.electron.checkForUpdates };
        case 'checking':
        case 'downloading':
        case 'unsupported':
            return { label: 'Check for updates', action: null };
        default:
            return { label: 'Check for updates', action: window.electron.checkForUpdates };
    }
};

const stateText = (status: UpdateStatus) => {
    switch (status.state) {
        case 'unsupported': return 'Updates are only available in the installed app.';
        case 'checking': return 'Checking for updates...';
        case 'latest': return 'You have the latest version.';
        case 'available': return `Version ${status.version} is available.`;
        case 'downloading': return `Downloading ${status.version}: ${status.percent ?? 0}%`;
        case 'downloaded': return `Version ${status.version} is downloaded and will be installed on restart.`;
        case 'error': return `Update failed: ${status.error}`;
        default: return null;
    }
};

// Updates of Runway itself, from GitHub Releases.
const UpdateSettings = () => {
    const status = useUpdateStatus();
    const [autoUpdate, setAutoUpdateState] = useState(true);

    useEffect(() => {
        window.electron.getAutoUpdate().then(setAutoUpdateState);
    }, []);

    const handleAutoUpdateToggle = async (value: boolean) => {
        setAutoUpdateState(value);
        try {
            await window.electron.setAutoUpdate(value);
        } catch {
            setAutoUpdateState(!value);
        }
    };

    if (!status) {
        return null;
    }

    const button = updateButton(status);
    const text = stateText(status);

    return (
        <div className="mt-5 p-4 rounded border border-neutral-700">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <b className="text-neutral-200">Updates</b>
                    <div className="text-xs mt-1">
                        Unity Runway {status.currentVersion} ·{' '}
                        <a className="text-blue-300 cursor-pointer hover:underline" onClick={() => window.electron.openExternal(GITHUB_URL)}>GitHub</a>
                        {' '}·{' '}
                        <a className="text-blue-300 cursor-pointer hover:underline" onClick={() => window.electron.openExternal(`${GITHUB_URL}/releases`)}>Releases</a>
                    </div>
                </div>
                <button
                    className="px-4 py-1 shrink-0 bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600"
                    disabled={!button.action}
                    onClick={() => button.action?.()}
                >
                    {button.label}
                </button>
            </div>

            <label className="mt-3 flex items-center gap-1 text-xs text-neutral-300 cursor-pointer w-fit">
                <Switch size="small" checked={autoUpdate} onChange={(e) => handleAutoUpdateToggle(e.target.checked)} />
                Update automatically: download new versions in the background and install them when the app closes
            </label>

            {text && (
                <div className={`mt-2 text-xs ${status.state === 'error' ? 'text-red-300' : 'text-neutral-400'}`}>
                    {text}
                    {status.state === 'downloading' && <LinearProgress className="mt-2 max-w-xs" variant="determinate" value={status.percent ?? 0} />}
                </div>
            )}
        </div>
    );
};

export default UpdateSettings;
