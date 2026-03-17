import { describe, it, expect, vi } from 'vitest'
import { ENC_V2_PREFIX } from './crypto'

describe('Crypto Module', () => {
    const TEST_TOKEN = 'ghp_test_token_123456789'

    // Helper to get a fresh copy of the module
    const getCryptoModule = async () => {
        vi.resetModules()
        return await import('./crypto')
    }

    it('should encrypt and decrypt a token consistently', async () => {
        const { encryptTokenAsync, decryptTokenAsync } = await getCryptoModule()
        const encrypted = await encryptTokenAsync(TEST_TOKEN)
        expect(encrypted.startsWith(ENC_V2_PREFIX)).toBe(true)
        
        const decrypted = await decryptTokenAsync(encrypted)
        expect(decrypted).toBe(TEST_TOKEN)
    })

    it('should return already encrypted tokens as-is in encryptTokenAsync', async () => {
        const { encryptTokenAsync } = await getCryptoModule()
        const encrypted = await encryptTokenAsync(TEST_TOKEN)
        const reEncrypted = await encryptTokenAsync(encrypted)
        expect(reEncrypted).toBe(encrypted)
    })

    it('should return empty string for empty input', async () => {
        const { encryptTokenAsync, decryptTokenAsync } = await getCryptoModule()
        expect(await encryptTokenAsync('')).toBe('')
        expect(await decryptTokenAsync('')).toBe('')
    })

    it('should handle unencrypted tokens in decryptTokenAsync gracefully', async () => {
        const { decryptTokenAsync } = await getCryptoModule()
        expect(await decryptTokenAsync(TEST_TOKEN)).toBe(TEST_TOKEN)
    })
})
