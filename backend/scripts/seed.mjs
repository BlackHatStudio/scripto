import { existsSync } from "node:fs"
import { spawnSync } from "node:child_process"

const distStorePath = new URL("../dist/src/store.js", import.meta.url)

if (!existsSync(distStorePath)) {
  const compile = spawnSync(
    process.execPath,
    ["../node_modules/typescript/bin/tsc", "-p", "tsconfig.json"],
    { cwd: new URL("..", import.meta.url), stdio: "inherit", shell: false }
  )
  if (compile.status !== 0) {
    process.exit(compile.status ?? 1)
  }
}

const { seedDefaults, state } = await import("../dist/src/store.js")
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
