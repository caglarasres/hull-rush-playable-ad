import * as THREE from 'three';

export class SpaceBackdrop {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(62, 1, 0.1, 100);
  private readonly stars: THREE.Points;
  private readonly clock = new THREE.Clock();

  constructor(host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ alpha: false, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setClearColor(0x02040b, 1);
    host.appendChild(this.renderer.domElement);

    const count = innerWidth < 600 ? 650 : 1_100;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const p = i * 3;
      positions[p] = (Math.random() - 0.5) * 32;
      positions[p + 1] = (Math.random() - 0.5) * 42;
      positions[p + 2] = -Math.random() * 32;
      const blue = 0.65 + Math.random() * 0.35;
      colors[p] = 0.3 + Math.random() * 0.45;
      colors[p + 1] = blue;
      colors[p + 2] = 1;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.stars = new THREE.Points(geometry, new THREE.PointsMaterial({ size: 0.052, vertexColors: true, transparent: true, opacity: 0.9 }));
    this.scene.add(this.stars);

    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 22),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { color: { value: new THREE.Color(0x07384a) } },
        vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
        fragmentShader: 'uniform vec3 color; varying vec2 vUv; void main(){float d=distance(vUv,vec2(.5));float a=smoothstep(.5,0.,d)*.5;gl_FragColor=vec4(color,a);}',
      }),
    );
    glow.position.set(-4, 3, -14);
    this.scene.add(glow);
    this.camera.position.z = 5;
    this.resize();
    addEventListener('resize', this.resize);
    this.render();
  }

  private readonly resize = () => {
    const width = innerWidth;
    const height = innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };

  private readonly render = () => {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const positions = this.stars.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < positions.count; i++) {
      let y = positions.getY(i) + dt * (0.8 + (i % 7) * 0.08);
      if (y > 20) y = -20;
      positions.setY(i, y);
    }
    positions.needsUpdate = true;
    this.stars.rotation.z = Math.sin(performance.now() * 0.00012) * 0.04;
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.render);
  };
}
