// Aria Plume (application) — manifeste du complément Word et son inscription.
//
// Manifeste « complément seul » (XML), reconnu par Word 2016 et plus récent, Microsoft 365 compris.
// Un bouton « Aria Plume » dans l'onglet Accueil ouvre le panneau.
// Inscription sous Windows : valeur dans HKCU\Software\Microsoft\Office\16.0\WEF\Developer
// (nom et donnée : le chemin du manifeste), lue par Word au démarrage. Aucun droit administrateur.
// Écrite par PowerShell, puis relue (voir plus bas).

import { runPowerShell } from "../powershell.js";
import fs from "node:fs";
import path from "node:path";

export const WORD_ADDIN_ID = "8621473a-6172-4cc6-b0fb-1b8d89cbece4";
export const WORD_MANIFEST = "manifeste-word.xml";

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

// --- Complément Outlook ---
// Manifeste « MailApp » (XML), d'après le modèle officiel de Microsoft (Office-Addin-TaskPane-JS,
// manifest.outlook.xml). Lecture ET rédaction déclarées d'emblée : chaque changement de manifeste
// oblige à le réinstaller à la main (et l'Outlook classique peut mettre 24 h à le voir).
// Installation : une fois, par https://aka.ms/olksideload → Mes compléments → Ajouter un
// complément personnalisé → À partir d'un fichier (aucun registre : c'est le compte Microsoft qui le
// garde, dans tous les Outlook). Comptes Outlook.com et Microsoft 365 seulement.
export const OUTLOOK_ADDIN_ID = "8509698c-4c62-48ac-afca-febf06025eb0";
export const OUTLOOK_MANIFEST = "manifeste-outlook.xml";
export const OUTLOOK_SIDELOAD_URL = "https://aka.ms/olksideload";

export function outlookManifest({ origin, version }) {
    const url = (relative) => escapeXml(`${origin}/office/${relative}`);
    const icon = `<Icon>
                                        <bt:Image size="16" resid="Icon.16x16"/>
                                        <bt:Image size="32" resid="Icon.32x32"/>
                                        <bt:Image size="80" resid="Icon.80x80"/>
                                    </Icon>`;
    const surface = (point, group, button) => `<ExtensionPoint xsi:type="${point}">
                        <OfficeTab id="TabDefault">
                            <Group id="${group}">
                                <Label resid="Group.Label"/>
                                <Control xsi:type="Button" id="${button}">
                                    <Label resid="Button.Label"/>
                                    <Supertip>
                                        <Title resid="Button.Label"/>
                                        <Description resid="Button.Tooltip"/>
                                    </Supertip>
                                    ${icon}
                                    <Action xsi:type="ShowTaskpane">
                                        <SourceLocation resid="Taskpane.Url"/>
                                    </Action>
                                </Control>
                            </Group>
                        </OfficeTab>
                    </ExtensionPoint>`;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<OfficeApp xmlns="http://schemas.microsoft.com/office/appforoffice/1.1"
           xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
           xmlns:bt="http://schemas.microsoft.com/office/officeappbasictypes/1.0"
           xmlns:mailappor="http://schemas.microsoft.com/office/mailappversionoverrides/1.0"
           xsi:type="MailApp">
    <Id>${OUTLOOK_ADDIN_ID}</Id>
    <Version>${manifestVersion(version)}</Version>
    <ProviderName>Aria Plume</ProviderName>
    <DefaultLocale>fr-FR</DefaultLocale>
    <DisplayName DefaultValue="Aria Plume"/>
    <Description DefaultValue="Correction, traduction, synonymes et conjugaison, 100 % sur ton PC (application Aria Plume)."/>
    <IconUrl DefaultValue="${url("icons/icon-64.png")}"/>
    <HighResolutionIconUrl DefaultValue="${url("icons/icon-128.png")}"/>
    <SupportUrl DefaultValue="https://github.com/ZedjeK/Aria-Plume"/>
    <AppDomains>
        <AppDomain>${escapeXml(origin)}</AppDomain>
    </AppDomains>
    <Hosts>
        <Host Name="Mailbox"/>
    </Hosts>
    <Requirements>
        <Sets>
            <Set Name="Mailbox" MinVersion="1.3"/>
        </Sets>
    </Requirements>
    <FormSettings>
        <Form xsi:type="ItemRead">
            <DesktopSettings>
                <SourceLocation DefaultValue="${url("outlook.html")}"/>
                <RequestedHeight>450</RequestedHeight>
            </DesktopSettings>
        </Form>
        <Form xsi:type="ItemEdit">
            <DesktopSettings>
                <SourceLocation DefaultValue="${url("outlook.html")}"/>
            </DesktopSettings>
        </Form>
    </FormSettings>
    <Permissions>ReadWriteItem</Permissions>
    <Rule xsi:type="RuleCollection" Mode="Or">
        <Rule xsi:type="ItemIs" ItemType="Message" FormType="Read"/>
        <Rule xsi:type="ItemIs" ItemType="Message" FormType="Edit"/>
    </Rule>
    <DisableEntityHighlighting>false</DisableEntityHighlighting>
    <VersionOverrides xmlns="http://schemas.microsoft.com/office/mailappversionoverrides" xsi:type="VersionOverridesV1_0">
        <Requirements>
            <bt:Sets DefaultMinVersion="1.3">
                <bt:Set Name="Mailbox"/>
            </bt:Sets>
        </Requirements>
        <Hosts>
            <Host xsi:type="MailHost">
                <DesktopFormFactor>
                    <FunctionFile resid="Commands.Url"/>
                    ${surface("MessageReadCommandSurface", "AriaPlume.Read", "AriaPlume.ReadOpen")}
                    ${surface("MessageComposeCommandSurface", "AriaPlume.Compose", "AriaPlume.ComposeOpen")}
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
                <bt:Url id="Taskpane.Url" DefaultValue="${url("outlook.html")}"/>
            </bt:Urls>
            <bt:ShortStrings>
                <bt:String id="Group.Label" DefaultValue="Aria Plume"/>
                <bt:String id="Button.Label" DefaultValue="Aria Plume"/>
            </bt:ShortStrings>
            <bt:LongStrings>
                <bt:String id="Button.Tooltip" DefaultValue="Corriger, traduire, trouver un synonyme ou conjuguer, sans que ton texte quitte ton PC."/>
            </bt:LongStrings>
        </Resources>
    </VersionOverrides>
</OfficeApp>
`;
}

// Écrit le manifeste Outlook (à installer à la main) ; renvoie son chemin.
export function writeOutlookManifest({ dir, origin, version }) {
    fs.mkdirSync(dir, { recursive: true });
    const manifest = path.join(dir, OUTLOOK_MANIFEST);
    fs.writeFileSync(manifest, outlookManifest({ origin, version }));
    return manifest;
}

// --- Inscription dans Word (Windows) ---
// Par PowerShell, avec les commandes vérifiées sous Windows (l'appel direct à reg.exe depuis
// l'application ne laissait aucune trace dans le registre lors d'un essai réel). Le chemin du manifeste passe
// par une variable d'environnement : aucun souci de guillemets ni de caractères spéciaux.
const KEY = "HKCU:\\Software\\Microsoft\\Office\\16.0\\WEF\\Developer";
export const POWERSHELL_SCRIPTS = {
    // Écrit la valeur, puis la relit : la sortie est le chemin relu.
    register: `$cle = '${KEY}'; $manifeste = $env:ARIA_MANIFESTE
if (-not (Test-Path $cle)) { New-Item -Path $cle -Force | Out-Null }
Set-ItemProperty -Path $cle -Name $manifeste -Value $manifeste
(Get-ItemProperty -Path $cle -ErrorAction Stop).$manifeste`,
    // Sortie : le chemin inscrit, ou rien.
    query: `$cle = '${KEY}'; $manifeste = $env:ARIA_MANIFESTE
if (Test-Path $cle) { (Get-ItemProperty -Path $cle -ErrorAction SilentlyContinue).$manifeste }`,
    unregister: `$cle = '${KEY}'; $manifeste = $env:ARIA_MANIFESTE
if (Test-Path $cle) { Remove-ItemProperty -Path $cle -Name $manifeste -ErrorAction SilentlyContinue }`,
};

// La commande à lancer à la main si l'inscription échoue (affichée dans les réglages).
export const manualCommand = (manifest) => `$cle = '${KEY}'; $manifeste = '${manifest.replace(/'/g, "''")}'
if (-not (Test-Path $cle)) { New-Item -Path $cle -Force | Out-Null }
Set-ItemProperty -Path $cle -Name $manifeste -Value $manifeste`;

// Écrit le manifeste et l'inscrit pour Word. Renvoie { manifest, registered, error }.
// registered : true (inscrit et relu), false (échec, error dit pourquoi), null hors Windows.
export async function registerWord({ dir, origin, version, platform = process.platform, run = runPowerShell }) {
    fs.mkdirSync(dir, { recursive: true });
    const manifest = path.join(dir, WORD_MANIFEST);
    fs.writeFileSync(manifest, wordManifest({ origin, version }));
    if (platform !== "win32") {
        return { manifest, registered: null, error: null };
    }
    const result = await run(POWERSHELL_SCRIPTS.register, { ARIA_MANIFESTE: manifest });
    if (result.ok && result.output === manifest) {
        return { manifest, registered: true, error: null };
    }
    return { manifest, registered: false, error: result.error || "la valeur n'a pas pu être relue dans le registre" };
}

export async function unregisterWord({ dir, platform = process.platform, run = runPowerShell }) {
    const manifest = path.join(dir, WORD_MANIFEST);
    if (platform === "win32") {
        await run(POWERSHELL_SCRIPTS.unregister, { ARIA_MANIFESTE: manifest });
    }
    fs.rmSync(manifest, { force: true });
}

// true / false, ou null hors Windows (rien à inscrire).
export async function wordRegistered({ dir, platform = process.platform, run = runPowerShell }) {
    const manifest = path.join(dir, WORD_MANIFEST);
    if (platform !== "win32") {
        return fs.existsSync(manifest) ? null : false;
    }
    if (!fs.existsSync(manifest)) {
        return false;
    }
    const result = await run(POWERSHELL_SCRIPTS.query, { ARIA_MANIFESTE: manifest });
    return result.ok && result.output === manifest;
}
