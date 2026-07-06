import { seedDefaults, state } from "../src/store"

await seedDefaults()

// eslint-disable-next-line no-console
console.log(
  JSON.stringify(
    {
      users: state.users.length,
      tenants: state.tenants.length,
      categories: state.dictionaryCategories.length,
      functions: state.voiceFunctions.length,
    },
    null,
    2
  )
)
