import { spawnSync } from "node:child_process"

const steps = [
  [process.execPath, ["./node_modules/typescript/bin/tsc", "-p", "backend/tsconfig.json"]],
  [process.execPath, ["./node_modules/next/dist/bin/next", "build", "--webpack"]],
]

for (const [command, args] of steps) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: false })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}
