import { net, protocol } from 'electron';
import path from 'path';
import { pathToFileURL } from 'url';

// Project previews live outside the app, so the renderer can't load them via file:// with webSecurity on.
// Serve them through a custom scheme instead, restricted to preview images only.
const SCHEME = 'runway-preview';
const ALLOWED_FILES = ['preview.png', 'preview.jpg'];

protocol.registerSchemesAsPrivileged([
    { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

export const toPreviewUrl = (filePath: string) => `${SCHEME}://image/?path=${encodeURIComponent(filePath)}`;

export const registerPreviewProtocol = () => {
    protocol.handle(SCHEME, (request) => {
        const filePath = new URL(request.url).searchParams.get('path');
        if (!filePath || !path.isAbsolute(filePath) || !ALLOWED_FILES.includes(path.basename(filePath).toLowerCase())) {
            return new Response(null, { status: 403 });
        }
        return net.fetch(pathToFileURL(filePath).toString());
    });
};
