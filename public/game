/* =========================================================================
   WICK DUEL — game.js
   3D дуэль от первого лица: пистолет с глушителем, части тела с раздельным
   здоровьем (рука отвалилась — стреляешь с другой; нога — стоишь на одной),
   кровь, боты 3 уровней сложности, онлайн 1х1 через socket.io.
   ========================================================================= */

// ---------- Telegram WebApp ----------
try {
  if (window.Telegram && window.Telegram.WebApp) {
    Telegram.WebApp.ready();
    Telegram.WebApp.expand();
  }
} catch (e) {}

// ---------- Глобальные Three/Cannon объекты ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1c1a17);
scene.fog = new THREE.Fog(0x1c1a17, 15, 60);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 200);

const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
world.broadphase = new CANNON.SAPBroadphase(world);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Освещение и арена (пыльная площадь "Дикого Запада") ----------
function buildArena() {
  const hemi = new THREE.HemisphereLight(0xfff2d0, 0x231a10, 0.9);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffe3a3, 1.4);
  sun.position.set(10, 18, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -20;
  sun.shadow.camera.right = 20;
  sun.shadow.camera.top = 20;
  sun.shadow.camera.bottom = -20;
  scene.add(sun);

  const groundGeo = new THREE.PlaneGeometry(80, 80);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x8a6b45, roughness: 1 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
  groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(groundBody);

  // пара салунов по бокам, для атмосферы
  const buildingMat = new THREE.MeshStandardMaterial({ color: 0x4a3826 });
  [-14, 14].forEach((x) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(6, 8, 6), buildingMat);
    b.position.set(x, 4, -6);
    b.castShadow = true;
    scene.add(b);
  });
}
buildArena();

// ---------- Конструктор человекоподобной модели ----------
// Части: голова, торс, левая/правая рука (одним сегментом плечо+предплечье
// с суставом для сгиба), левая/правая нога аналогично. Каждая часть — mesh
// с собственным pivot-группой для анимации падения/провисания.
const SUIT_DARK = 0x111111;
const SUIT_SHIRT = 0xe8e2d0;
const SKIN = 0xcaa27a;

function buildHumanoid(color = SUIT_DARK) {
  const root = new THREE.Group();

  const suitMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: SUIT_SHIRT, roughness: 0.8 });
  const skinMat = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.9 });
  const tieMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 });

  // Торс
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.28), suitMat);
  torso.position.y = 1.15;
  torso.castShadow = true;
  root.add(torso);

  const shirtStripe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 0.29), shirtMat);
  shirtStripe.position.set(0, 0, 0.001);
  torso.add(shirtStripe);
  const tie = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.03), tieMat);
  tie.position.set(0, -0.02, 0.16);
  torso.add(tie);

  // Голова
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 1.55, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 16), skinMat);
  head.castShadow = true;
  headPivot.add(head);
  root.add(headPivot);

  function buildArm(side) {
    const sign = side === 'L' ? 1 : -1;
    const pivot = new THREE.Group();
    pivot.position.set(sign * 0.32, 1.45, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.55, 4, 8), suitMat);
    arm.position.y = -0.32;
    arm.castShadow = true;
    pivot.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), skinMat);
    hand.position.y = -0.62;
    pivot.add(hand);
    root.add(pivot);
    return { pivot, mesh: arm, hand };
  }

  function buildLeg(side) {
    const sign = side === 'L' ? 1 : -1;
    const pivot = new THREE.Group();
    pivot.position.set(sign * 0.13, 0.8, 0);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.75, 4, 8), suitMat);
    leg.position.y = -0.4;
    leg.castShadow = true;
    pivot.add(leg);
    root.add(pivot);
    return { pivot, mesh: leg };
  }

  const armL = buildArm('L');
  const armR = buildArm('R');
  const legL = buildLeg('L');
  const legR = buildLeg('R');

  root.position.y = 0; // ноги стоят на y=0

  return {
    root,
    parts: {
      head: { pivot: headPivot, mesh: head, hp: 40, max: 40, alive: true, kind: 'head' },
      torso: { pivot: torso, mesh: torso, hp: 60, max: 60, alive: true, kind: 'torso' },
      armL: { ...armL, hp: 30, max: 30, alive: true, kind: 'arm', side: 'L' },
      armR: { ...armR, hp: 30, max: 30, alive: true, kind: 'arm', side: 'R' },
      legL: { ...legL, hp: 35, max: 35, alive: true, kind: 'leg', side: 'L' },
      legR: { ...legR, hp: 35, max: 35, alive: true, kind: 'leg', side: 'R' },
    }
  };
}