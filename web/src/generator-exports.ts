/**
 * generator-exports.ts — browser ESM entry for hajimihomo generator.
 *
 * Exported as dist/generator.js (browser ESM format).
 * Importable via <script type="module">, importmap, or `bun run dist/generator.js`.
 * Contains: ProfileBuilder + eta templates + YAML snippets + constants.
 * Does NOT contain: catalog data, UI code, Node.js APIs.
 */
export {
  buildFullProfile,
  buildProfileFromCustomGroups,
  buildRuleProviders,
  buildMihomoGroups,
  buildSingboxRuleSets,
} from './ProfileBuilder'
export type { ProfileOptions, CustomGroup } from './types'
