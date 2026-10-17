// Renders src/assets/icon.svg into icon.png (512x512, the installer icon) and icon.ico (16-256, the dev window icon).
// Run: `npx electron scripts/icon.cjs`.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const ASSETS = path.join(__dirname, '..', 'src', 'assets');
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

const render = (svg, size) => `new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = ${size};
        canvas.getContext('2d').drawImage(img, 0, 0, ${size}, ${size});
        resolve(canvas.toDataURL('image/png').split(',')[1]);
    };
    img.onerror = reject;
    img.src = 'data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}';
})`;

// ICO with PNG-compressed entries (supported since Windows Vista).
const buildIco = (images) => {
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(images.length, 4);
    let offset = 6 + images.length * 16;
    const entries = images.map(({ size, png }) => {
        const entry = Buffer.alloc(16);
        entry.writeUInt8(size >= 256 ? 0 : size, 0);
        entry.writeUInt8(size >= 256 ? 0 : size, 1);
        entry.writeUInt16LE(1, 4);
        entry.writeUInt16LE(32, 6);
        entry.writeUInt32LE(png.length, 8);
        entry.writeUInt32LE(offset, 12);
        offset += png.length;
        return entry;
    });
    return Buffer.concat([header, ...entries, ...images.map(i => i.png)]);
};

app.whenReady().then(async () => {
    try {
        const svg = fs.readFileSync(path.join(ASSETS, 'icon.svg'), 'utf8');
        const win = new BrowserWindow({ show: false });
        await win.loadURL('about:blank');
        const png = async (size) => Buffer.from(await win.webContents.executeJavaScript(render(svg, size)), 'base64');

        fs.writeFileSync(path.join(ASSETS, 'icon.png'), await png(512));
        const images = [];
        for (const size of ICO_SIZES) {
            images.push({ size, png: await png(size) });
        }
        fs.writeFileSync(path.join(ASSETS, 'icon.ico'), buildIco(images));
        console.log('src/assets/icon.png, src/assets/icon.ico');
    } catch (error) {
        console.error(error);
        process.exitCode = 1;
    } finally {
        app.exit();
    }
});
