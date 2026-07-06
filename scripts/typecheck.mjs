import { spawnSync } from "node:child_process"

const steps = [
  [process.execPath, ["./node_modules/typescript/bin/tsc", "--noEmit"]],
  [process.execPath, ["./node_modules/typescript/bin/tsc", "--noEmit", "-p", "backend/tsconfig.json"]],
]

for (const [command, args] of steps) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: false })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}
