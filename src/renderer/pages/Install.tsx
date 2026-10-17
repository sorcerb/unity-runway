import { useEffect, useState } from "react";
import { Button, Chip, CircularProgress, InputAdornment, TextField, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { format } from "date-fns";
import { ReleaseModel, ReleaseStream } from "../models/ReleaseModel";
import InstallModal from "../components/InstallModal";
import { useInstallState } from "../hooks/useInstallState";
import { formatSize } from "../utils/format";

const STREAMS: { value: ReleaseStream | 'ALL'; label: string }[] = [
    { value: 'LTS', label: 'LTS' },
    { value: 'SUPPORTED', label: 'Supported' },
    { value: 'BETA', label: 'Beta' },
    { value: 'ALPHA', label: 'Alpha' },
    { value: 'TECH', label: 'Tech' },
    { value: 'ALL', label: 'All' },
];

const Install = () => {
    const [stream, setStream] = useState<ReleaseStream | 'ALL'>('LTS');
    const [search, setSearch] = useState('');
    const [releases, setReleases] = useState<ReleaseModel[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [installVersion, setInstallVersion] = useState<string | null>(null);

    const load = async (offset: number) => {
        setLoading(true);
        setError(null);
        try {
            const page = await window.electron.listReleases(stream === 'ALL' ? null : stream, search, offset);
            setReleases(prev => offset === 0 ? page.results : [...prev, ...page.results]);
            setTotal(page.total);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    };

    useInstallState(() => load(0));

    useEffect(() => {
        const timer = setTimeout(() => load(0), search ? 300 : 0);
        return () => clearTimeout(timer);
    }, [stream, search]);

    return (
        <>
            <div className="h-12 mb-2 flex items-center justify-between">
                <h1 className="text-xl text-neutral-100">Install editor</h1>
                <TextField
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    size="small"
                    placeholder="Version, e.g. 6000.0"
                    slotProps={{
                        input: {
                            startAdornment: (
                                <InputAdornment position="start">
                                    <MagnifyingGlassIcon className="w-5" />
                                </InputAdornment>
                            ),
                        },
                    }}
                />
            </div>

            <ToggleButtonGroup size="small" exclusive value={stream} onChange={(_e, value) => value && setStream(value)}>
                {STREAMS.map(s => <ToggleButton key={s.value} value={s.value}>{s.label}</ToggleButton>)}
            </ToggleButtonGroup>

            <div className="mt-4 overflow-y-auto pr-2" style={{ height: 'calc(100vh - 140px)' }}>
                {error && <div className="text-red-300 text-sm mb-3">{error}</div>}

                {releases.map(release => (
                    <div key={release.version} className="flex items-center justify-between p-2 rounded text-neutral-400 hover:bg-neutral-800">
                        <div>
                            <div className="flex items-center gap-2">
                                <b className="text-neutral-200">{release.version}</b>
                                <Chip label={release.stream} size="small" variant="outlined" />
                                {release.recommended && <Chip label="Recommended" size="small" color="success" variant="outlined" />}
                            </div>
                            <div className="text-xs mt-1">
                                {format(new Date(release.releaseDate), 'yyyy-MM-dd')} · {formatSize(release.downloadSize)}
                                {release.releaseNotesUrl && <>
                                    {' · '}
                                    <a className="cursor-pointer hover:text-neutral-200 underline" onClick={() => window.electron.openExternal(release.releaseNotesUrl as string)}>Release notes</a>
                                </>}
                            </div>
                        </div>
                        {release.installed
                            ? <Button size="small" variant="outlined" onClick={() => setInstallVersion(release.version)}>Add modules</Button>
                            : <Button size="small" variant="contained" onClick={() => setInstallVersion(release.version)}>Install</Button>}
                    </div>
                ))}

                {loading && <div className="flex justify-center p-4"><CircularProgress size={28} /></div>}
                {!loading && !error && releases.length === 0 && <div className="text-neutral-500 p-2">No releases found.</div>}
                {!loading && releases.length < total && (
                    <div className="flex justify-center p-4">
                        <Button variant="text" onClick={() => load(releases.length)}>Load more</Button>
                    </div>
                )}
            </div>

            <InstallModal version={installVersion} onClose={() => setInstallVersion(null)} />
        </>
    );
};

export default Install;
