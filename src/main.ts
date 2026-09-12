import { Application, Assets } from 'pixi.js';
import shipUrl from './assets/ship01.png';
import missileUrl from './assets/missile_normal.png';
import boltUrl from './assets/missile_bolt.png';
import heavyUrl from './assets/missile_heavy.png';
import explosionUrl from './assets/patlama.png';
import starUrl from './assets/star.png';
import { SpaceBackdrop } from './SpaceBackdrop';
import { PlayableGame } from './Game';
import './style.css';

declare global { interface Window { clickTag?: string } }

async function bootstrap() {
  const threeHost = document.querySelector<HTMLElement>('#three-layer');
  const pixiHost = document.querySelector<HTMLElement>('#pixi-layer');
  const endCard = document.querySelector<HTMLElement>('#end-card');
  const result = document.querySelector<HTMLElement>('#result');
  const cta = document.querySelector<HTMLButtonElement>('#cta');
  const replay = document.querySelector<HTMLButtonElement>('#replay');
  const sound = document.querySelector<HTMLButtonElement>('#sound');

  if (!threeHost || !pixiHost || !endCard || !result || !cta || !replay || !sound) throw new Error('Playable ad shell is incomplete.');

  new SpaceBackdrop(threeHost);
  const app = new Application();
  await app.init({ resizeTo: window, backgroundAlpha: 0, antialias: true, resolution: Math.min(devicePixelRatio, 2), autoDensity: true });
  pixiHost.appendChild(app.canvas);
  await Assets.load([shipUrl, missileUrl, boltUrl, heavyUrl, explosionUrl, starUrl]);

  const game = new PlayableGame(app, (score) => {
    result.textContent = score >= 12 ? `ACE PILOT · ${score} MISSILES DESTROYED` : `YOU DESTROYED ${score} MISSILES`;
    endCard.classList.add('show');
  });

  const openStore = () => {
    const target = window.clickTag || 'https://example.com/hull-rush';
    window.open(target, '_blank', 'noopener,noreferrer');
  };

  cta.addEventListener('click', openStore);
  replay.addEventListener('click', () => {
    endCard.classList.remove('show');
    game.restart();
  });
  sound.addEventListener('click', () => {
    const enabled = game.toggleSound();
    sound.textContent = enabled ? '♪' : '×';
    sound.setAttribute('aria-label', enabled ? 'Mute sound' : 'Enable sound');
  });
}

void bootstrap();
