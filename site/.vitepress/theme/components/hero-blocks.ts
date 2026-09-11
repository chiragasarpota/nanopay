import {
  ACESFilmicToneMapping,
  Color,
  DataTexture,
  DirectionalLight,
  Group,
  HemisphereLight,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  OrthographicCamera,
  PMREMGenerator,
  RGBAFormat,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

// The original scene uses cubic-bezier(0.42, 0, 0.58, 1) for its block motion.
function easeInOut(progress: number) {
  let t = progress
  for (let i = 0; i < 4; i++) {
    const x = t * (1.26 + t * (-0.78 + 0.52 * t))
    const slope = 1.26 + t * (-1.56 + 1.56 * t)
    t -= (x - progress) / slope
  }
  return t * t * (3 - 2 * t)
}

/** Local geometry and materials: no hosted scene, branding, or texture requests. */
export function createHeroBlocks(canvas: HTMLCanvasElement, accent: string) {
  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'low-power',
  })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.9

  const scene = new Scene()
  const camera = new OrthographicCamera(-3.5, 3.5, 3.5, -3.5, 0.1, 40)
  camera.position.set(6, 5.7, 7)
  camera.lookAt(0, 0, 0)

  const pmrem = new PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  const environment = pmrem.fromScene(room, 0.04)
  scene.environment = environment.texture
  room.dispose()
  pmrem.dispose()

  // Small deterministic grain gives the dark faces a brushed metal finish.
  const size = 64
  const pixels = new Uint8Array(size * size * 4)
  let seed = 1729
  for (let i = 0; i < pixels.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    const value = 120 + (seed >>> 25)
    pixels.set([value, value, value, 255], i)
  }
  const grain = new DataTexture(pixels, size, size, RGBAFormat)
  grain.magFilter = LinearFilter
  grain.minFilter = LinearFilter
  grain.needsUpdate = true
  const blue = new Color(accent)
  const metal = new MeshPhysicalMaterial({
    color: 0x081018,
    metalness: 0.92,
    roughness: 0.2,
    clearcoat: 0.75,
    clearcoatRoughness: 0.2,
    roughnessMap: grain,
    bumpMap: grain,
    bumpScale: 0.055,
    map: grain,
    envMapIntensity: 0.8,
  })
  const top = new MeshPhysicalMaterial({
    color: blue.clone().multiplyScalar(0.12),
    metalness: 0.75,
    roughness: 0.2,
    clearcoat: 0.8,
    clearcoatRoughness: 0.17,
    roughnessMap: grain,
    map: grain,
    bumpMap: grain,
    bumpScale: 0.02,
    envMapIntensity: 1.2,
  })
  const face = new MeshBasicMaterial({
    color: blue,
    // Keep the accent at the brand color instead of washing it out with light.
    toneMapped: false,
  })
  // Equal dimensions and a tiny bevel retain a crisp, square silhouette.
  const geometry = new RoundedBoxGeometry(1, 1, 1, 2, 0.025)
  const materials = [face, metal, top, metal, metal, face]
  const group = new Group()
  const turntable = new Group()
  turntable.add(group)
  const turnAxis = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
  const positions = [
    [1.16, 0, 0],
    [-1.16, 0, 0],
    [0, 1.16, 0],
    [0, -1.16, 0],
    [0, 0, 1.16],
    [0, 0, -1.16],
  ]
  const blocks = positions.map(([x, y, z]) => {
    const mesh = new Mesh(geometry, materials)
    const origin = new Vector3(x, y, z)
    const rotation = new Vector3(
      y ? Math.sign(y) : 0,
      x ? 1 : 0,
      z ? -Math.sign(z) : 0,
    ).multiplyScalar(Math.PI / 2)
    mesh.position.copy(origin)
    group.add(mesh)
    return { mesh, origin, rotation }
  })
  scene.add(turntable, new HemisphereLight(0xffffff, 0x222222, 0.3))
  const key = new DirectionalLight(0xffffff, 1.6)
  key.position.set(-3, 6, 4)
  const rim = new DirectionalLight(0xffffff, 2)
  rim.position.set(5, 1, -3)
  scene.add(key, rim)

  let frame = 0
  let disposed = false
  let running = false
  let elapsed = 0
  let lastTime = 0
  let targetX = 0
  let targetY = 0
  let expansion = 0
  let targetExpansion = 0
  function draw() {
    renderer.render(scene, camera)
  }
  function animate(time: number) {
    if (!running || disposed) return
    const dt = Math.min((time - lastTime) / 1000, 0.05)
    lastTime = time
    elapsed += dt
    const ease = 1 - Math.exp(-6 * dt)
    group.rotation.x += (targetY * 0.12 - group.rotation.x) * ease
    group.rotation.y += (targetX * 0.2 - group.rotation.y) * ease
    expansion += (targetExpansion - expansion) * ease
    // Match the Spline scene: a 20-second turn, with five seconds outward
    // and five seconds back. The six blocks travel from radius 560 to 800
    // and each turns 90 degrees on its original axis.
    const phase = (elapsed % 10) / 5
    const progress = easeInOut(phase <= 1 ? phase : 2 - phase)
    turntable.quaternion.setFromAxisAngle(
      turnAxis,
      ((elapsed % 20) * Math.PI) / 10,
    )
    for (const { mesh, origin, rotation } of blocks) {
      mesh.position
        .copy(origin)
        .multiplyScalar(1 + progress * (800 / 560 - 1) + expansion)
      mesh.rotation.set(
        rotation.x * progress,
        rotation.y * progress,
        rotation.z * progress,
      )
    }
    draw()
    frame = requestAnimationFrame(animate)
  }
  return {
    resize(width: number, height: number) {
      if (disposed || !width || !height) return
      const aspect = width / height
      const halfHeight = 2.8 / Math.min(aspect, 1)
      const halfWidth = halfHeight * aspect
      camera.left = -halfWidth
      camera.right = halfWidth
      camera.top = halfHeight
      camera.bottom = -halfHeight
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
      draw()
    },
    pointer(x: number, y: number, hover: boolean) {
      targetX = x
      targetY = y
      targetExpansion = hover ? 0.14 : 0
    },
    play() {
      if (running || disposed) return
      running = true
      lastTime = performance.now()
      frame = requestAnimationFrame(animate)
    },
    stop() {
      running = false
      cancelAnimationFrame(frame)
    },
    dispose() {
      if (disposed) return
      disposed = true
      running = false
      cancelAnimationFrame(frame)
      geometry.dispose()
      for (const material of [metal, top, face]) material.dispose()
      grain.dispose()
      environment.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
    },
  }
}
