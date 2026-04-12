/**
 * E2EE для direct-чатов через tweetnacl (X25519 + XSalsa20-Poly1305).
 *
 * Формат зашифрованного сообщения: "enc:" + base64(nonce[24] + ciphertext[...])
 * Незашифрованные сообщения не имеют префикса "enc:" и показываются как есть.
 */
import nacl from "tweetnacl";
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from "tweetnacl-util";

const ENC_PREFIX = "enc:";

export function generateKeyPair() {
  const kp = nacl.box.keyPair();
  return {
    publicKey: encodeBase64(kp.publicKey),
    secretKey: encodeBase64(kp.secretKey),
  };
}

export function encryptMessage(
  text: string,
  theirPublicKeyB64: string,
  mySecretKeyB64: string,
): string {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const messageBytes = decodeUTF8(text);
  const theirPub = decodeBase64(theirPublicKeyB64);
  const mySec = decodeBase64(mySecretKeyB64);

  const ciphertext = nacl.box(messageBytes, nonce, theirPub, mySec);
  if (!ciphertext) throw new Error("Encryption failed");

  const combined = new Uint8Array(nonce.length + ciphertext.length);
  combined.set(nonce);
  combined.set(ciphertext, nonce.length);

  return ENC_PREFIX + encodeBase64(combined);
}

export function decryptMessage(
  content: string,
  senderPublicKeyB64: string | null | undefined,
  mySecretKeyB64: string | null | undefined,
): string {
  if (!content.startsWith(ENC_PREFIX)) return content;
  if (!senderPublicKeyB64 || !mySecretKeyB64) return "🔒 Зашифровано";

  try {
    const combined = decodeBase64(content.substring(ENC_PREFIX.length));
    const nonce = combined.slice(0, nacl.box.nonceLength);
    const ciphertext = combined.slice(nacl.box.nonceLength);
    const senderPub = decodeBase64(senderPublicKeyB64);
    const mySec = decodeBase64(mySecretKeyB64);

    const plaintext = nacl.box.open(ciphertext, nonce, senderPub, mySec);
    if (!plaintext) return "🔒 Не удалось расшифровать";
    return encodeUTF8(plaintext);
  } catch {
    return "🔒 Не удалось расшифровать";
  }
}

export function isEncrypted(content: string): boolean {
  return content.startsWith(ENC_PREFIX);
}
