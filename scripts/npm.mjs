import { execFileSync } from 'node:child_process'
import { basename, isAbsolute } from 'node:path'

/** npm run supplies the actual CLI path, including on Windows where npm.cmd cannot be spawned directly. */
export function runNpm(args, options = {}) {
  const cli = process.env.npm_execpath
  if (!cli || !isAbsolute(cli) || basename(cli) !== 'npm-cli.js')
    throw new Error(
      'Run this maintenance script using npm run so npm_execpath identifies npm-cli.js',
    )
  return execFileSync(process.execPath, [cli, ...args], {
    ...options,
    shell: false,
  })
}
