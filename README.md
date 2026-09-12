# Hull Rush playable ad

A 20-second portrait playable built with TypeScript, Pixi.js, Three.js, Vite, and the production Hull Rush art assets.

- Drag to steer the ship.
- Make homing missiles collide with each other.
- Destroy 12 missiles or survive the timer to reach the end card.
- The CTA reads the standard `window.clickTag` value supplied by an ad network.

## Development

```sh
npm install
npm run dev
```

## Production build

```sh
npm run build
```

The output is `dist/index.html`. JavaScript and CSS are inlined into this one file for easy upload to playable-ad platforms. The fallback CTA URL in `src/main.ts` should be replaced before trafficking; networks that inject `window.clickTag` override it automatically.
