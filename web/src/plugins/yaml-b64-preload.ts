// @ts-nocheck
// Preload file: registers yaml-b64 plugin for bun test and bun run CLI.
// Referenced by web/bunfig.toml [preload] and [test.preload].
import { plugin } from 'bun'
import { yamlB64Plugin } from './yaml-b64'
plugin(yamlB64Plugin)
console.error('PRELOAD WORKS')
