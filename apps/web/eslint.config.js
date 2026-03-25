import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
  },
  {
    ignores: ['dist/', '.output/', 'src/routeTree.gen.ts'],
  },
)
