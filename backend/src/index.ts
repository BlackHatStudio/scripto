import { app } from "./app"
import { config } from "./config"
import { seedDefaults } from "./store"

// A single unhandled promise rejection in any route (e.g. an async handler
// missing a try/catch) otherwise crashes the entire Node process by default,
// taking the API down for every user until someone manually restarts it. Log
// and keep running instead - the specific request that caused it still fails,
// but the server survives.
process.on("unhandledRejection", (reason) => {
  // eslint-disable-next-line no-console
  console.error("Unhandled promise rejection (backend kept running):", reason)
})
process.on("uncaughtException", (error) => {
  // eslint-disable-next-line no-console
  console.error("Uncaught exception (backend kept running):", error)
})

async function start() {
  // eslint-disable-next-line no-console
  console.log("Backend startup beginning")
  if (!config.skipSeedOnStartup) {
    // eslint-disable-next-line no-console
    console.log("Seeding defaults before listen")
    await seedDefaults()
  } else {
    // eslint-disable-next-line no-console
    console.log("Skipping startup seed")
  }
  app.listen(config.port, config.host, () => {
    // eslint-disable-next-line no-console
    console.log(`Scripto API listening on ${config.host}:${config.port}`)
  })
}

void start()
