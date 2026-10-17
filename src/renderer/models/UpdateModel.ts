// Updates of Runway itself (see main/updater.ts).
export type UpdateState = 'idle' | 'checking' | 'latest' | 'available' | 'downloading' | 'downloaded' | 'error' | 'unsupported';

export interface UpdateStatus {
    state: UpdateState;
    currentVersion: string;
    version?: string;
    percent?: number;
    error?: string;
}
