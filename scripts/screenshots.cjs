// Takes the README screenshots (docs/projects.png, docs/settings.png) on made-up data, so no real projects end up in them.
// Run after a build: `npm run build && npx electron scripts/screenshots.cjs`.
// Creates parody game projects (with drawn previews) and fake editors under DEMO_ROOT, default D:\Unity,
// runs the app with its own temporary userData, captures the pages and deletes everything it created.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = process.env.DEMO_ROOT || 'D:\\Unity';
const PROJECTS_DIR = path.join(ROOT, 'Projects');
const EDITORS_DIR = path.join(ROOT, 'Editor');
const USER_DATA = path.join(os.tmpdir(), 'unity-runway-screenshots');
const DOCS = path.join(__dirname, '..', 'docs');

const EDITORS = [
    { version: '7000.0.0a10', modules: [] },
    { version: '6000.6.0f1', modules: ['android', 'ios', 'windows-il2cpp'] },
    { version: '6000.5.1f1', modules: ['webgl', 'windows-il2cpp'] },
    { version: '6000.0.40f1', modules: ['android', 'webgl', 'linux-mono'] },
];

const DAY = 24 * 60 * 60 * 1000;
// `opened`: days ago; `art`: the scene drawn by paint() below.
const PROJECTS = [
    { name: 'Mineforge', version: '6000.6.0f1', tags: ['sandbox', 'voxel'], opened: 0.05, art: 'mineforge' },
    { name: 'BTA 5', version: '6000.5.1f1', tags: ['open-world', '3d'], opened: 0.8, art: 'bta' },
    { name: 'Hollow Kid', version: '6000.0.40f1', tags: ['2d', 'metroidvania'], opened: 3, art: 'hollow' },
    { name: 'Among Them', version: '6000.6.0f1', tags: ['multiplayer'], opened: 9, art: 'among' },
    { name: 'Stardew Alley', version: '6000.0.40f1', tags: ['2d', 'farming'], opened: 21, art: 'stardew' },
    { name: 'Angry Birbs', version: '7000.0.0a10', tags: ['mobile', 'physics'], opened: 45, art: 'birbs' },
];

// Runs in the painter window: draws a 640x360 preview and returns it as base64 PNG.
function paint(art) {
    const W = 640, H = 360;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const g = canvas.getContext('2d');
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const lin = (y0, y1, colors) => {
        const gradient = g.createLinearGradient(0, y0, 0, y1);
        colors.forEach((color, i) => gradient.addColorStop(i / (colors.length - 1), color));
        return gradient;
    };
    const rect = (x, y, w, h, color) => { g.fillStyle = color; g.fillRect(x, y, w, h); };
    const circle = (x, y, r, color) => { g.fillStyle = color; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
    const ellipse = (x, y, rx, ry, color) => { g.fillStyle = color; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); };
    const poly = (points, color) => {
        g.fillStyle = color;
        g.beginPath();
        points.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.closePath();
        g.fill();
    };
    const title = (text, x, y, font, fill, stroke, width = 10) => {
        g.font = font;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.lineJoin = 'round';
        if (stroke) {
            g.lineWidth = width;
            g.strokeStyle = stroke;
            g.strokeText(text, x, y);
        }
        g.fillStyle = fill;
        g.fillText(text, x, y);
    };

    const scenes = {
        // Voxel hills, a blocky tree and a square sun.
        mineforge() {
            rect(0, 0, W, H, lin(0, H, ['#6fb7f0', '#c4e8ff']));
            rect(500, 36, 56, 56, '#fff6a0');
            [[50, 50, 120, 22], [80, 34, 60, 16], [300, 66, 140, 22], [340, 52, 70, 14]].forEach(([x, y, w, h]) => rect(x, y, w, h, '#ffffff'));
            const B = 32;
            const heights = [6, 6, 7, 7, 6, 6, 5, 5, 6, 7, 7, 6, 6, 5, 5, 5, 6, 6, 7, 7];
            heights.forEach((h, i) => {
                for (let j = 0; j < h; j++) {
                    const x = i * B, y = H - (j + 1) * B;
                    const top = j === h - 1, stone = j < h - 3;
                    rect(x, y, B, B, top ? '#5da130' : stone ? '#7d7d7d' : '#8a5a2c');
                    for (let k = 0; k < 6; k++) {
                        rect(x + Math.floor(rnd() * 8) * 4, y + Math.floor(rnd() * 8) * 4, 4, 4, top ? '#4c8a26' : stone ? '#666666' : '#6f4520');
                    }
                    if (top) rect(x, y, B, 8, '#6cbf3a');
                    g.strokeStyle = 'rgba(0,0,0,0.18)';
                    g.lineWidth = 1;
                    g.strokeRect(x + 0.5, y + 0.5, B - 1, B - 1);
                }
            });
            const tree = (col) => {
                const x = col * B, top = H - heights[col] * B;
                rect(x, top - 2 * B, B, 2 * B, '#6b4423');
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -4; dy <= -2; dy++) rect(x + dx * B, top + dy * B, B, B, (dx + dy) % 2 ? '#2e7d32' : '#3b9441');
                }
                rect(x, top - 5 * B, B, B, '#3b9441');
            };
            tree(1);
            tree(16);
            title('MINEFORGE', W / 2, 140, 'bold 66px "Courier New", monospace', '#e8e8e8', '#2f2f2f', 12);
        },

        // Sunset over a city, palm trees and a sports car.
        bta() {
            rect(0, 0, W, H, lin(0, H, ['#2b1055', '#d53a6e', '#ff9a5a']));
            circle(330, 200, 105, '#ffd36b');
            for (let i = 0; i < 6; i++) rect(220, 205 + i * 16, 220, 3 + i, '#ff8a5c');
            let x = 0;
            while (x < W) {
                const w = 30 + rnd() * 50, h = 50 + rnd() * 130;
                rect(x, H - 70 - h, w, h, '#24103a');
                for (let wy = H - 62 - h; wy < H - 80; wy += 14) {
                    for (let wx = x + 6; wx < x + w - 8; wx += 10) if (rnd() > 0.55) rect(wx, wy, 4, 6, '#ffcf6b');
                }
                x += w + 4;
            }
            rect(0, H - 70, W, 70, '#1a0f24');
            for (let i = 0; i < W; i += 60) rect(i + 10, H - 36, 34, 5, '#ffd36b');
            const palm = (px, s) => {
                const tx = px + 30 * s, ty = H - 70 - 190 * s;
                g.strokeStyle = '#120818';
                g.lineCap = 'round';
                g.lineWidth = 10 * s;
                g.beginPath();
                g.moveTo(px, H - 70);
                g.quadraticCurveTo(px + 5 * s, H - 70 - 100 * s, tx, ty);
                g.stroke();
                g.lineWidth = 7 * s;
                [-2.6, -2.1, -1.5, -0.9, -0.4].forEach(a => {
                    g.beginPath();
                    g.moveTo(tx, ty);
                    g.quadraticCurveTo(tx + Math.cos(a) * 60 * s, ty + Math.sin(a) * 50 * s, tx + Math.cos(a) * 95 * s, ty + Math.sin(a) * 20 * s + 40 * s);
                    g.stroke();
                });
            };
            palm(70, 1);
            palm(560, 0.85);
            g.fillStyle = '#e0245e';
            g.beginPath();
            g.roundRect(360, H - 64, 140, 24, 8);
            g.fill();
            poly([[390, H - 64], [410, H - 84], [455, H - 84], [475, H - 64]], '#b51b4b');
            poly([[398, H - 66], [413, H - 80], [432, H - 80], [432, H - 66]], '#ffcf9f');
            circle(388, H - 38, 12, '#0d0d0d');
            circle(472, H - 38, 12, '#0d0d0d');
            title('BTA V', W / 2, 70, 'italic 92px Impact, sans-serif', '#ffffff', '#111111', 12);
        },

        // A small horned knight in a dark blue cave.
        hollow() {
            rect(0, 0, W, H, lin(0, H, ['#0a1426', '#17365a', '#0a1426']));
            g.globalAlpha = 0.35;
            for (let i = 0; i < 7; i++) rect(i * 100 + rnd() * 40, 0, 24, H, '#2c5378');
            g.globalAlpha = 1;
            rect(0, H - 60, W, 60, '#060d1a');
            for (let i = 0; i < 70; i++) circle(rnd() * W, rnd() * H, 0.5 + rnd() * 2, 'rgba(180, 220, 255, 0.6)');
            const cx = 450, base = H - 60;
            poly([[cx - 32, base], [cx + 32, base], [cx + 14, base - 70], [cx - 14, base - 70]], '#1d2c44');
            ellipse(cx, base - 92, 32, 28, '#f2f2ee');
            g.fillStyle = '#f2f2ee';
            [-1, 1].forEach(side => {
                g.beginPath();
                g.moveTo(cx + side * 12, base - 112);
                g.quadraticCurveTo(cx + side * 34, base - 140, cx + side * 26, base - 168);
                g.quadraticCurveTo(cx + side * 22, base - 140, cx + side * 2, base - 116);
                g.fill();
            });
            ellipse(cx - 12, base - 90, 7, 12, '#0a0a0a');
            ellipse(cx + 12, base - 90, 7, 12, '#0a0a0a');
            g.strokeStyle = '#c9d3dd';
            g.lineWidth = 5;
            g.beginPath();
            g.moveTo(cx + 34, base - 40);
            g.lineTo(cx + 90, base - 90);
            g.stroke();
            title('HOLLOW KID', 220, 130, 'italic 56px Georgia, serif', '#e8eef5', null);
        },

        // Bean-shaped crewmates in space.
        among() {
            rect(0, 0, W, H, lin(0, H, ['#05060f', '#141c40']));
            for (let i = 0; i < 160; i++) {
                g.globalAlpha = 0.3 + rnd() * 0.7;
                rect(rnd() * W, rnd() * H, 2, 2, '#ffffff');
            }
            g.globalAlpha = 1;
            const crew = (x, y, s, color, shade, rotation) => {
                g.save();
                g.translate(x, y);
                g.rotate(rotation);
                g.scale(s, s);
                g.lineWidth = 6;
                g.strokeStyle = '#000000';
                const shape = (draw, fill) => { g.beginPath(); draw(); g.fillStyle = fill; g.fill(); g.stroke(); };
                shape(() => g.roundRect(-40, -12, 18, 42, 7), shade);
                shape(() => g.roundRect(-26, 26, 22, 24, 6), shade);
                shape(() => g.roundRect(4, 26, 22, 24, 6), shade);
                shape(() => g.roundRect(-28, -44, 56, 86, 26), color);
                shape(() => g.ellipse(8, -18, 21, 13, 0, 0, Math.PI * 2), '#9fd8ff');
                ellipse(16, -22, 8, 4, '#e8f7ff');
                g.restore();
            };
            crew(150, 250, 1.3, '#d71e1e', '#8a1010', 0);
            crew(320, 270, 1.1, '#1fae3a', '#11702a', 0);
            crew(480, 245, 1.25, '#f5d400', '#b39600', 0);
            crew(575, 110, 0.55, '#38fedc', '#1fa792', 0.9);
            title('AMONG THEM', W / 2, 70, '900 58px "Arial Black", Arial, sans-serif', '#ffffff', '#000000', 10);
        },

        // A farm: crop rows, a red-roofed house and a fence.
        stardew() {
            rect(0, 0, W, H, lin(0, 190, ['#8fd3ff', '#dff4ff']));
            circle(80, 55, 30, '#fff3a0');
            rect(0, 170, W, H - 170, '#79c35a');
            for (let r = 0; r < 5; r++) {
                rect(30, 210 + r * 28, 340, 16, '#8b5e34');
                for (let c = 0; c < 11; c++) {
                    circle(46 + c * 30, 210 + r * 28 + 2, 6, r % 2 ? '#ff9800' : '#e53935');
                    rect(44 + c * 30, 200 + r * 28, 4, 8, '#2e7d32');
                }
            }
            rect(420, 160, 160, 105, '#c98b4f');
            poly([[404, 162], [596, 162], [500, 100]], '#b5332e');
            rect(485, 205, 32, 60, '#6b3d1f');
            rect(436, 182, 30, 24, '#ffe9a8');
            rect(536, 182, 30, 24, '#ffe9a8');
            for (let x = 390; x < W; x += 24) rect(x, 290, 7, 34, '#a9743f');
            rect(390, 298, W - 390, 5, '#a9743f');
            rect(390, 312, W - 390, 5, '#a9743f');
            title('Stardew Alley', W / 2, 65, 'bold 56px "Comic Sans MS", cursive', '#ffd54a', '#7a4a1e', 10);
        },

        // A slingshot with an angry red bird and pigs in a wooden fort.
        birbs() {
            rect(0, 0, W, H, lin(0, H, ['#7fd0f5', '#e2f6ff']));
            [[120, 120, 60, 22], [160, 110, 50, 26], [470, 100, 70, 24], [520, 92, 50, 22]].forEach(([x, y, rx, ry]) => ellipse(x, y, rx, ry, '#ffffff'));
            rect(0, H - 50, W, 50, '#6cbf3d');
            rect(0, H - 50, W, 8, '#58a32f');
            g.strokeStyle = '#6b3f1d';
            g.lineCap = 'round';
            g.lineWidth = 14;
            g.beginPath();
            g.moveTo(130, H - 50);
            g.lineTo(130, H - 120);
            g.lineTo(108, H - 165);
            g.moveTo(130, H - 120);
            g.lineTo(152, H - 165);
            g.stroke();
            const bx = 130, by = H - 178;
            circle(bx, by, 30, '#d7263d');
            ellipse(bx + 4, by + 14, 18, 12, '#f4d3b5');
            circle(bx - 8, by - 4, 8, '#ffffff');
            circle(bx + 12, by - 4, 8, '#ffffff');
            circle(bx - 6, by - 3, 3.5, '#000000');
            circle(bx + 10, by - 3, 3.5, '#000000');
            g.strokeStyle = '#111111';
            g.lineWidth = 6;
            g.beginPath();
            g.moveTo(bx - 18, by - 18);
            g.lineTo(bx - 1, by - 10);
            g.moveTo(bx + 22, by - 18);
            g.lineTo(bx + 5, by - 10);
            g.stroke();
            poly([[bx + 22, by + 2], [bx + 42, by + 8], [bx + 22, by + 14]], '#f6b72b');
            const plank = (x, y, w, h) => { rect(x, y, w, h, '#c58b4a'); g.strokeStyle = '#8a5a2b'; g.lineWidth = 2; g.strokeRect(x, y, w, h); };
            plank(440, H - 140, 16, 90);
            plank(560, H - 140, 16, 90);
            plank(430, H - 156, 156, 16);
            plank(470, H - 236, 14, 80);
            plank(532, H - 236, 14, 80);
            plank(458, H - 252, 100, 16);
            const pig = (x, y, r) => {
                circle(x, y, r, '#7bd23f');
                ellipse(x, y + r * 0.2, r * 0.38, r * 0.28, '#a6e66b');
                circle(x - r * 0.12, y + r * 0.2, r * 0.07, '#3d6b1d');
                circle(x + r * 0.12, y + r * 0.2, r * 0.07, '#3d6b1d');
                circle(x - r * 0.4, y - r * 0.3, r * 0.16, '#ffffff');
                circle(x + r * 0.4, y - r * 0.3, r * 0.16, '#ffffff');
                circle(x - r * 0.4, y - r * 0.3, r * 0.07, '#000000');
                circle(x + r * 0.4, y - r * 0.3, r * 0.07, '#000000');
            };
            pig(508, H - 76, 26);
            pig(508, H - 178, 20);
            title('ANGRY BIRBS', W / 2, 60, '64px Impact, sans-serif', '#ffcc33', '#8b1a1a', 10);
        },
    };

    scenes[art]();
    return canvas.toDataURL('image/png').split(',')[1];
}

const mkdir = (dir) => fs.mkdirSync(dir, { recursive: true });
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const createEditors = () => {
    for (const editor of EDITORS) {
        const dir = path.join(EDITORS_DIR, editor.version);
        mkdir(path.join(dir, 'Editor'));
        fs.writeFileSync(path.join(dir, 'Editor', 'Unity.exe'), '');
        fs.writeFileSync(path.join(dir, 'modules.json'), JSON.stringify(editor.modules.map(id => ({ id, selected: true }))));
    }
};

const createProjects = () => PROJECTS.map(project => {
    const dir = path.join(PROJECTS_DIR, project.name);
    mkdir(path.join(dir, 'ProjectSettings'));
    fs.writeFileSync(path.join(dir, 'ProjectSettings', 'ProjectVersion.txt'), `m_EditorVersion: ${project.version}\n`);
    return {
        id: dir, path: dir, name: project.name, tags: project.tags, preview: null, modified: null, modifiedText: '',
        editorVersion: '', selectedEditor: null, lastOpened: new Date(Date.now() - project.opened * DAY).toISOString(),
    };
});

const capture = async (win, name) => {
    const image = await win.webContents.capturePage();
    if (image.isEmpty()) {
        throw new Error(`Nothing captured for ${name}: the window must be visible on screen.`);
    }
    fs.writeFileSync(path.join(DOCS, `${name}.png`), image.toPNG());
    console.log(`docs/${name}.png ${image.getSize().width}x${image.getSize().height}`);
};

const show = async (win, hash, ms) => {
    await win.webContents.executeJavaScript(`location.hash = '${hash}'`);
    await wait(ms);
};

if (fs.existsSync(ROOT)) {
    console.error(`${ROOT} already exists; set DEMO_ROOT to a folder that does not.`);
    process.exit(1);
}
fs.rmSync(USER_DATA, { recursive: true, force: true });
mkdir(USER_DATA);
mkdir(DOCS);
createEditors();
const projects = createProjects();
fs.writeFileSync(path.join(USER_DATA, 'config.json'), JSON.stringify({ Projects: projects, EditorFolders: [{ path: EDITORS_DIR }], AutoUpdate: true }));

// The app's stores read userData when main.js is loaded. Started this way, Electron would report its own version.
app.setPath('userData', USER_DATA);
app.setVersion(require('../package.json').version);
require('../out/main/main.js');

const cleanUp = async () => {
    BrowserWindow.getAllWindows().forEach(w => w.destroy());
    fs.rmSync(ROOT, { recursive: true, force: true });
    // Chromium may still hold files in its session data for a moment.
    await wait(1000);
    try {
        fs.rmSync(USER_DATA, { recursive: true, force: true });
    } catch (error) {
        console.warn(`Could not delete ${USER_DATA}: ${error.message}`);
    }
};

// Never hang: give up after two minutes.
setTimeout(async () => {
    console.error('Timed out');
    await cleanUp();
    app.exit(1);
}, 120000).unref();

app.whenReady().then(async () => {
    try {
        const painter = new BrowserWindow({ show: false });
        await painter.loadURL('about:blank');
        for (const project of PROJECTS) {
            const png = await painter.webContents.executeJavaScript(`(${paint.toString()})('${project.art}')`);
            fs.writeFileSync(path.join(PROJECTS_DIR, project.name, 'preview.png'), Buffer.from(png, 'base64'));
        }
        painter.destroy();

        const win = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());
        win.setSize(1200, 760);
        win.center();
        win.show();
        win.focus();
        win.webContents.reload();
        await wait(3000);

        await show(win, '#/', 1500);
        await capture(win, 'projects');
        await show(win, '#/settings', 1500);
        await capture(win, 'settings');
    } catch (error) {
        console.error(error);
        process.exitCode = 1;
    } finally {
        await cleanUp();
        app.exit();
    }
});
