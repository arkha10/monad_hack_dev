import {defineConfig} from 'vitest/config'
export default defineConfig({test:{include:['packages/shared/**/*.test.ts','apps/worker/test/**/*.test.ts','apps/web/tests/**/*.test.ts']}})
