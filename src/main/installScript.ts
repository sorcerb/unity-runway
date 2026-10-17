import path from 'path';

// Pure helpers for the editor installer: no Electron dependencies, so they can be exercised on their own.

export interface Step {
    name: string;
    url: string;
    type: string;
    file: string;
    downloadSize: number;
    integrity?: string;
    destination: string;
    rename?: { from: string; to: string };
    args?: string;
    // A failing optional step is reported as a warning after `done` instead of failing the whole script.
    optional?: boolean;
}

// UNINSTALL removes the editor in `destination` (<base>/<version>); it has nothing to download.
export const UNINSTALL = 'UNINSTALL';

// PowerShell single-quoted literal.
export const q = (value: string) => `'${value.replace(/'/g, "''")}'`;

export const BOM = String.fromCharCode(0xfeff);

// Integrity is `md5-<base64>`, but the API is inconsistent about what is base64-encoded:
// some releases encode the raw 16-byte digest, others the 32-char hex string of it.
export const verifyIntegrity = (step: Step, md5: Buffer) => {
    if (!step.integrity) {
        return;
    }
    const separator = step.integrity.indexOf('-');
    if (step.integrity.slice(0, separator) !== 'md5') {
        return;
    }
    const expected = Buffer.from(step.integrity.slice(separator + 1), 'base64');
    const matches = expected.length === md5.length
        ? expected.equals(md5)
        : expected.toString('latin1').toLowerCase() === md5.toString('hex');
    if (!matches) {
        throw new Error(`Checksum mismatch for ${step.name}. The download is corrupted, please try again.`);
    }
};

// `record`: a file written once every step succeeded (the installed module ids, see editors.ts).
// The status file holds the running step index, then `done` (followed by one line per optional-step warning) or `error:<message>`.
export const buildScript = (steps: Step[], statusFile: string, record?: { file: string; content: string }) => {
    const lines = [
        "$ErrorActionPreference = 'Stop'",
        `$status = ${q(statusFile)}`,
        'function Step($n) { Set-Content -LiteralPath $status -Encoding UTF8 -Value $n }',
        'function Run($file, $arguments, $ok) {',
        '  if ($arguments) { $p = Start-Process -FilePath $file -ArgumentList $arguments -Wait -PassThru }',
        '  else { $p = Start-Process -FilePath $file -Wait -PassThru }',
        '  if ($ok -notcontains $p.ExitCode) { throw "$(Split-Path $file -Leaf) exited with code $($p.ExitCode)" }',
        '}',
        '$warnings = @()',
        'try {',
    ];

    steps.forEach((step, index) => {
        lines.push(`  Step ${index}`);
        if (step.optional) {
            lines.push('  try {');
        }
        if (step.type === UNINSTALL) {
            // The editor's own NSIS uninstaller also drops its "Programs and Features" entry. `_?=` keeps it from copying itself
            // to %TEMP% and returning at once; it can't delete its own folder then, so whatever is left goes with `rd`.
            const uninstaller = path.join(step.destination, 'Editor', 'Uninstall.exe');
            lines.push(`  if (Test-Path -LiteralPath ${q(uninstaller)}) { Start-Process -FilePath ${q(uninstaller)} -ArgumentList ${q(`/S _?=${path.dirname(uninstaller)}`)} -Wait | Out-Null }`);
            lines.push(`  if (Test-Path -LiteralPath ${q(step.destination)}) { & "$env:SystemRoot\\System32\\cmd.exe" /c rd /s /q ${q(step.destination)} }`);
            lines.push(`  if (Test-Path -LiteralPath ${q(step.destination)}) { throw ${q(`Could not delete ${step.destination}, some files are in use`)} }`);
        } else if (step.type === 'EXE') {
            // NSIS reads /D= up to the end of the command line, so the path must stay unquoted and last.
            // 3010 = success, reboot required (Visual Studio).
            lines.push(`  Run ${q(step.file)} ${q(step.args ?? `/S /D=${step.destination}`)} @(0, 3010)`);
        } else if (step.type === 'ZIP') {
            lines.push(`  New-Item -ItemType Directory -Force -Path ${q(step.destination)} | Out-Null`);
            lines.push(`  & "$env:SystemRoot\\System32\\tar.exe" -xf ${q(step.file)} -C ${q(step.destination)}`);
            lines.push(`  if ($LASTEXITCODE -ne 0) { throw ${q(`Failed to extract ${step.name}`)} }`);
            if (step.rename) {
                // `to` may be the parent of `from` (NDK), so move through a temporary sibling.
                const tmp = `${step.rename.to}.runway-tmp`;
                lines.push(`  if (Test-Path -LiteralPath ${q(step.rename.from)}) {`);
                lines.push(`    Move-Item -LiteralPath ${q(step.rename.from)} -Destination ${q(tmp)}`);
                lines.push(`    if (Test-Path -LiteralPath ${q(step.rename.to)}) { Remove-Item -LiteralPath ${q(step.rename.to)} -Recurse -Force }`);
                lines.push(`    Move-Item -LiteralPath ${q(tmp)} -Destination ${q(step.rename.to)}`);
                lines.push('  }');
            }
        } else if (step.type === 'PO') {
            lines.push(`  New-Item -ItemType Directory -Force -Path ${q(step.destination)} | Out-Null`);
            lines.push(`  Copy-Item -LiteralPath ${q(step.file)} -Destination ${q(path.join(step.destination, `${path.basename(new URL(step.url).pathname)}.po`))} -Force`);
        }
        if (step.optional) {
            lines.push(`  } catch { $warnings += ${q(`${step.name}: `)} + $_.Exception.Message }`);
        }
    });

    if (record) {
        lines.push(`  Set-Content -LiteralPath ${q(record.file)} -Encoding UTF8 -Value ${q(record.content)}`);
    }
    lines.push("  Set-Content -LiteralPath $status -Encoding UTF8 -Value (@('done') + $warnings)");
    lines.push("} catch { Set-Content -LiteralPath $status -Encoding UTF8 -Value ('error:' + $_.Exception.Message); exit 1 }");
    // Windows PowerShell 5.1 reads BOM-less scripts in the ANSI code page, which breaks non-ASCII paths.
    return BOM + lines.join('\r\n');
};
