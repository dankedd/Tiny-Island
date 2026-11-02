# Tiny Island

A calm island-building puzzle game for iPhone. Place tiles, upgrade buildings, go fishing and keep the Fog Pirates away.
Built with TypeScript + Vite and packaged as an iPhone app with Capacitor.

## Play in a browser (any computer)

```bash
npm install
npm run dev        # open the link it prints, also on a phone on the same wifi
npm test           # test the game rules
```

## Folders

| Folder | What is in it |
| --- | --- |
| `src/game/` | Game rules without any screen code: tiles, yields, nights, pirates, fishing. All balance numbers live in `config.ts`. |
| `src/main.ts` | Screens: start menu, board, night and fishing pop-ups. |
| `src/storage.ts` | Saves the game and best score (works on iPhone and in the browser). |
| `ios/` | The Xcode project for iPhone. |
| `src/art.ts` | All tile pictures, drawn as SVG in code. |
| `src/audio.ts` | All sounds and music, made live with Web Audio (no sound files needed). |
| `assets/` | App icon source (`icon.svg`) and the 1024px PNG. |
| `tests/` | Tests for the game rules. |

## Build the iPhone app (on a Mac)

You need a Mac with Xcode 16 or newer and Node.js 20 or newer.

1. `npm install`
2. `npm run ios:sync` (builds the game and copies it into the Xcode project)
3. `npm run ios:open` (opens Xcode)
4. In Xcode, under **Signing & Capabilities**, pick your Apple account as the Team.
5. Plug in an iPhone or pick a simulator and press the play button.

Publishing on the App Store needs an Apple Developer account ($99 per year). Then in Xcode use **Product > Archive** and upload to App Store Connect.
