export const ENC_PREFIX = 'enc_v1_'
export const ENC_V2_PREFIX = 'enc_v2_'

// We derive a working key from an environment variable or fallback constant
// using PBKDF2 to ensure a 256-bit AES key.
const KEY_MATERIAL_SALT = 'GitShelf_Salt_2025'
const FALLBACK_SECRET = 'GitShelf_Local_Secret_Key_2025'

// Generate a cryptographic key for AES-GCM
async function getCryptoKey(): Promise<CryptoKey> {
    const rawSecret = import.meta.env?.VITE_CRYPTO_SECRET || FALLBACK_SECRET
    const enc = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(rawSecret),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
    )

    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: enc.encode(KEY_MATERIAL_SALT),
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    )
}

// Convert ArrayBuffer to Base64
function bufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
}

// Convert Base64 to ArrayBuffer
function base64ToBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
    }
    return bytes.buffer
}

export async function encryptTokenAsync(token: string): Promise<string> {
    if (!token) return ''
    if (token.startsWith(ENC_V2_PREFIX) || token.startsWith(ENC_PREFIX)) return token // Already encrypted

    const key = await getCryptoKey()
    const iv = crypto.getRandomValues(new Uint8Array(12)) // 96-bit IV for GCM
    const enc = new TextEncoder()

    const encryptedContent = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        enc.encode(token)
    )

    // Combine IV and Ciphertext
    const combined = new Uint8Array(iv.length + encryptedContent.byteLength)
    combined.set(iv, 0)
    combined.set(new Uint8Array(encryptedContent), iv.length)

    return ENC_V2_PREFIX + bufferToBase64(combined.buffer)
}

export async function decryptTokenAsync(encryptedToken: string): Promise<string> {
    if (!encryptedToken) return ''

    // Backward compatibility with older clear text tokens
    if (!encryptedToken.startsWith(ENC_V2_PREFIX) && !encryptedToken.startsWith(ENC_PREFIX)) {
        return encryptedToken
    }

    // Backward compatibility for V1 (XOR legacy)
    if (encryptedToken.startsWith(ENC_PREFIX)) {
        try {
            const raw = atob(encryptedToken.slice(ENC_PREFIX.length))
            let result = ''
            for (let i = 0; i < raw.length; i++) {
                const charCode = raw.charCodeAt(i) ^ FALLBACK_SECRET.charCodeAt(i % FALLBACK_SECRET.length)
                result += String.fromCharCode(charCode)
            }
            return result
        } catch (e) {
            console.error('Failed to decrypt V1 token', e)
            return ''
        }
    }

    // V2 decryption (AES-GCM)
    try {
        const key = await getCryptoKey()
        const combined = new Uint8Array(base64ToBuffer(encryptedToken.slice(ENC_V2_PREFIX.length)))

        // Extract IV and Ciphertext
        const iv = combined.slice(0, 12)
        const ciphertext = combined.slice(12)

        const decryptedContent = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            ciphertext
        )

        const dec = new TextDecoder()
        return dec.decode(decryptedContent)
    } catch (e) {
        console.error('Failed to decrypt V2 token', e)
        return ''
    }
}

// End of crypto library

