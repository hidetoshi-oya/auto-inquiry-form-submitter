import { beforeEach, vi } from 'vitest'

// モックの設定
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
  writable: true,
})

// console.log をテスト中に抑制（必要に応じて）
beforeEach(() => {
  vi.clearAllMocks()
})

// import.meta.env のモック
vi.mock('vite', () => ({
  defineConfig: vi.fn(),
}))