import { spawn, execFileSync } from 'node:child_process'
import { setTimeout } from 'node:timers/promises'

// Fresh, isolated dev ledger. RPC and WebSocket ports bind only to loopback.
const name = `nanopay-integration-${process.pid}`
try {
  execFileSync(
    'docker',
    [
      'run',
      '-d',
      '--platform',
      'linux/amd64',
      '--name',
      name,
      '-p',
      '127.0.0.1:45976:45000',
      '-p',
      '127.0.0.1:45978:47000',
      '--entrypoint',
      '/usr/bin/nano_node',
      'nanocurrency/nano:V28.2@sha256:ae5d9421f87c4620c2285479d95e5e79a2084878058934f7ed6a6b96b6add09e',
      '--daemon',
      '--network',
      'dev',
      '--data_path',
      '/tmp/nanopay-dev',
      '--config',
      'rpc.enable=true',
      'node.enable_voting=true',
      'node.enable_upnp=false',
      'node.preconfigured_peers=[]',
      'node.work_threads=1',
      'node.websocket.enable=true',
      'node.websocket.address="::"',
      'node.websocket.port=47000',
      '--rpcconfig',
      'address="::"',
      'port=45000',
      'enable_control=true',
    ],
    { stdio: 'pipe' },
  )
  let ready = false
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch('http://127.0.0.1:45976', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'version' }),
        signal: AbortSignal.timeout(1000),
      })
      if (response.ok && (await response.json()).network === 'dev') {
        ready = true
        break
      }
    } catch {
      /* Wait for the temporary node to start. */
    }
    await setTimeout(500)
  }
  if (!ready) throw new Error('Nano dev node did not start')
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['test/integration/run.mjs', 'dev'], {
      stdio: 'inherit',
    })
    child.once('error', reject)
    child.once('exit', (code) => resolve(code ?? 1))
  })
  if (code) throw new Error(`Real-node workflow tests failed (${code})`)
} catch (error) {
  try {
    execFileSync('docker', ['logs', '--tail', '40', name], { stdio: 'inherit' })
  } catch {}
  throw error
} finally {
  try {
    execFileSync('docker', ['rm', '-f', name], { stdio: 'pipe' })
  } catch {}
}
