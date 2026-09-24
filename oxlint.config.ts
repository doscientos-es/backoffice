import { reactNextConfig } from '@doscientos/configs/oxlint/react-next'

const nativeElementWarnings = [
  {
    element: 'button',
    message: 'Usa Button de @doscientos/ui salvo que documentes una excepción semántica.',
  },
  {
    element: 'input',
    message: 'Usa Input de @doscientos/ui salvo que documentes una excepción semántica.',
  },
  {
    element: 'textarea',
    message: 'Usa Textarea de @doscientos/ui salvo que documentes una excepción semántica.',
  },
  {
    element: 'select',
    message: 'Usa Select de @doscientos/ui salvo que documentes una excepción semántica.',
  },
]

export default {
  extends: [reactNextConfig],
  jsPlugins: ['@shadcn/lint'],
  settings: {
    shadcn: {
      ui: '@doscientos/ui',
      componentImports: ['^@doscientos/ui(?:/|$)'],
      note: 'Usa tokens semánticos y variantes de @doscientos/ui antes de añadir clases propias.',
    },
  },
  rules: {
    'shadcn/no-raw-colors': 'warn',
    'shadcn/no-unknown-classes': 'warn',
    'shadcn/no-arbitrary-values': ['warn', { allow: ['layout'] }],
    'shadcn/no-restyle': ['warn', { allow: ['layout'] }],
    'react/forbid-elements': ['warn', { forbid: nativeElementWarnings }],
  },
}
