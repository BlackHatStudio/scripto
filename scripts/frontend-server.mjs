import http from "node:http"
import path from "node:path"

import dotenv from "dotenv"
import next from "next"

dotenv.config({ path: path.resolve(process.cwd(), ".env") })

const port = Number(process.env.PORT || 4444)
const hostname = process.env.HOSTNAME || "0.0.0.0"
const isDev = process.env.NODE_ENV !== "production"

const app = next({ dev: isDev, dir: process.cwd(), webpack: true })
const handle = app.getRequestHandler()

await app.prepare()

http
  .createServer((req, res) => {
    void handle(req, res)
  })
  .listen(port, hostname, () => {
    // eslint-disable-next-line no-console
    console.log(`Scripto frontend listening on http://${hostname}:${port}`)
  })
