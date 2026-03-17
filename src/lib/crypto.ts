export const ENC_PREFIX = 'enc_v1_'
export const ENC_V2_PREFIX = 'enc_v2_'
export const ENC_V3_PREFIX = 'enc_v3_'

// We derive a working key from an environment variable or fallback constant
// using PBKDF2 to ensure a 256-bit AES key.
const KEY_MATERIAL_SALT = 'GitShelf_Salt_2025'
const FALLBACK_SECRET = 'GitShelf_Local_Secret_Key_2025'

// Generate a cryptographic key for AES-GCM
// idSalt is the GitHub User ID to ensure the key is account-specific
async function getCryptoKey(idSalt?: string): Promise<CryptoKey> {
    const rawSecret = import.meta.env.VITE_CRYPTO_SECRET

    if (!rawSecret) {
        if (import.meta.env.PROD || import.meta.env.MODE === 'production') {
            throw new Error('CRITICAL: VITE_CRYPTO_SECRET is not defined. Production encryption requires a secret key.')
        }
    }

    const secret = rawSecret || FALLBACK_SECRET
    // Combine secret and idSalt for true account-bound security
    const dynamicSecret = idSalt ? `${secret}:${idSalt}` : secret

    const enc = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(dynamicSecret),
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

/**
 * Encrypts a token. If idSalt is provided, it uses account-bound encryption (V3).
 * Otherwise, it uses the legacy global secret (V2).
 */
export async function encryptTokenAsync(token: string, idSalt?: string): Promise<string> {
    if (!token) return ''
    
    // If it's already V3 and we have a salt, don't re-encrypt unless requested
    const isAlreadyV3 = token.startsWith(ENC_V3_PREFIX)
    if (idSalt && isAlreadyV3) return token
    
    // If it's already V2 and we DON'T have a salt, keep it
    if (!idSalt && token.startsWith(ENC_V2_PREFIX)) return token

    const key = await getCryptoKey(idSalt)
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

    const prefix = idSalt ? ENC_V3_PREFIX : ENC_V2_PREFIX
    return prefix + bufferToBase64(combined.buffer)
}

/**
 * Decrypts a token. Attempts V3 (account-bound) if it has the prefix, 
 * otherwise falls back to V2 (global secret).
 */
export async function decryptTokenAsync(encryptedToken: string, idSalt?: string): Promise<string> {
    if (!encryptedToken) return ''

    // Backward compatibility with older clear text tokens
    if (!encryptedToken.startsWith(ENC_V3_PREFIX) && 
        !encryptedToken.startsWith(ENC_V2_PREFIX) && 
        !encryptedToken.startsWith(ENC_PREFIX)) {
        return encryptedToken
    }

    const isV3 = encryptedToken.startsWith(ENC_V3_PREFIX)
    const prefix = isV3 ? ENC_V3_PREFIX : (encryptedToken.startsWith(ENC_V2_PREFIX) ? ENC_V2_PREFIX : ENC_PREFIX)

    try {
        // Use idSalt ONLY for V3 tokens. For V2, we must use the global secret.
        const key = await getCryptoKey(isV3 ? idSalt : undefined)
        const combined = new Uint8Array(base64ToBuffer(encryptedToken.slice(prefix.length)))

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
        console.error(`Failed to decrypt ${isV3 ? 'V3' : 'V2/V1'} token`, e)
        return ''
    }
}

/**
 * Checks if a token is using the latest account-bound encryption (V3)
 */
export function isAccountBound(token: string | null): boolean {
    return !!token && token.startsWith(ENC_V3_PREFIX)
}
