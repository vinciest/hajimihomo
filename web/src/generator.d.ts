declare module 'hajimihomo-generator' {
  export {
    buildFullProfile,
    buildProfileFromCustomGroups,
    buildRuleProviders,
    buildMihomoGroups,
    buildSingboxRuleSets,
  } from './ProfileBuilder'
  export type { ProfileOptions, CustomGroup } from './types'
}
