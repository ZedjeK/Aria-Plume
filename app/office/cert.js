// Aria Plume (application) — certificat du serveur HTTPS local du complément Office.
//
// Word et Outlook n'affichent un complément que servi en HTTPS, avec un certificat approuvé par
// Windows. On crée donc :
//   1. une autorité de certification limitée à localhost (contrainte de noms : localhost,
//      127.0.0.1 et ::1, rien d'autre), valable 20 ans ;
//   2. le certificat du serveur, signé par elle, valable 10 ans ;
//   3. puis on jette la clé privée de l'autorité : elle ne peut plus rien signer, même volée.
// Seul le certificat de l'autorité (public) est ajouté aux autorités de confiance de la session
// Windows (certutil -user, Windows demande confirmation).
//
// ECDSA P-256 et SHA-256. Écrit à la main (encodage DER) pour éviter toute dépendance.

import crypto from "node:crypto";

// --- Encodage DER ---
function length(n) {
    if (n < 0x80) {
        return Buffer.from([n]);
    }
    const bytes = [];
    for (let v = n; v > 0; v >>= 8) {
        bytes.unshift(v & 0xff);
    }
    return Buffer.from([0x80 | bytes.length, ...bytes]);
}
const tlv = (tag, content) => Buffer.concat([Buffer.from([tag]), length(content.length), content]);
const seq = (...items) => tlv(0x30, Buffer.concat(items));
const set = (...items) => tlv(0x31, Buffer.concat(items));
const octets = (buffer) => tlv(0x04, buffer);
const bits = (buffer, unused = 0) => tlv(0x03, Buffer.concat([Buffer.from([unused]), buffer]));
const bool = (value) => tlv(0x01, Buffer.from([value ? 0xff : 0x00]));
const utf8 = (text) => tlv(0x0c, Buffer.from(text, "utf8"));
const explicit = (n, content) => tlv(0xa0 + n, content);
const implicit = (n, content, constructed = false) => tlv((constructed ? 0xa0 : 0x80) + n, content);

function integer(value) {
    let buffer = Buffer.isBuffer(value) ? value : Buffer.from([value]);
    while (buffer.length > 1 && buffer[0] === 0 && buffer[1] < 0x80) {
        buffer = buffer.subarray(1);
    }
    if (buffer[0] >= 0x80) {
        buffer = Buffer.concat([Buffer.from([0]), buffer]);
    }
    return tlv(0x02, buffer);
}

function oid(text) {
    const parts = text.split(".").map(Number);
    const out = [40 * parts[0] + parts[1]];
    for (const part of parts.slice(2)) {
        const chunk = [];
        let v = part;
        do {
            chunk.unshift(v & 0x7f);
            v = Math.floor(v / 128);
        } while (v > 0);
        out.push(...chunk.map((b, i) => (i < chunk.length - 1 ? b | 0x80 : b)));
    }
    return tlv(0x06, Buffer.from(out));
}

// UTCTime avant 2050, GeneralizedTime ensuite (RFC 5280).
function time(date) {
    const iso = date.toISOString().replace(/[-:T]/g, "").slice(0, 14);
    return date.getUTCFullYear() < 2050 ? tlv(0x17, Buffer.from(`${iso.slice(2)}Z`)) : tlv(0x18, Buffer.from(`${iso}Z`));
}

const OID = {
    commonName: "2.5.4.3",
    organization: "2.5.4.10",
    ecdsaWithSha256: "1.2.840.10045.4.3.2",
    basicConstraints: "2.5.29.19",
    keyUsage: "2.5.29.15",
    extKeyUsage: "2.5.29.37",
    serverAuth: "1.3.6.1.5.5.7.3.1",
    subjectAltName: "2.5.29.17",
    nameConstraints: "2.5.29.30",
    subjectKeyId: "2.5.29.14",
    authorityKeyId: "2.5.29.35",
};

const name = (commonName) => seq(
    set(seq(oid(OID.organization), utf8("Aria Plume"))),
    set(seq(oid(OID.commonName), utf8(commonName))),
);
const extension = (id, value, critical = false) => seq(oid(id), ...(critical ? [bool(true)] : []), octets(value));

// Empreinte de la clé publique (identifiant de clé, RFC 5280 méthode 1).
function keyId(publicKey) {
    const spki = publicKey.export({ type: "spki", format: "der" });
    // Le dernier élément de SubjectPublicKeyInfo est la BIT STRING de la clé : 0x03, longueur, 0x00, clé.
    const raw = spki.subarray(spki.length - 65);
    return crypto.createHash("sha1").update(raw).digest();
}

function serial() {
    const bytes = crypto.randomBytes(16);
    bytes[0] = (bytes[0] & 0x7f) | 0x01;
    return integer(bytes);
}

function sign(tbs, privateKey) {
    const signature = crypto.sign("sha256", tbs, { key: privateKey, dsaEncoding: "der" });
    return seq(tbs, seq(oid(OID.ecdsaWithSha256)), bits(signature));
}

function tbsCertificate({ issuer, subject, publicKey, notBefore, notAfter, extensions }) {
    return seq(
        explicit(0, integer(2)),
        serial(),
        seq(oid(OID.ecdsaWithSha256)),
        issuer,
        seq(time(notBefore), time(notAfter)),
        subject,
        publicKey.export({ type: "spki", format: "der" }),
        explicit(3, seq(...extensions)),
    );
}

const ipv4 = (text) => Buffer.from(text.split(".").map(Number));
const LOOPBACK_V6 = Buffer.from([...new Array(15).fill(0), 1]);
const pem = (label, der) => `-----BEGIN ${label}-----\n${der.toString("base64").match(/.{1,64}/g).join("\n")}\n-----END ${label}-----\n`;

// Crée l'autorité et le certificat du serveur. La clé de l'autorité n'est jamais renvoyée.
// Renvoie { caCert, cert, key } en PEM, et caDer (pour certutil), caThumbprint (SHA-1, hexadécimal).
export function createLocalhostCertificates({ now = new Date() } = {}) {
    const ca = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
    const server = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
    const start = new Date(now.getTime() - 24 * 3600 * 1000);
    const years = (n) => new Date(Date.UTC(start.getUTCFullYear() + n, start.getUTCMonth(), start.getUTCDate()));
    const caName = name("Aria Plume - autorité locale (localhost uniquement)");
    const caKeyId = keyId(ca.publicKey);

    const caDer = sign(tbsCertificate({
        issuer: caName,
        subject: caName,
        publicKey: ca.publicKey,
        notBefore: start,
        notAfter: years(20),
        extensions: [
            extension(OID.basicConstraints, seq(bool(true), integer(0)), true),
            // keyCertSign (bit 5) et cRLSign (bit 6).
            extension(OID.keyUsage, bits(Buffer.from([0x06]), 1), true),
            // Contrainte de noms : seuls localhost, 127.0.0.1 et ::1 peuvent être signés.
            extension(OID.nameConstraints, seq(implicit(0, Buffer.concat([
                seq(implicit(2, Buffer.from("localhost"))),
                seq(implicit(7, Buffer.concat([ipv4("127.0.0.1"), ipv4("255.255.255.255")]))),
                seq(implicit(7, Buffer.concat([LOOPBACK_V6, Buffer.alloc(16, 0xff)]))),
            ]), true)), true),
            extension(OID.subjectKeyId, octets(caKeyId)),
        ],
    }), ca.privateKey);

    const certDer = sign(tbsCertificate({
        issuer: caName,
        subject: name("localhost"),
        publicKey: server.publicKey,
        notBefore: start,
        notAfter: years(10),
        extensions: [
            extension(OID.basicConstraints, seq(), true),
            // digitalSignature (bit 0).
            extension(OID.keyUsage, bits(Buffer.from([0x80]), 7), true),
            extension(OID.extKeyUsage, seq(oid(OID.serverAuth))),
            extension(OID.subjectAltName, seq(
                implicit(2, Buffer.from("localhost")),
                implicit(7, ipv4("127.0.0.1")),
                implicit(7, LOOPBACK_V6),
            )),
            extension(OID.subjectKeyId, octets(keyId(server.publicKey))),
            extension(OID.authorityKeyId, seq(implicit(0, caKeyId))),
        ],
    }), ca.privateKey);

    return {
        caCert: pem("CERTIFICATE", caDer),
        caDer,
        caThumbprint: crypto.createHash("sha1").update(caDer).digest("hex").toUpperCase(),
        cert: pem("CERTIFICATE", certDer),
        key: server.privateKey.export({ type: "pkcs8", format: "pem" }),
    };
}
