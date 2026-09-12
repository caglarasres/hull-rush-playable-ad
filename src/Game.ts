import { Application, Container, Graphics, Sprite, Text, TextStyle } from 'pixi.js';
import shipUrl from './assets/ship01.png';
import missileUrl from './assets/missile_normal.png';
import boltUrl from './assets/missile_bolt.png';
import heavyUrl from './assets/missile_heavy.png';
import explosionUrl from './assets/patlama.png';
import starUrl from './assets/star.png';

type Point = { x: number; y: number };
type Missile = { view: Container; trail: Graphics; x: number; y: number; vx: number; vy: number; angle: number; speed: number; alive: boolean };
type Burst = { view: Container; age: number; duration: number };

const COLORS = { cyan: 0x64f7ff, orange: 0xff5c29, yellow: 0xffdc57, ink: 0x061018, white: 0xf3feff };
const RUN_SECONDS = 20;
const GOAL = 12;

export class PlayableGame {
  private readonly world = new Container();
  private readonly fx = new Container();
  private readonly hud = new Container();
  private readonly ship = new Container();
  private readonly shipGlow = new Graphics();
  private readonly shipBody = Sprite.from(shipUrl);
  private readonly scoreText = this.text('0 / 12', 30, COLORS.white);
  private readonly timerText = this.text('20', 30, COLORS.white);
  private readonly livesText = this.text('◆ ◆ ◆', 18, COLORS.cyan);
  private readonly instruction = this.text('DRAG TO STEER', 30, COLORS.white);
  private readonly subInstruction = this.text('BAIT MISSILES INTO EACH OTHER', 16, COLORS.cyan);
  private readonly target: Point = { x: 0, y: 0 };
  private readonly velocity: Point = { x: 0, y: 0 };
  private missiles: Missile[] = [];
  private bursts: Burst[] = [];
  private elapsed = 0;
  private spawnClock = 0;
  private score = 0;
  private lives = 3;
  private started = false;
  private ended = false;
  private firstMove = false;
  private audio?: AudioContext;
  private soundOn = true;

  constructor(private readonly app: Application, private readonly onEnd: (score: number) => void) {
    app.stage.addChild(this.world, this.fx, this.hud);
    this.world.addChild(this.shipGlow, this.ship);
    this.ship.addChild(this.shipBody);
    this.drawShip();
    this.makeHud();
    this.resize();
    addEventListener('resize', this.resize);
    app.canvas.addEventListener('pointerdown', this.pointer);
    app.canvas.addEventListener('pointermove', this.pointer);
    app.ticker.add((ticker) => this.update(Math.min(ticker.deltaMS / 1000, 0.034)));
  }

  restart() {
    for (const missile of this.missiles) { missile.view.destroy({ children: true }); missile.trail.destroy(); }
    for (const burst of this.bursts) burst.view.destroy();
    this.missiles = [];
    this.bursts = [];
    this.elapsed = 0;
    this.spawnClock = 0;
    this.score = 0;
    this.lives = 3;
    this.started = false;
    this.ended = false;
    this.firstMove = false;
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.instruction.text = 'DRAG TO STEER';
    this.subInstruction.visible = true;
    this.instruction.visible = true;
    this.ship.visible = true;
    this.shipGlow.visible = true;
    this.resize();
    this.syncHud();
  }

  toggleSound() { this.soundOn = !this.soundOn; return this.soundOn; }

  private text(value: string, size: number, color: number) {
    return new Text({ text: value, style: new TextStyle({ fontFamily: 'Hull Display, Impact, sans-serif', fontSize: size, fontWeight: '800', fill: color, letterSpacing: 1.2 }) });
  }

  private drawShip() {
    this.shipGlow.clear().circle(0, 0, 38).fill({ color: COLORS.cyan, alpha: 0.09 });
    this.shipBody.anchor.set(0.5);
    this.shipBody.scale.set(0.44);
  }

  private makeHud() {
    const panel = new Graphics().roundRect(0, 0, 154, 54, 10).fill({ color: COLORS.ink, alpha: 0.72 }).stroke({ color: COLORS.cyan, alpha: 0.26, width: 1 });
    const scoreLabel = this.text('DESTROYED', 12, COLORS.cyan);
    scoreLabel.position.set(13, 6);
    this.scoreText.position.set(12, 19);
    panel.addChild(scoreLabel, this.scoreText);
    const star = Sprite.from(starUrl);
    star.anchor.set(0.5);
    star.scale.set(0.3);
    star.position.set(135, 27);
    panel.addChild(star);
    this.hud.addChild(panel);

    const timerPanel = new Graphics().roundRect(0, 0, 76, 54, 10).fill({ color: COLORS.ink, alpha: 0.72 }).stroke({ color: COLORS.orange, alpha: 0.35, width: 1 });
    const timeLabel = this.text('SECONDS', 11, COLORS.orange);
    timeLabel.anchor.set(0.5, 0);
    timeLabel.position.set(38, 6);
    this.timerText.anchor.set(0.5, 0);
    this.timerText.position.set(38, 19);
    timerPanel.addChild(timeLabel, this.timerText);
    this.hud.addChild(timerPanel);
    timerPanel.label = 'timer-panel';

    this.livesText.anchor.set(1, 0);
    this.hud.addChild(this.livesText);
    this.instruction.anchor.set(0.5);
    this.subInstruction.anchor.set(0.5);
    this.hud.addChild(this.instruction, this.subInstruction);
  }

  private readonly resize = () => {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const bottom = Math.max(70, h * 0.14);
    if (!this.started) {
      this.ship.position.set(w / 2, h - bottom);
      this.target.x = w / 2;
      this.target.y = h - bottom;
    }
    const panel = this.hud.children[0];
    panel?.position.set(16, 16);
    const timer = this.hud.getChildByLabel('timer-panel');
    timer?.position.set(w - 92, 16);
    this.livesText.position.set(w - 18, 80);
    this.instruction.position.set(w / 2, h * 0.22);
    this.subInstruction.position.set(w / 2, h * 0.22 + 36);
  };

  private readonly pointer = (event: PointerEvent) => {
    event.preventDefault();
    if (this.ended || (event.type === 'pointermove' && event.buttons === 0 && event.pointerType !== 'touch')) return;
    const bounds = this.app.canvas.getBoundingClientRect();
    this.target.x = (event.clientX - bounds.left) * this.app.screen.width / bounds.width;
    this.target.y = (event.clientY - bounds.top) * this.app.screen.height / bounds.height;
    if (!this.started) {
      this.started = true;
      this.initAudio();
      this.instruction.text = 'KEEP MOVING';
    }
    this.firstMove = true;
  };

  private update(dt: number) {
    if (this.ended) return;
    const timeScale = this.started ? 1 : 0.25;
    this.elapsed += dt * timeScale;
    this.moveShip(dt);
    if (this.started) {
      this.spawnClock -= dt;
      if (this.spawnClock <= 0) {
        this.spawnMissile();
        this.spawnClock = Math.max(0.42, 1.1 - this.elapsed * 0.023);
      }
    }
    this.moveMissiles(dt * timeScale);
    this.updateBursts(dt);
    if (this.firstMove && this.elapsed > 2.6) {
      this.instruction.visible = false;
      this.subInstruction.visible = false;
    }
    this.timerText.text = String(Math.max(0, Math.ceil(RUN_SECONDS - this.elapsed)));
    if (this.elapsed >= RUN_SECONDS || this.score >= GOAL) this.finish();
  }

  private moveShip(dt: number) {
    const dx = this.target.x - this.ship.x;
    const dy = this.target.y - this.ship.y;
    const len = Math.hypot(dx, dy) || 1;
    const speed = Math.min(560, len * 7);
    const desiredX = dx / len * speed;
    const desiredY = dy / len * speed;
    const blend = 1 - Math.exp(-dt * 10);
    this.velocity.x += (desiredX - this.velocity.x) * blend;
    this.velocity.y += (desiredY - this.velocity.y) * blend;
    this.ship.x += this.velocity.x * dt;
    this.ship.y += this.velocity.y * dt;
    const pad = 30;
    this.ship.x = Math.max(pad, Math.min(this.app.screen.width - pad, this.ship.x));
    this.ship.y = Math.max(110, Math.min(this.app.screen.height - pad, this.ship.y));
    const targetRotation = Math.atan2(this.velocity.y, this.velocity.x);
    this.ship.rotation += this.angleDelta(this.ship.rotation, targetRotation) * Math.min(1, dt * 9);
    this.shipGlow.position.copyFrom(this.ship.position);
    this.shipGlow.alpha = 0.72 + Math.sin(performance.now() * 0.01) * 0.18;
  }

  private spawnMissile() {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const side = Math.floor(Math.random() * 3);
    const x = side === 0 ? -32 : side === 1 ? w + 32 : Math.random() * w;
    const y = side === 2 ? -32 : 110 + Math.random() * Math.max(80, h - 230);
    const angle = Math.atan2(this.ship.y - y, this.ship.x - x);
    const view = new Container();
    const glow = new Graphics().circle(0, 0, 22).fill({ color: COLORS.orange, alpha: 0.12 });
    const missileArt = [missileUrl, boltUrl, heavyUrl][Math.floor(Math.random() * 3)] ?? missileUrl;
    const body = Sprite.from(missileArt);
    body.anchor.set(0.5);
    body.scale.set(missileArt === heavyUrl ? 0.48 : 0.43);
    view.addChild(glow, body);
    view.position.set(x, y);
    view.rotation = angle;
    const trail = new Graphics();
    this.fx.addChild(trail);
    this.world.addChild(view);
    const speed = 175 + Math.min(75, this.elapsed * 4) + Math.random() * 35;
    this.missiles.push({ view, trail, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, angle, speed, alive: true });
    this.tone(110, 0.04, 0.025);
  }

  private moveMissiles(dt: number) {
    for (const missile of this.missiles) {
      if (!missile.alive) continue;
      const desired = Math.atan2(this.ship.y - missile.y, this.ship.x - missile.x);
      const maxTurn = 1.75 * dt;
      missile.angle += Math.max(-maxTurn, Math.min(maxTurn, this.angleDelta(missile.angle, desired)));
      missile.vx = Math.cos(missile.angle) * missile.speed;
      missile.vy = Math.sin(missile.angle) * missile.speed;
      missile.x += missile.vx * dt;
      missile.y += missile.vy * dt;
      missile.view.position.set(missile.x, missile.y);
      missile.view.rotation = missile.angle;
      missile.trail.clear().moveTo(missile.x, missile.y).lineTo(missile.x - Math.cos(missile.angle) * 38, missile.y - Math.sin(missile.angle) * 38).stroke({ color: COLORS.orange, alpha: 0.45, width: 5 });
    }

    for (let i = 0; i < this.missiles.length; i++) {
      const a = this.missiles[i];
      if (!a?.alive) continue;
      if (Math.hypot(a.x - this.ship.x, a.y - this.ship.y) < 24) {
        this.explode(a.x, a.y, false);
        a.alive = false;
        a.view.visible = false;
        a.trail.visible = false;
        this.lives--;
        this.syncHud();
        this.tone(75, 0.18, 0.12);
        if (this.lives <= 0) this.finish();
        continue;
      }
      for (let j = i + 1; j < this.missiles.length; j++) {
        const b = this.missiles[j];
        if (!b?.alive || Math.hypot(a.x - b.x, a.y - b.y) >= 28) continue;
        a.alive = b.alive = false;
        a.view.visible = b.view.visible = false;
        a.trail.visible = b.trail.visible = false;
        this.score += 2;
        this.explode((a.x + b.x) / 2, (a.y + b.y) / 2, true);
        this.syncHud();
        this.tone(48, 0.2, 0.15);
        break;
      }
    }

    const margin = 140;
    for (const m of this.missiles) {
      if (m.x < -margin || m.x > this.app.screen.width + margin || m.y < -margin || m.y > this.app.screen.height + margin) {
        m.alive = false; m.view.visible = false; m.trail.visible = false;
      }
    }
    if (this.missiles.length > 50) {
      const removed = this.missiles.splice(0, 15);
      for (const m of removed) { m.view.destroy({ children: true }); m.trail.destroy(); }
    }
  }

  private explode(x: number, y: number, scored: boolean) {
    const burst = new Container();
    burst.position.set(x, y);
    const art = Sprite.from(explosionUrl);
    art.anchor.set(0.5);
    art.scale.set(scored ? 0.48 : 0.4);
    burst.addChild(art);
    const sparks = new Graphics();
    for (let i = 0; i < 16; i++) {
      const angle = i / 16 * Math.PI * 2;
      const length = 20 + Math.random() * 35;
      sparks.moveTo(Math.cos(angle) * 5, Math.sin(angle) * 5).lineTo(Math.cos(angle) * length, Math.sin(angle) * length).stroke({ color: i % 2 ? COLORS.orange : COLORS.yellow, width: 2 + Math.random() * 3, alpha: 0.9 });
    }
    burst.addChild(sparks);
    this.fx.addChild(burst);
    this.bursts.push({ view: burst, age: 0, duration: 0.52 });
  }

  private updateBursts(dt: number) {
    for (const burst of this.bursts) {
      burst.age += dt;
      burst.view.scale.set(1 + burst.age * 2.4);
      burst.view.alpha = Math.max(0, 1 - burst.age / burst.duration);
    }
    const done = this.bursts.filter((burst) => burst.age >= burst.duration);
    this.bursts = this.bursts.filter((burst) => burst.age < burst.duration);
    for (const burst of done) burst.view.destroy();
  }

  private syncHud() {
    this.scoreText.text = `${this.score} / ${GOAL}`;
    this.livesText.text = Array.from({ length: Math.max(0, this.lives) }, () => '◆').join(' ');
  }

  private finish() {
    if (this.ended) return;
    this.ended = true;
    this.ship.visible = false;
    this.shipGlow.visible = false;
    this.explode(this.ship.x, this.ship.y, false);
    setTimeout(() => this.onEnd(this.score), 650);
  }

  private angleDelta(from: number, to: number) {
    return Math.atan2(Math.sin(to - from), Math.cos(to - from));
  }

  private initAudio() {
    if (!this.audio) this.audio = new AudioContext();
    void this.audio.resume();
  }

  private tone(frequency: number, duration: number, volume: number) {
    if (!this.soundOn || !this.audio) return;
    const osc = this.audio.createOscillator();
    const gain = this.audio.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(frequency, this.audio.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, frequency * 0.55), this.audio.currentTime + duration);
    gain.gain.setValueAtTime(volume, this.audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audio.currentTime + duration);
    osc.connect(gain).connect(this.audio.destination);
    osc.start();
    osc.stop(this.audio.currentTime + duration);
  }
}
