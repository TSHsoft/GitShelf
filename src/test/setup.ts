import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock import.meta.env
vi.stubGlobal('import.meta', {
  env: {
    VITE_CRYPTO_SECRET: 'test_secret_key_123',
    PROD: false
  }
})
