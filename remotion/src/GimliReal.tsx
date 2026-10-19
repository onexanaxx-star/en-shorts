// «Реалистичная» версия 3D-реконструкции Gimli Glider (19.10.2026, владелец: «чуть пореалистичнее»).
// Настоящее небо-шейдер с закатным солнцем и отражениями, мягкие облака из клубов, Боинг 767 в реальных размерах
// (1 единица = 1 метр по самолёту), плоская прерия Манитобы с полями рапса, тени, шасси, дым на посадке, зерно плёнки.
import { Audio } from "@remotion/media";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { Music } from "./AutoInfo";
import { altAt, EndTitle, FuelPanel, HUD, MapPanel, Plan, planOf, ReconProps, smooth, xAt } from "./GimliRecon";
import { Captions, clamp, setAccent } from "./infokit";
import "./fonts";

const ACC = "#FF9F43";
const ease = Easing.bezier(0.45, 0, 0.25, 1);
const SUN = new THREE.Vector3(0.78, 0.045, -0.62).normalize(); // низкое закатное солнце впереди-слева

const rnd = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const setSky = (sky: Sky) => {
  const u = sky.material.uniforms;
  u.turbidity.value = 10;
  u.rayleigh.value = 3.0;
  u.mieCoefficient.value = 0.008;
  u.mieDirectionalG.value = 0.86;
  u.sunPosition.value.copy(SUN);
};

// ---------- окружение: небо + отражения на корпусе ----------
const SkyAndEnv: React.FC = () => {
  const { gl, scene, camera } = useThree();
  const sky = useMemo(() => {
    const s = new Sky();
    s.scale.setScalar(15000);
    setSky(s);
    return s;
  }, []);
  useMemo(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const sc = new THREE.Scene();
    const s2 = new Sky();
    s2.scale.setScalar(1000);
    setSky(s2);
    sc.add(s2);
    scene.environment = pm.fromScene(sc, 0.02).texture;
    scene.environmentIntensity = 0.9;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 0.5;
  }, [gl, scene]);
  sky.position.copy(camera.position);
  return <primitive object={sky} />;
};

// ---------- Боинг 767-200: размеры близки к настоящим ----------
const usePlaneGeo = () =>
  useMemo(() => {
    // фюзеляж: профиль радиуса вдоль длины (нос в +X)
    const prof: [number, number][] = [
      [-24.3, 0.0], [-23.6, 0.45], [-22.0, 1.15], [-19.5, 1.85], [-16.5, 2.35], [-13.5, 2.52], [16.5, 2.52], [19.0, 2.42],
      [21.0, 2.15], [22.6, 1.7], [23.6, 1.15], [24.2, 0.55], [24.45, 0.0],
    ];
    const pts = prof.map(([x, r]) => new THREE.Vector2(r, x));
    const fus = new THREE.LatheGeometry(pts, 56);
    fus.rotateZ(-Math.PI / 2);
    // хвост приподнят (как у настоящего лайнера)
    const p = fus.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      if (x < -14) p.setY(i, p.getY(i) + Math.pow((-14 - x) / 10.3, 2) * 1.6);
    }
    // окраска: белый верх, серое брюхо, полоса цвета канала под окнами
    const col: number[] = [];
    const white = new THREE.Color("#F3F3F1"), grey = new THREE.Color("#9EA3AA"), acc = new THREE.Color(ACC);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i) - (x < -14 ? Math.pow((-14 - x) / 10.3, 2) * 1.6 : 0);
      const c = y < -1.1 ? grey : y < -0.35 && y > -0.85 ? acc : white;
      col.push(c.r, c.g, c.b);
    }
    fus.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    fus.computeVertexNormals();

    const planform = (pts2: [number, number][], thick: number) => {
      const sh = new THREE.Shape(pts2.map(([a, b]) => new THREE.Vector2(a, b)));
      const g = new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: true, bevelThickness: thick * 0.4, bevelSize: thick * 0.5, bevelSegments: 2 });
      g.rotateX(Math.PI / 2);
      return g;
    };
    // крыло: стреловидность ~31.5 град., размах половины ~22 м
    const wing = planform([[4.2, 2.0], [-10.2, 24.0], [-12.3, 24.0], [-7.6, 9.0], [-5.6, 2.0]], 0.35);
    const stab = planform([[0, 0], [-6.4, 9.2], [-8.2, 9.2], [-4.6, 0]], 0.2);
    const finSh = new THREE.Shape([[0, 0], [-6.3, 9.3], [-8.6, 9.3], [-8.2, 0]].map(([a, b]) => new THREE.Vector2(a, b)));
    const fin = new THREE.ExtrudeGeometry(finSh, { depth: 0.36, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.15, bevelSegments: 2 });
    fin.translate(0, 0, -0.18);
    // гондола двигателя
    const nac = new THREE.LatheGeometry(
      [[1.12, 3.4], [1.3, 3.65], [1.48, 3.2], [1.52, 2.0], [1.46, -1.0], [1.15, -3.2], [0.86, -3.8], [0.8, -3.6]].map(([r, x]) => new THREE.Vector2(r, x)),
      40,
    );
    nac.rotateZ(-Math.PI / 2);
    return { fus, wing, stab, fin, nac };
  }, []);

const Windows: React.FC = () => {
  const mesh = useMemo(() => {
    const g = new THREE.BoxGeometry(0.28, 0.42, 0.08);
    const m = new THREE.MeshStandardMaterial({ color: "#151a22", roughness: 0.15, metalness: 0.6 });
    const n = 58;
    const im = new THREE.InstancedMesh(g, m, n * 2);
    const o = new THREE.Object3D();
    for (let i = 0; i < n; i++) {
      for (const side of [1, -1]) {
        o.position.set(17 - i * 0.56, 0.45, side * 2.47);
        o.rotation.set(0, 0, 0);
        o.updateMatrix();
        im.setMatrixAt(i * 2 + (side > 0 ? 0 : 1), o.matrix);
      }
    }
    return im;
  }, []);
  return <primitive object={mesh} />;
};

const Gear: React.FC<{ down: number; collapse?: number; nose?: boolean }> = ({ down, collapse = 0, nose }) => {
  // стойка поворачивается из ниши (down 0..1); у передней - «складывается» назад при поломке
  const ang = (1 - down) * (nose ? 1.5 : -1.5) + collapse * 1.35;
  const wheels = nose ? [[0, 0.5], [0, -0.5]] : [[0.75, 0.6], [0.75, -0.6], [-0.75, 0.6], [-0.75, -0.6]];
  return (
    <group rotation={[0, 0, ang]} visible={down > 0.02 || collapse > 0}>
      <mesh position={[0, -1.4, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 2.8, 10]} />
        <meshStandardMaterial color="#B9BDC2" metalness={0.8} roughness={0.3} />
      </mesh>
      {wheels.map(([x, z], i) => (
        <mesh key={i} position={[x, -2.85, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.55, 0.55, 0.42, 18]} />
          <meshStandardMaterial color="#1A1A1C" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
};

const Engine: React.FC<{ side: number; spin: number; nac: THREE.BufferGeometry }> = ({ side, spin, nac }) => (
  <group position={[1.9, -3.0, side * 8.0]}>
    <mesh geometry={nac} castShadow>
      <meshStandardMaterial color="#E9EAEC" metalness={0.35} roughness={0.3} />
    </mesh>
    {/* вентилятор: лопатки крутятся (после отказа - медленное авторотирование) */}
    <group position={[3.15, 0, 0]} rotation={[spin, 0, 0]}>
      <mesh rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[1.15, 1.15, 0.1, 32]} />
        <meshStandardMaterial color="#2B2F36" metalness={0.7} roughness={0.35} />
      </mesh>
      {Array.from({ length: 12 }).map((_, k) => (
        <mesh key={k} position={[0.06, 0, 0]} rotation={[(k / 12) * Math.PI * 2, 0, 0]}>
          <boxGeometry args={[0.04, 2.1, 0.22]} />
          <meshStandardMaterial color="#8C929B" metalness={0.8} roughness={0.25} />
        </mesh>
      ))}
      <mesh position={[0.25, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.32, 0.6, 16]} />
        <meshStandardMaterial color="#C9CDD2" metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
    {/* пилон: тонкий, от верха гондолы к низу крыла */}
    <mesh position={[-0.4, 1.75, 0]}>
      <boxGeometry args={[5.2, 0.9, 0.36]} />
      <meshStandardMaterial color="#D9DBDE" metalness={0.3} roughness={0.4} />
    </mesh>
    {/* выхлоп: сопло и конус */}
    <mesh position={[-4.15, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
      <coneGeometry args={[0.62, 1.6, 24]} />
      <meshStandardMaterial color="#5C6068" metalness={0.8} roughness={0.35} />
    </mesh>
    <mesh position={[-3.75, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
      <cylinderGeometry args={[0.86, 0.86, 0.12, 28, 1, true]} />
      <meshStandardMaterial color="#2A2D33" metalness={0.6} roughness={0.5} side={THREE.DoubleSide} />
    </mesh>
  </group>
);

const Plane767: React.FC<{ spin: number; rat: number; ratSpin: number; gear: number; noseCollapse: number }> = ({ spin, rat, ratSpin, gear, noseCollapse }) => {
  const g = usePlaneGeo();
  const skin = <meshStandardMaterial vertexColors metalness={0.3} roughness={0.32} />;
  const alu = <meshStandardMaterial color="#C7CBD1" metalness={0.55} roughness={0.38} side={THREE.DoubleSide} />;
  return (
    <group>
      <mesh geometry={g.fus} castShadow>{skin}</mesh>
      <Windows />
      {/* стёкла кабины */}
      {[1, -1].map((side) => (
        <mesh key={side} position={[22.0, 0.95, side * 1.35]} rotation={[0, side * 0.55, side * -0.25]}>
          <boxGeometry args={[1.5, 0.55, 0.1]} />
          <meshStandardMaterial color="#10141B" metalness={0.7} roughness={0.08} />
        </mesh>
      ))}
      {/* крылья с поперечным V */}
      <group position={[0, -1.35, 0]}>
        <mesh geometry={g.wing} rotation={[-0.1, 0, 0]} castShadow>{alu}</mesh>
        <mesh geometry={g.wing} rotation={[0.1, 0, 0]} scale={[1, 1, -1]} castShadow>{alu}</mesh>
      </group>
      {/* хвостовое оперение */}
      <group position={[-17.5, 1.9, 0]}>
        <mesh geometry={g.stab} rotation={[-0.12, 0, 0]} castShadow>{alu}</mesh>
        <mesh geometry={g.stab} rotation={[0.12, 0, 0]} scale={[1, 1, -1]} castShadow>{alu}</mesh>
      </group>
      <mesh geometry={g.fin} position={[-15.8, 2.2, 0]} castShadow>
        <meshStandardMaterial color={ACC} metalness={0.25} roughness={0.35} />
      </mesh>
      {[1, -1].map((side) => (
        <Engine key={side} side={side} spin={spin * side} nac={g.nac} />
      ))}
      {/* шасси */}
      {[1, -1].map((side) => (
        <group key={side} position={[-2.2, -1.6, side * 4.6]}>
          <Gear down={gear} />
        </group>
      ))}
      <group position={[17.5, -2.0, 0]}>
        <Gear down={gear} nose collapse={noseCollapse} />
      </group>
      {/* аварийная турбина RAT (у 767 выпускается из обтекателя крыла справа) */}
      <group position={[-1.5, -2.3 - 1.2 * rat, 3.2]} visible={rat > 0.01}>
        <mesh position={[0, 0.6, 0]} rotation={[0, 0, 0.25]}>
          <boxGeometry args={[0.16, 1.5 * rat + 0.01, 0.1]} />
          <meshStandardMaterial color="#9EA3AA" metalness={0.7} roughness={0.35} />
        </mesh>
        <group position={[0.35, 0, 0]}>
          <mesh rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[0.16, 0.45, 16]} />
            <meshStandardMaterial color="#C9CDD2" metalness={0.7} roughness={0.3} />
          </mesh>
          {/* размытый вращением диск */}
          <mesh rotation={[0, 0, -Math.PI / 2]}>
            <cylinderGeometry args={[0.8 * rat, 0.8 * rat, 0.01, 32]} />
            <meshStandardMaterial color="#3A3E45" transparent opacity={0.28} metalness={0.4} roughness={0.5} depthWrite={false} />
          </mesh>
          <group rotation={[ratSpin, 0, 0]}>
            <mesh>
              <boxGeometry args={[0.03, 1.6 * rat, 0.14]} />
              <meshStandardMaterial color="#4A4F57" transparent opacity={0.55} metalness={0.5} roughness={0.4} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
};

// ---------- земля: прерия Манитобы (плоская), поля рапса и пшеницы, дороги ----------
const useGroundTex = (W: number, H: number) =>
  useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 4096;
    c.height = 2048;
    const g = c.getContext("2d")!;
    const sx = c.width / W, sy = c.height / H;
    const pal = ["#56612F", "#6B7436", "#8A8A42", "#C9B23C", "#D9C24A", "#4C5A2B", "#7A6A3E", "#5E6B34", "#A39A4E"];
    g.fillStyle = "#56612F";
    g.fillRect(0, 0, c.width, c.height);
    let i = 0;
    for (let x = 0; x < W; x += 160) {
      for (let y = 0; y < H; y += 160) {
        // каждый квартал делится на 1-4 поля
        const parts = 1 + Math.floor(rnd(++i) * 3);
        for (let k = 0; k < parts; k++) {
          const w = 160 / (parts > 2 ? 2 : 1), h = 160 / (parts > 1 ? 2 : 1);
          const ox = (k % 2) * w, oy = Math.floor(k / 2) * h;
          g.fillStyle = pal[Math.floor(rnd(i * 7 + k) * pal.length)];
          g.fillRect((x + ox) * sx, (y + oy) * sy, w * sx + 1, h * sy + 1);
          // борозды
          g.globalAlpha = 0.08;
          g.strokeStyle = "#000";
          for (let l = 0; l < w; l += 4) {
            g.beginPath();
            g.moveTo((x + ox + l) * sx, (y + oy) * sy);
            g.lineTo((x + ox + l) * sx, (y + oy + h) * sy);
            g.stroke();
          }
          g.globalAlpha = 1;
        }
      }
    }
    // шум, чтобы не было «пластика»
    const img = g.getImageData(0, 0, c.width, c.height);
    for (let p = 0; p < img.data.length; p += 4) {
      const n = (rnd(p * 0.37) - 0.5) * 26;
      img.data[p] += n;
      img.data[p + 1] += n;
      img.data[p + 2] += n * 0.6;
    }
    g.putImageData(img, 0, 0);
    // грунтовые дороги по сетке
    g.strokeStyle = "#9C8F78";
    g.lineWidth = 3;
    for (let x = 0; x < W; x += 320) {
      g.beginPath();
      g.moveTo(x * sx, 0);
      g.lineTo(x * sx, c.height);
      g.stroke();
    }
    for (let y = 0; y < H; y += 320) {
      g.beginPath();
      g.moveTo(0, y * sy);
      g.lineTo(c.width, y * sy);
      g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, [W, H]);

const Ground: React.FC<{ xTD: number }> = ({ xTD }) => {
  const W = xTD + 4000, H = 4000;
  const tex = useGroundTex(W, H);
  const trees = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(4, 0);
    const m = new THREE.MeshStandardMaterial({ color: "#26331C", roughness: 1, flatShading: true });
    const n = 900;
    const im = new THREE.InstancedMesh(g, m, n);
    const o = new THREE.Object3D();
    for (let k = 0; k < n; k++) {
      // лесополосы вдоль дорог
      const line = Math.floor(rnd(k) * 14);
      const along = rnd(k + 3) * W - 1500;
      const vertical = line % 2 === 0;
      const x = vertical ? -1500 + (line * 320) % W : along;
      const z = vertical ? along * 0.5 - 1000 : -2000 + (line * 320) % H;
      if (Math.abs(x - xTD - 300) < 700 && Math.abs(z) < 90) continue;
      if (z < -420 && x > xTD - 900) continue;
      o.position.set(x, 3.5, z);
      o.scale.set(1 + rnd(k + 9), 1 + rnd(k + 11) * 0.8, 1 + rnd(k + 13));
      o.updateMatrix();
      im.setMatrixAt(k, o.matrix);
    }
    im.castShadow = true;
    return im;
  }, [W, H, xTD]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[W / 2 - 1500, 0, 0]} receiveShadow>
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial map={tex} roughness={0.95} />
      </mesh>
      {/* озеро Виннипег: тёмная вода с бликом заката */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[xTD + 900, 0.2, -1700]}>
        <planeGeometry args={[4200, 2560]} />
        <meshStandardMaterial color="#14263A" metalness={0.9} roughness={0.12} />
      </mesh>
      <primitive object={trees} />
    </group>
  );
};

const Runway: React.FC<{ xTD: number }> = ({ xTD }) => {
  const x0 = xTD - 160;
  const len = 1000;
  const cars = ["#C1121F", "#F1FAEE", "#FFB703", "#1D6FA3", "#5A189A", "#FB8500", "#2B2D42"];
  return (
    <group>
      <mesh position={[x0 + len / 2, 0.12, 0]} receiveShadow>
        <boxGeometry args={[len, 0.2, 46]} />
        <meshStandardMaterial color="#4A4B4F" roughness={0.92} />
      </mesh>
      {/* разметка и следы шин */}
      {Array.from({ length: 30 }).map((_, k) => (
        <mesh key={k} position={[x0 + 30 + k * 32, 0.23, 0]} receiveShadow>
          <boxGeometry args={[16, 0.02, 0.9]} />
          <meshStandardMaterial color="#D8D5CE" roughness={0.8} />
        </mesh>
      ))}
      {[-21, 21].map((z) => (
        <mesh key={z} position={[x0 + len / 2, 0.23, z]}>
          <boxGeometry args={[len, 0.02, 0.6]} />
          <meshStandardMaterial color="#D8D5CE" roughness={0.8} />
        </mesh>
      ))}
      {/* гоночный день: машины, кемперы, ограждение */}
      {Array.from({ length: 46 }).map((_, k) => {
        const far = k < 12;
        const x = far ? x0 + len - 140 + (k % 4) * 6.5 : x0 + 150 + (k - 12) * 22 + rnd(k) * 8;
        const z = far ? -10 + Math.floor(k / 4) * 9 : (k % 2 ? 1 : -1) * (30 + rnd(k) * 16);
        const camper = !far && k % 4 === 0;
        return (
          <mesh key={k} position={[x, camper ? 1.7 : 0.8, z]} rotation={[0, (rnd(k + 5) - 0.5) * 0.4, 0]} castShadow receiveShadow>
            <boxGeometry args={camper ? [7.5, 3.2, 2.6] : [4.4, 1.3, 1.9]} />
            <meshStandardMaterial color={camper ? "#DCD6C8" : cars[k % cars.length]} metalness={camper ? 0.1 : 0.6} roughness={0.35} />
          </mesh>
        );
      })}
    </group>
  );
};

// ---------- облака: мягкие клубы из полупрозрачных спрайтов ----------
const useCloudTex = () =>
  useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d")!;
    for (let k = 0; k < 26; k++) {
      const x = 128 + (rnd(k) - 0.5) * 120, y = 128 + (rnd(k + 40) - 0.5) * 70, r = 30 + rnd(k + 80) * 50;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, "rgba(255,255,255,0.55)");
      gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);

const Clouds: React.FC<{ xTD: number }> = ({ xTD }) => {
  const tex = useCloudTex();
  const sprites = useMemo(() => {
    const out: { p: [number, number, number]; s: number; c: string; o: number }[] = [];
    for (let k = 0; k < 170; k++) {
      const cx = -700 + rnd(k + 11) * (xTD * 0.85 + 1200), cy = 215 + rnd(k + 31) * 25, cz = -900 + rnd(k + 51) * 1800;
      for (let j = 0; j < 6; j++) {
        const dy = (rnd(k * 9 + j) - 0.3) * 18;
        out.push({
          p: [cx + (rnd(k * 13 + j) - 0.5) * 120, cy + dy, cz + (rnd(k * 17 + j) - 0.5) * 90],
          s: 70 + rnd(k * 19 + j) * 90,
          c: dy > 4 ? "#FFE6D2" : dy > -4 ? "#E9D6CF" : "#9C8FA6", // верх подсвечен закатом, низ в тени
          o: 0.6,
        });
      }
    }
    return out;
  }, [xTD]);
  return (
    <group>
      {sprites.map((s, k) => (
        <sprite key={k} position={s.p} scale={[s.s, s.s * 0.6, 1]}>
          <spriteMaterial map={tex} color={s.c} transparent opacity={s.o} depthWrite={false} />
        </sprite>
      ))}
    </group>
  );
};

// дым из-под носа и искры после складывания передней стойки
const Debris: React.FC<{ t: number; p: Plan }> = ({ t, p }) => {
  const tex = useCloudTex();
  const t0 = p.tTD + 0.9;
  if (t < t0 || t > p.tStop + 2.5) return null;
  const nx = xAt(t, p) + 19;
  const moving = t < p.tStop;
  return (
    <group>
      {moving
        ? Array.from({ length: 36 }).map((_, k) => {
            const age = ((t - t0) * 3 + rnd(k)) % 1;
            return (
              <mesh key={k} position={[nx - age * 18 - rnd(k + 3) * 3, 0.4 + age * 2.4 * rnd(k + 9), (rnd(k + 5) - 0.5) * 5 * (1 + age)]}>
                <boxGeometry args={[0.18, 0.18, 0.18]} />
                <meshBasicMaterial color={k % 3 ? "#FFB347" : "#FFF3B0"} transparent opacity={1 - age} />
              </mesh>
            );
          })
        : null}
      {Array.from({ length: 22 }).map((_, k) => {
        const born = t0 + rnd(k + 1) * Math.max(0.1, Math.min(t, p.tStop) - t0);
        const age = t - born;
        if (age < 0) return null;
        const x = xAt(born, p) + 19 - age * 3;
        const sc = 6 + age * 9;
        return (
          <sprite key={`s${k}`} position={[x, 1.5 + age * 3, (rnd(k + 2) - 0.5) * 8]} scale={[sc, sc, 1]}>
            <spriteMaterial map={tex} color="#B9B2AA" transparent opacity={Math.max(0, 0.55 - age * 0.12)} depthWrite={false} />
          </sprite>
        );
      })}
    </group>
  );
};

// ---------- свет с тенью, который «ездит» за самолётом ----------
const SunLight: React.FC<{ px: number; py: number }> = ({ px, py }) => {
  const light = useMemo(() => {
    const l = new THREE.DirectionalLight("#FFC9A0", 3.2);
    l.castShadow = true;
    l.shadow.mapSize.set(2048, 2048);
    const c = l.shadow.camera as THREE.OrthographicCamera;
    c.left = -90;
    c.right = 90;
    c.top = 90;
    c.bottom = -90;
    c.near = 1;
    c.far = 1500;
    l.shadow.bias = -0.0004;
    return l;
  }, []);
  const target = useMemo(() => new THREE.Object3D(), []);
  const gy = Math.min(py, 40); // тень нужна у земли - держим «камеру тени» рядом
  const snap = (v: number) => Math.round(v / 2) * 2;
  target.position.set(snap(px), snap(gy), 0);
  light.position.set(snap(px) + SUN.x * 600, snap(gy) + SUN.y * 600 + 250, SUN.z * 600);
  light.target = target;
  return (
    <>
      <primitive object={light} />
      <primitive object={target} />
    </>
  );
};

// ---------- камера ----------
type Shot = { off: [number, number, number]; look?: (px: number, py: number) => [number, number, number] };

const CameraRig: React.FC<{ t: number; p: Plan; px: number; py: number }> = ({ t, p, px, py }) => {
  const { camera } = useThree();
  const s = p.s;
  const shots: { at: number; shot: Shot }[] = [
    { at: 0, shot: { off: [-62, 14, 46] } },
    { at: s[1], shot: { off: [-26, 3, 34], look: (x, y) => [x + 3, y - 2.5, 8] } },
    { at: s[2], shot: { off: [-30, 30, 125] } },
    { at: s[3], shot: { off: [-7, -11, 24], look: (x, y) => [x - 1.2, y - 3.8, 3.2] } },
    { at: s[4], shot: { off: [-95, 70, -12] } },
    { at: s[5], shot: { off: [-58, 16, -5], look: () => [p.xTD + 200, 0, 0] } },
    { at: s[6], shot: { off: [62, 6, 52] } },
    { at: s[7], shot: { off: [40, 3.5, 38] } },
    { at: s[8], shot: { off: [0, 0, 0] } },
  ];
  let k = 0;
  while (k + 1 < shots.length && t >= shots[k + 1].at) k++;
  const cur = shots[k];
  const prev = shots[Math.max(0, k - 1)];
  const blend = k === 0 ? 1 : interpolate(t, [cur.at, cur.at + 1.6], [0, 1], { ...clamp, easing: ease });
  const off = (sh: Shot, idx: number): [number, number, number] => {
    if (idx === shots.length - 1) {
      const a = (t - shots[idx].at) * 0.3 + 0.7;
      return [Math.cos(a) * 70, 18, Math.sin(a) * 70];
    }
    return sh.off;
  };
  const o1 = off(prev.shot, Math.max(0, k - 1));
  const o2 = off(cur.shot, k);
  const o = o1.map((v, i) => v + (o2[i] - v) * blend);
  const tg = (sh: Shot): [number, number, number] => (sh.look ? sh.look(px, py) : [px + 4, py, 0]);
  const l1 = tg(prev.shot), l2 = tg(cur.shot);
  const l = l1.map((v, i) => v + (l2[i] - v) * blend);
  // очень медленное «дыхание» камеры (раз в несколько секунд), без мелкой тряски
  const sh = (i: number) => Math.sin(t * 0.45 + i * 1.7) * 0.8;
  const rumble = t > p.tTD + 0.5 && t < p.tStop ? Math.sin(t * 9) * 0.12 : 0; // лёгкая вибрация только на пробеге
  camera.position.set(px + o[0] + sh(1), Math.max(2.5, py + o[1] + sh(2) * 0.5 + rumble), o[2] + sh(3));
  camera.lookAt(l[0], l[1], l[2]);
  return null;
};

const World: React.FC<{ t: number; p: Plan }> = ({ t, p }) => {
  const px = xAt(t, p);
  const py = altAt(t, p) + 1.8; // колёса выпущенного шасси касаются асфальта
  const s = p.s;
  const bank = smooth(t, [s[4] + 0.3, s[4] + 2.2, s[5] - 1.6, s[5] + 0.3], [0, -0.42, -0.42, 0]);
  const slip = smooth(t, [s[6] + 0.2, s[6] + 2.0, p.tTD - 1.8, p.tTD - 0.3], [0, 1, 1, 0]);
  const glidePitch = smooth(t, [s[1] + 1.2, s[1] + 3.5], [0, -0.04]);
  const noseDown = smooth(t, [p.tTD + 0.6, p.tTD + 1.3], [0, -0.075]);
  const flare = smooth(t, [p.tTD - 1.6, p.tTD - 0.3, p.tTD + 0.6], [0, 0.07, 0.02]);
  const rat = smooth(t, [s[3] + 1.0, s[3] + 2.4], [0, 1]);
  const gear = smooth(t, [s[5] + 1, s[5] + 3.5], [0, 1]);
  const noseCollapse = smooth(t, [p.tTD + 0.5, p.tTD + 1.2], [0, 1]);
  // угол вентилятора = накопленные обороты: 30 рад/с, после отказа плавно до 4 (авторотация) - без рывка
  const fa = s[1] + 0.8, fb = s[1] + 2.2;
  const spin = t <= fa ? 30 * t : t <= fb ? 30 * fa + 30 * (t - fa) - (13 * (t - fa) ** 2) / (fb - fa) : 30 * fa + 17 * (fb - fa) + 4 * (t - fb);
  return (
    <>
      <fog attach="fog" args={["#D3906E", 600, 4600]} />
      <SkyAndEnv />
      <hemisphereLight args={["#FFD9BE", "#3A3A34", 0.45]} />
      <SunLight px={px} py={py} />
      <Ground xTD={p.xTD} />
      <Runway xTD={p.xTD} />
      <Clouds xTD={p.xTD} />
      <Debris t={t} p={p} />
      <group position={[px, py, 0]} rotation={[bank - slip * 0.3, slip * 0.45, glidePitch + noseDown + flare]}>
        <Plane767 spin={spin} rat={rat} ratSpin={t * 16} gear={gear} noseCollapse={noseCollapse} />
      </group>
      <CameraRig t={t} p={p} px={px} py={py} />
    </>
  );
};

// плёночное зерно и виньетка поверх 3D
const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width="100%" height="100%" style={{ position: "absolute", opacity: 0.035, mixBlendMode: "overlay" }}>
        <filter id="gr">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={frame % 30} />
        </filter>
        <rect width="100%" height="100%" filter="url(#gr)" />
      </svg>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.5) 100%)" }} />
    </AbsoluteFill>
  );
};

export const GimliReal: React.FC<ReconProps> = (props) => {
  setAccent(ACC, "en");
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const p = planOf(props.segments, props.total);
  const s = p.s;
  const f = (x: number) => Math.round(x * fps);
  const alt = altAt(t, p);
  const cta = props.segments[props.segments.length - 1].end + 0.2;
  return (
    <AbsoluteFill style={{ background: "#2A2236" }}>
      <ThreeCanvas width={width} height={height} shadows camera={{ fov: 46, near: 0.5, far: 30000, position: [-62, 314, 46] }}>
        <World t={t} p={p} />
      </ThreeCanvas>
      <Grain />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(8,8,12,0.5) 0%, rgba(8,8,12,0) 20%, rgba(8,8,12,0) 64%, rgba(8,8,12,0.7) 100%)" }} />
      <HUD alt={alt} warn={t > s[1] + 0.5 && t < s[2] + 0.5} t={t} />
      <Sequence from={f(s[2] + 0.2)} durationInFrames={f(s[3] - s[2] - 0.1)}>
        <FuelPanel />
      </Sequence>
      <Sequence from={f(s[4] + 0.2)} durationInFrames={f(s[5] - s[4] - 0.1)}>
        <MapPanel />
      </Sequence>
      <Sequence from={f(s[8])}>
        <EndTitle />
      </Sequence>
      <Captions words={props.words} until={cta + 3} />
      <Audio src={staticFile(`auto/${props.id}/voice.wav`)} />
      {props.music ? <Music src={props.music} /> : null}
      {(props.sfx ?? []).map((x, k) => (
        <Sequence key={`sfx${k}`} from={Math.max(0, f(x.at))} durationInFrames={f(1.3)}>
          <Audio src={staticFile(`sfx/${x.s}.wav`)} volume={x.v} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
