const CUBE = 10;
const HALF = CUBE / 2;
const R = 0.45;
const G = 22;
const MAX_SPEED = 45;
const FLOOR_FRICTION = 1.2;
const BOUNCE_TANGENT_LOSS = 0.995;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0e14);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(13, 9, 15);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 6;
controls.maxDistance = 60;

scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
keyLight.position.set(10, 18, 8);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0x88aaff, 0.35);
fillLight.position.set(-8, -6, -10);
scene.add(fillLight);

const clearMat = new THREE.MeshPhysicalMaterial({
  color: 0x9fd8ff,
  transparent: true,
  opacity: 0,
  roughness: 0.05,
  metalness: 0,
  side: THREE.DoubleSide,
  depthWrite: false
});
const translucidMat = new THREE.MeshPhysicalMaterial({
  color: 0x9fd8ff,
  transparent: true,
  opacity: 0.15,
  roughness: 0.05,
  metalness: 0,
  side: THREE.DoubleSide,
  depthWrite: true
});
const floorMat = new THREE.MeshStandardMaterial({
  color: 0x2a7a8f,
  roughness: 0.6,
  metalness: 0
});

const wallGeo = new THREE.PlaneGeometry(CUBE, CUBE);
function makeWall(material, position, rotation) {
  const mesh = new THREE.Mesh(wallGeo, material);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  scene.add(mesh);
  return mesh;
}
const wallMeshes = [
  makeWall(clearMat, [0, HALF, 0], [Math.PI / 2, 0, 0]),
  makeWall(clearMat, [0, 0, HALF], [0, Math.PI, 0]),
  makeWall(translucidMat, [-HALF, 0, 0], [0, Math.PI / 2, 0]),
  makeWall(translucidMat, [HALF, 0, 0], [0, -Math.PI / 2, 0]),
  makeWall(translucidMat, [0, 0, -HALF], [0, 0, 0]),
  makeWall(floorMat, [0, -HALF, 0], [-Math.PI / 2, 0, 0])
];

const edges = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(CUBE, CUBE, CUBE)),
  new THREE.LineBasicMaterial({ color: 0x5fb2ff, transparent: true, opacity: 0.55 })
);
scene.add(edges);

const ball = new THREE.Mesh(
  new THREE.SphereGeometry(R, 48, 32),
  new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.35, metalness: 0.1 })
);
ball.visible = false;
scene.add(ball);
const baseBallColor = new THREE.Color(0xff7a1a);

const aimLineGeo = new THREE.CylinderGeometry(0.07, 0.07, 1, 12, 1, true);
aimLineGeo.translate(0, 0.5, 0);
const aimLine = new THREE.Mesh(
  aimLineGeo,
  new THREE.MeshBasicMaterial({ color: 0xff7a1a })
);
aimLine.visible = false;
scene.add(aimLine);

const pos = new THREE.Vector3();
const vel = new THREE.Vector3();
let launched = false;
let atRest = false;
let restitution = 0.75;

let aiming = false;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const faceNormal = new THREE.Vector3();
const cubeBox = new THREE.Box3(
  new THREE.Vector3(-HALF, -HALF, -HALF),
  new THREE.Vector3(HALF, HALF, HALF)
);

function rayBoxTarget(ray) {
  let tmin = -Infinity;
  let tmax = Infinity;
  for (const axis of ['x', 'y', 'z']) {
    const inv = 1 / ray.direction[axis];
    let t1 = (cubeBox.min[axis] - ray.origin[axis]) * inv;
    let t2 = (cubeBox.max[axis] - ray.origin[axis]) * inv;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
  }
  if (tmax >= tmin && tmax > 0) {
    return ray.origin.clone().addScaledVector(ray.direction, tmax);
  }
  return null;
}

const startPoint = new THREE.Vector3();
const aimPoint = new THREE.Vector3();
const tmpAim = new THREE.Vector3();

const bouncinessSlider = document.getElementById('bounciness');
const transparencySlider = document.getElementById('transparency');
const bouncinessValue = document.getElementById('bounciness-value');
const transparencyValue = document.getElementById('transparency-value');
const ballColorSlider = document.getElementById('ball-color');
const ballColorValue = document.getElementById('ball-color-value');
const statusEl = document.getElementById('status');

function updateBounciness() {
  restitution = bouncinessSlider.value / 100;
  bouncinessValue.textContent = bouncinessSlider.value + '%';
}

function updateTransparency() {
  translucidMat.opacity = 1 - transparencySlider.value / 100;
  edges.material.opacity = 0.25 + 0.35 * (transparencySlider.value / 100);
  transparencyValue.textContent = transparencySlider.value + '%';
}

function updateBallColor() {
  const color = new THREE.Color().setHSL(ballColorSlider.value / 360, 1, 0.5);
  baseBallColor.copy(color);
  floorMat.color.setHSL(((ballColorSlider.value + 180) % 360) / 360, 0.6, 0.35);
  const hex = '#' + color.getHexString();
  ballColorSlider.style.setProperty('--thumb-color', hex);
  ballColorValue.textContent = hex;
}

bouncinessSlider.addEventListener('input', updateBounciness);
transparencySlider.addEventListener('input', updateTransparency);
ballColorSlider.addEventListener('input', updateBallColor);
updateBounciness();
updateTransparency();
updateBallColor();

document.getElementById('reset').addEventListener('click', resetBall);

function resetBall() {
  launched = false;
  atRest = false;
  ball.visible = false;
  aimLine.visible = false;
  setStatus('Drag on any wall to place the ball and aim.');
}

function setStatus(text) {
  statusEl.textContent = text;
}

function updateMouse(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

renderer.domElement.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  updateMouse(event);
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(wallMeshes);
  if (!hits.length) return;
  controls.enabled = false;
  aiming = true;
  faceNormal.copy(hits[0].face.normal).transformDirection(hits[0].object.matrixWorld);
  if (faceNormal.dot(hits[0].point) > 0) faceNormal.negate();
  pos.copy(hits[0].point).addScaledVector(faceNormal, R);
  startPoint.copy(pos);
  aimPoint.copy(pos);
  ball.position.copy(pos);
  ball.visible = true;
  launched = false;
  atRest = false;
  updateAimLine();
  setStatus('Move to aim into the cube, then release to launch.');
});

window.addEventListener('pointermove', (event) => {
  if (!aiming) return;
  updateMouse(event);
  raycaster.setFromCamera(mouse, camera);
  const target = rayBoxTarget(raycaster.ray);
  if (target) {
    aimPoint.copy(target);
  } else {
    const t = raycaster.ray.direction.dot(tmpAim.subVectors(startPoint, raycaster.ray.origin));
    aimPoint.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, Math.max(t, 0.1));
  }
  updateAimLine();
});

window.addEventListener('pointerup', () => {
  if (!aiming) return;
  aiming = false;
  controls.enabled = true;
  aimLine.visible = false;
  const drag = aimPoint.clone().sub(startPoint);
  const length = drag.length();
  if (length < 0.15) {
    vel.set(0, 0, 0);
  } else {
    const speed = Math.min(length * 3, MAX_SPEED);
    vel.copy(drag.normalize().multiplyScalar(speed));
  }
  launched = true;
  setStatus('Ball in flight.');
});

const aimUp = new THREE.Vector3(0, 1, 0);
const aimDir = new THREE.Vector3();

function updateAimLine() {
  aimDir.subVectors(aimPoint, startPoint);
  const len = aimDir.length();
  if (len < 1e-4) {
    aimLine.visible = false;
    return;
  }
  aimLine.position.copy(startPoint);
  aimLine.scale.set(1, len, 1);
  aimLine.quaternion.setFromUnitVectors(aimUp, aimDir.normalize());
  aimLine.material.color.copy(baseBallColor);
  aimLine.visible = true;
}

function step(h) {
  vel.y -= G * h;
  pos.addScaledVector(vel, h);
  const lim = HALF - R;
  let bounced = false;
  for (const axis of ['x', 'y', 'z']) {
    if (pos[axis] > lim) {
      pos[axis] = lim;
      if (vel[axis] > 0) {
        vel[axis] = -vel[axis] * restitution;
        bounced = true;
      }
    } else if (pos[axis] < -lim) {
      pos[axis] = -lim;
      if (vel[axis] < 0) {
        vel[axis] = -vel[axis] * restitution;
        bounced = true;
      }
    }
  }
  if (bounced) {
    vel.x *= BOUNCE_TANGENT_LOSS;
    vel.z *= BOUNCE_TANGENT_LOSS;
  }
  if (pos.y <= -lim + 1e-4) {
    const friction = Math.max(0, 1 - FLOOR_FRICTION * h);
    vel.x *= friction;
    vel.z *= friction;
    if (vel.lengthSq() < 0.02 && Math.abs(vel.y) < 0.6) {
      vel.set(0, 0, 0);
      pos.y = -lim;
      if (!atRest) {
        atRest = true;
        setStatus('Ball at rest. Drag on any wall to launch again.');
      }
    }
  }
  ball.position.copy(pos);
}

const camToBall = new THREE.Vector3();
const crossPoint = new THREE.Vector3();
const wallPlanes = [];
for (const axis of ['x', 'y', 'z']) {
  for (const sign of [-1, 1]) {
    wallPlanes.push({ axis, value: sign * HALF });
  }
}

function opacityOfWall(axis, value) {
  if (axis === 'y') return value > 0 ? clearMat.opacity : 1;
  if (axis === 'z') return value > 0 ? clearMat.opacity : translucidMat.opacity;
  return translucidMat.opacity;
}

function wallDimmingFactor() {
  if (!ball.visible) return 1;
  camToBall.subVectors(ball.position, camera.position);
  const distBall = camToBall.length();
  if (distBall < 1e-6) return 1;
  let factor = 1;
  for (const plane of wallPlanes) {
    const dCam = camera.position[plane.axis];
    const dBall = ball.position[plane.axis];
    if ((dCam - plane.value) * (dBall - plane.value) >= 0) continue;
    const t = (plane.value - dCam) / (dBall - dCam);
    crossPoint.copy(camera.position).addScaledVector(camToBall, t);
    let insideFace = true;
    for (const other of ['x', 'y', 'z']) {
      if (other === plane.axis) continue;
      if (Math.abs(crossPoint[other]) > HALF) {
        insideFace = false;
        break;
      }
    }
    if (insideFace) {
      factor = Math.min(factor, 1 - opacityOfWall(plane.axis, plane.value));
    }
  }
  return factor;
}

let last = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (launched && !atRest) {
    const substeps = 8;
    const h = dt / substeps;
    for (let i = 0; i < substeps; i++) {
      if (atRest) break;
      step(h);
    }
  }
  ball.material.color.copy(baseBallColor).multiplyScalar(wallDimmingFactor());
  controls.update();
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
