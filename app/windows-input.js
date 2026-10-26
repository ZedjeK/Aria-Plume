// Aria Plume (application) — Windows : copier la sélection d'un autre logiciel et y recoller le
// texte corrigé, comme le fait Antidote.
//
// Un PowerShell (présent sur tout Windows) reste ouvert en arrière-plan, sans fenêtre. Il compile au
// démarrage une petite classe C# qui appelle l'API Windows (user32.dll) :
//   - capture : retient la fenêtre au premier plan, attend que tu relâches Alt/Maj/Ctrl, envoie Ctrl+C
//   - paste   : remet cette fenêtre au premier plan et envoie Ctrl+V
// Aucun module natif à compiler, rien à installer. Le presse-papiers, lui, est géré par Electron
// (sauvegardé avant, restauré après).
//
// Autres systèmes : pas de capture (la fenêtre s'ouvre simplement). ARIA_FAKE_INPUT=1 remplace
// PowerShell par un simulateur, pour le banc de test automatique.

import { spawn } from "node:child_process";
import { ClipboardItem, clipboard } from "electron";

const CSHARP = String.raw`
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public static class AriaInput {
    [StructLayout(LayoutKind.Sequential)]
    struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
    [StructLayout(LayoutKind.Sequential)]
    struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
    [StructLayout(LayoutKind.Explicit)]
    struct InputUnion { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
    [StructLayout(LayoutKind.Sequential)]
    struct INPUT { public uint type; public InputUnion u; }

    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr hWnd);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr hWnd);
    [DllImport("user32.dll")] static extern bool IsWindow(IntPtr hWnd);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hWnd, IntPtr processId);
    [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool attach);
    [DllImport("user32.dll")] static extern short GetAsyncKeyState(int vKey);
    [DllImport("user32.dll", SetLastError = true)] static extern uint SendInput(uint count, INPUT[] inputs, int size);

    const uint INPUT_KEYBOARD = 1;
    const uint KEYEVENTF_KEYUP = 2;
    static readonly int[] MODIFIERS = { 0x10, 0x11, 0x12, 0x5B, 0x5C };  // Maj, Ctrl, Alt, Windows gauche et droite

    public static IntPtr Foreground() { return GetForegroundWindow(); }

    public static string Title(IntPtr hWnd) {
        StringBuilder text = new StringBuilder(512);
        GetWindowText(hWnd, text, text.Capacity);
        return text.ToString();
    }

    static bool AnyModifierDown() {
        foreach (int vk in MODIFIERS) {
            if ((GetAsyncKeyState(vk) & 0x8000) != 0) { return true; }
        }
        return false;
    }

    // Attend que les touches du raccourci soient relâchées : sinon Ctrl+C deviendrait Ctrl+Alt+Maj+C.
    public static bool WaitModifiers(int timeoutMs) {
        int waited = 0;
        while (AnyModifierDown() && waited < timeoutMs) { Thread.Sleep(15); waited += 15; }
        if (!AnyModifierDown()) { return true; }
        // Toujours enfoncées (touche bloquée) : on les relâche nous-mêmes.
        foreach (int vk in MODIFIERS) {
            if ((GetAsyncKeyState(vk) & 0x8000) != 0) { Send(new INPUT[] { Key(vk, true) }); }
        }
        return false;
    }

    static INPUT Key(int vk, bool up) {
        INPUT input = new INPUT();
        input.type = INPUT_KEYBOARD;
        input.u.ki.wVk = (ushort)vk;
        input.u.ki.dwFlags = up ? KEYEVENTF_KEYUP : 0;
        return input;
    }

    static void Send(INPUT[] inputs) { SendInput((uint)inputs.Length, inputs, Marshal.SizeOf(typeof(INPUT))); }

    // Ctrl + une touche (0x43 = C, 0x56 = V).
    public static void SendCtrl(int vk) {
        Send(new INPUT[] { Key(0x11, false), Key(vk, false), Key(vk, true), Key(0x11, true) });
    }

    // Remet une fenêtre au premier plan. Windows ne le permet qu'au programme qui a la main :
    // on se rattache un instant à la file d'entrée de la fenêtre active pour en avoir le droit.
    public static bool Focus(IntPtr hWnd) {
        if (!IsWindow(hWnd)) { return false; }
        if (IsIconic(hWnd)) { ShowWindow(hWnd, 9); }
        uint me = GetCurrentThreadId();
        uint current = GetWindowThreadProcessId(GetForegroundWindow(), IntPtr.Zero);
        bool attached = current != me && AttachThreadInput(me, current, true);
        BringWindowToTop(hWnd);
        SetForegroundWindow(hWnd);
        if (attached) { AttachThreadInput(me, current, false); }
        for (int i = 0; i < 40 && GetForegroundWindow() != hWnd; i++) { Thread.Sleep(15); }
        return GetForegroundWindow() == hWnd;
    }
}
`;

const POWERSHELL = String.raw`
$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding $false
try { [Console]::InputEncoding = $utf8 } catch { }
try { [Console]::OutputEncoding = $utf8 } catch { }
Add-Type -TypeDefinition @'
${CSHARP}
'@ -Language CSharp
[Console]::Out.WriteLine('{"ready":true}')
while ($true) {
    $line = [Console]::In.ReadLine()
    if ($line -eq $null) { break }
    $res = @{ ok = $false }
    $id = 0
    try {
        $req = $line | ConvertFrom-Json
        $id = $req.id
        switch ($req.op) {
            'capture' {
                $h = [AriaInput]::Foreground()
                $title = [AriaInput]::Title($h)
                $released = [AriaInput]::WaitModifiers(1500)
                [AriaInput]::SendCtrl(0x43)
                $res = @{ ok = $true; hwnd = $h.ToInt64().ToString(); title = $title; released = $released }
            }
            'paste' {
                $h = [IntPtr][Int64]$req.hwnd
                $focused = [AriaInput]::Focus($h)
                if ($focused) {
                    [void][AriaInput]::WaitModifiers(800)
                    [AriaInput]::SendCtrl(0x56)
                }
                $res = @{ ok = $focused; focused = $focused }
            }
            'ping' { $res = @{ ok = $true } }
            default { $res = @{ ok = $false; error = 'opération inconnue' } }
        }
    } catch {
        $res = @{ ok = $false; error = $_.Exception.Message }
    }
    $res.id = $id
    [Console]::Out.WriteLine(($res | ConvertTo-Json -Compress))
}
`;

// --- Presse-papiers : sauvegardé avant, restauré après ---
// Electron 44 lit et écrit le presse-papiers en asynchrone, par éléments (ClipboardItem) : on garde
// chaque format tel quel, y compris les formats bruts du système, et on les réécrit à l'identique.
export async function saveClipboard() {
    const items = await clipboard.read();
    return Promise.all(items.map(async (item) => Object.fromEntries(
        await Promise.all(item.types.map(async (type) => [type, await item.getType(type)])),
    )));
}

export async function restoreClipboard(saved) {
    const items = saved.filter((parts) => Object.keys(parts).length);
    if (!items.length) {
        await clipboard.clear();
        return;
    }
    try {
        await clipboard.write(items.map((parts) => new ClipboardItem(parts)));
    } catch {
        // Un format brut refusé : on remet au moins le texte, le HTML et les images.
        await clipboard.write(items.map((parts) => new ClipboardItem(Object.fromEntries(Object.entries(parts).filter(([type]) => !type.startsWith("electron "))))));
    }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Le PowerShell d'arrière-plan : une requête JSON par ligne, une réponse JSON par ligne.
function createPowerShell() {
    let child = null;
    let ready = null;
    let buffer = "";
    let seq = 0;
    const pending = new Map();

    function start() {
        const encoded = Buffer.from(POWERSHELL, "utf16le").toString("base64");
        child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
        ready = new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error("PowerShell ne répond pas.")), 20000);
            child.stdout.setEncoding("utf8");
            child.stdout.on("data", (chunk) => {
                buffer += chunk;
                let newline;
                while ((newline = buffer.indexOf("\n")) >= 0) {
                    const line = buffer.slice(0, newline).trim();
                    buffer = buffer.slice(newline + 1);
                    if (!line) {
                        continue;
                    }
                    let message;
                    try {
                        message = JSON.parse(line);
                    } catch {
                        continue;
                    }
                    if (message.ready) {
                        clearTimeout(timer);
                        resolve();
                    } else if (pending.has(message.id)) {
                        pending.get(message.id)(message);
                        pending.delete(message.id);
                    }
                }
            });
            child.stderr.setEncoding("utf8");
            child.stderr.on("data", (text) => console.error("PowerShell :", text.trim()));
            child.on("exit", () => {
                clearTimeout(timer);
                reject(new Error("PowerShell s'est arrêté."));
                for (const resolvePending of pending.values()) {
                    resolvePending({ ok: false, error: "PowerShell s'est arrêté." });
                }
                pending.clear();
                child = null;
            });
        });
        ready.catch(() => {});
    }

    async function call(op, args = {}) {
        if (!child) {
            start();
        }
        await ready;
        const id = ++seq;
        return new Promise((resolve) => {
            pending.set(id, resolve);
            child.stdin.write(`${JSON.stringify({ id, op, ...args })}\n`);
        });
    }

    return {
        warmUp: () => call("ping").catch(() => {}),
        capture: () => call("capture"),
        paste: (hwnd) => call("paste", { hwnd }),
        stop: () => child?.kill(),
    };
}

// Simulateur pour le banc de test : « l'autre logiciel » est une simple variable.
function createFake() {
    const fake = { selection: "", title: "Bloc-notes (simulé)", received: null };
    return {
        fake,
        warmUp: async () => {},
        capture: async () => {
            if (fake.selection) {
                await clipboard.writeText(fake.selection);
            }
            return { ok: true, hwnd: "4242", title: fake.title, released: true };
        },
        paste: async () => {
            fake.received = await clipboard.readText();
            return { ok: true, focused: true };
        },
        stop: () => {},
    };
}

export function createInput() {
    if (process.env.ARIA_FAKE_INPUT === "1") {
        return { available: true, ...createFake() };
    }
    if (process.platform !== "win32") {
        return { available: false, warmUp: async () => {}, stop: () => {} };
    }
    return { available: true, ...createPowerShell() };
}

// Copie la sélection du logiciel au premier plan. Renvoie { text, hwnd, title } ou { error }.
export async function captureSelection(input) {
    const saved = await saveClipboard();
    await clipboard.clear();
    try {
        const result = await input.capture();
        if (!result.ok) {
            return { error: `Copie impossible : ${result.error ?? "erreur inconnue"}.` };
        }
        // Le logiciel met un instant à remplir le presse-papiers.
        let text = "";
        for (let i = 0; i < 50 && !text; i++) {
            await wait(30);
            text = await clipboard.readText();
        }
        if (!text.trim()) {
            return { error: `Rien de sélectionné dans « ${result.title || "la fenêtre active"} » : sélectionne du texte, puis refais le raccourci.`, hwnd: result.hwnd, title: result.title };
        }
        return { text, hwnd: result.hwnd, title: result.title };
    } finally {
        await restoreClipboard(saved);
    }
}

// Recolle un texte dans la fenêtre d'origine, à la place de la sélection.
export async function pasteInto(input, hwnd, text) {
    const saved = await saveClipboard();
    await clipboard.writeText(text);
    const result = await input.paste(hwnd);
    if (!result.ok) {
        // Échec : le texte corrigé reste dans le presse-papiers, pour un collage à la main.
        return { ok: false, error: result.focused === false ? "La fenêtre d'origine n'a pas pu reprendre la main (fermée ou protégée). Le texte corrigé est dans le presse-papiers : colle-le avec Ctrl+V." : `Collage impossible : ${result.error ?? "erreur inconnue"}. Le texte corrigé est dans le presse-papiers.` };
    }
    // Laisse au logiciel le temps de lire le presse-papiers avant de le restaurer.
    await wait(400);
    if ((await clipboard.readText()) === text) {
        await restoreClipboard(saved);
    }
    return { ok: true };
}
