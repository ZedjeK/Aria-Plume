// Aria Plume (application) — manifeste du complément Word et son inscription.
//
// Manifeste « complément seul » (XML), reconnu par Word 2016 et plus récent, Microsoft 365 compris.
// Un bouton « Aria Plume » dans l'onglet Accueil ouvre le panneau.
// Inscription sous Windows : valeur dans HKCU\Software\Microsoft\Office\16.0\WEF\Developer
// (nom et donnée : le chemin du manifeste), lue par Word au démarrage. Aucun droit administrateur.

import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const WORD_ADDIN_ID = "8621473a-6172-4cc6-b0fb-1b8d89cbece4";
export const WORD_MANIFEST = "manifeste-word.xml";
const DEVELOPER_KEY = "HKCU\\Software\\Microsoft\\Office\\16.0\\WEF\\Developer";

const escapeXml = (text) => String(text).replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]);

// « 0.36.0 » → « 0.36.0.0 » (le manifeste veut quatre nombres).
const manifestVersion = (version) => [...String(version).split(".").map((n) => String(Number.parseInt(n, 10) || 0)), "0", "0", "0"].slice(0, 4).join(".");

export function wordManifest({ origin, version }) {
    const url = (relative) => escapeXml(`${origin}/office/${relative}`);
    return `<?xml version="1.0" encoding="UTF-8"?>
<OfficeApp xmlns="http://schemas.microsoft.com/office/appforoffice/1.1"
           xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
           xmlns:bt="http://schemas.microsoft.com/office/officeappbasictypes/1.0"
           xmlns:ov="http://schemas.microsoft.com/office/taskpaneappversionoverrides"
           xsi:type="TaskPaneApp">
    <Id>${WORD_ADDIN_ID}</Id>
    <Version>${manifestVersion(version)}</Version>
    <ProviderName>Aria Plume</ProviderName>
    <DefaultLocale>fr-FR</DefaultLocale>
    <DisplayName DefaultValue="Aria Plume"/>
    <Description DefaultValue="Correction, traduction, synonymes et conjugaison, 100 % sur ton PC (application Aria Plume)."/>
    <IconUrl DefaultValue="${url("icons/icon-32.png")}"/>
    <HighResolutionIconUrl DefaultValue="${url("icons/icon-64.png")}"/>
    <SupportUrl DefaultValue="https://github.com/ZedjeK/Aria-Plume"/>
    <AppDomains>
        <AppDomain>${escapeXml(origin)}</AppDomain>
    </AppDomains>
    <Hosts>
        <Host Name="Document"/>
    </Hosts>
    <DefaultSettings>
        <SourceLocation DefaultValue="${url("word.html")}"/>
    </DefaultSettings>
    <Permissions>ReadWriteDocument</Permissions>
    <VersionOverrides xmlns="http://schemas.microsoft.com/office/taskpaneappversionoverrides" xsi:type="VersionOverridesV1_0">
        <Hosts>
            <Host xsi:type="Document">
                <DesktopFormFactor>
                    <GetStarted>
                        <Title resid="GetStarted.Title"/>
                        <Description resid="GetStarted.Description"/>
                        <LearnMoreUrl resid="GetStarted.LearnMoreUrl"/>
                    </GetStarted>
                    <FunctionFile resid="Commands.Url"/>
                    <ExtensionPoint xsi:type="PrimaryCommandSurface">
                        <OfficeTab id="TabHome">
                            <Group id="AriaPlume.Group">
                                <Label resid="Group.Label"/>
                                <Icon>
                                    <bt:Image size="16" resid="Icon.16x16"/>
                                    <bt:Image size="32" resid="Icon.32x32"/>
                                    <bt:Image size="80" resid="Icon.80x80"/>
                                </Icon>
                                <Control xsi:type="Button" id="AriaPlume.Open">
                                    <Label resid="Button.Label"/>
                                    <Supertip>
                                        <Title resid="Button.Label"/>
                                        <Description resid="Button.Tooltip"/>
                                    </Supertip>
                                    <Icon>
                                        <bt:Image size="16" resid="Icon.16x16"/>
                                        <bt:Image size="32" resid="Icon.32x32"/>
                                        <bt:Image size="80" resid="Icon.80x80"/>
                                    </Icon>
                                    <Action xsi:type="ShowTaskpane">
                                        <TaskpaneId>AriaPlume.Taskpane</TaskpaneId>
                                        <SourceLocation resid="Taskpane.Url"/>
                                    </Action>
                                </Control>
                            </Group>
                        </OfficeTab>
                    </ExtensionPoint>
                </DesktopFormFactor>
            </Host>
        </Hosts>
        <Resources>
            <bt:Images>
                <bt:Image id="Icon.16x16" DefaultValue="${url("icons/icon-16.png")}"/>
                <bt:Image id="Icon.32x32" DefaultValue="${url("icons/icon-32.png")}"/>
                <bt:Image id="Icon.80x80" DefaultValue="${url("icons/icon-80.png")}"/>
            </bt:Images>
            <bt:Urls>
                <bt:Url id="Commands.Url" DefaultValue="${url("commands.html")}"/>
                <bt:Url id="Taskpane.Url" DefaultValue="${url("word.html")}"/>
                <bt:Url id="GetStarted.LearnMoreUrl" DefaultValue="https://github.com/ZedjeK/Aria-Plume"/>
            </bt:Urls>
            <bt:ShortStrings>
                <bt:String id="Group.Label" DefaultValue="Aria Plume"/>
                <bt:String id="Button.Label" DefaultValue="Aria Plume"/>
                <bt:String id="GetStarted.Title" DefaultValue="Aria Plume est prêt"/>
                <!-- Bulle des soulignés dans le texte (Word avec Microsoft 365). -->
                <bt:String id="Critique.Brand" DefaultValue="Aria Plume"/>
                <bt:String id="Critique.Ortho" DefaultValue="Orthographe"/>
                <bt:String id="Critique.Gram" DefaultValue="Grammaire"/>
                <bt:String id="Critique.Style" DefaultValue="Style"/>
                <bt:String id="Critique.Sub" DefaultValue="Suggestion d'Aria Plume"/>
            </bt:ShortStrings>
            <bt:LongStrings>
                <bt:String id="Button.Tooltip" DefaultValue="Corriger, traduire, trouver un synonyme ou conjuguer, sans que ton texte quitte ton PC."/>
                <bt:String id="GetStarted.Description" DefaultValue="Clique sur Aria Plume dans l'onglet Accueil pour ouvrir le panneau."/>
            </bt:LongStrings>
        </Resources>
    </VersionOverrides>
</OfficeApp>
`;
}

const run = (command, args) => new Promise((resolve) => {
    execFile(command, args, { windowsHide: true }, (error, stdout, stderr) => {
        resolve({ ok: !error, output: `${stdout ?? ""}${stderr ?? ""}` });
    });
});

// Écrit le manifeste et l'inscrit pour Word. Renvoie { manifest, registered }.
// Hors Windows (tests), le manifeste est écrit mais rien n'est inscrit.
export async function registerWord({ dir, origin, version, platform = process.platform }) {
    fs.mkdirSync(dir, { recursive: true });
    const manifest = path.join(dir, WORD_MANIFEST);
    fs.writeFileSync(manifest, wordManifest({ origin, version }));
    if (platform !== "win32") {
        return { manifest, registered: null };
    }
    const result = await run("reg", ["add", DEVELOPER_KEY, "/v", manifest, "/t", "REG_SZ", "/d", manifest, "/f"]);
    return { manifest, registered: result.ok, error: result.ok ? null : result.output.trim() };
}

export async function unregisterWord({ dir, platform = process.platform }) {
    const manifest = path.join(dir, WORD_MANIFEST);
    if (platform === "win32") {
        await run("reg", ["delete", DEVELOPER_KEY, "/v", manifest, "/f"]);
    }
    fs.rmSync(manifest, { force: true });
}

// true / false, ou null hors Windows.
export async function wordRegistered({ dir, platform = process.platform }) {
    const manifest = path.join(dir, WORD_MANIFEST);
    if (platform !== "win32") {
        return fs.existsSync(manifest) ? null : false;
    }
    if (!fs.existsSync(manifest)) {
        return false;
    }
    const result = await run("reg", ["query", DEVELOPER_KEY, "/v", manifest]);
    return result.ok;
}
