# Eilandrijk

Een rustige bouw- en puzzelgame voor de iPhone: leg tegels, upgrade gebouwen, vis in de baai en houd de Nevelrovers buiten.
Gebouwd met TypeScript + Vite, en als iPhone-app verpakt met Capacitor.

## Spelen in de browser (op elke computer)

```bash
npm install
npm run dev        # open de link die verschijnt, ook op je telefoon in hetzelfde wifi-netwerk
npm test           # test de spelregels
```

## Mappen

| Map | Wat erin staat |
| --- | --- |
| `src/game/` | Spelregels zonder schermcode: tegels, opbrengst, nachten, stormen, vissen. Alle balansgetallen staan in `config.ts`. |
| `src/main.ts` | Schermen: startmenu, spelbord, nacht- en visvensters. |
| `src/storage.ts` | Opslaan van het spel en het record (werkt op iPhone en in de browser). |
| `ios/` | Het Xcode-project voor de iPhone. |
| `tests/` | Tests van de spelregels. |

## De iPhone-app bouwen (op een Mac)

Nodig: een Mac met Xcode 16 of nieuwer en Node.js 20 of nieuwer.

1. `npm install`
2. `npm run ios:sync` (bouwt het spel en zet het in het Xcode-project)
3. `npm run ios:open` (opent Xcode)
4. Kies in Xcode bij **Signing & Capabilities** je Apple-account als Team.
5. Sluit een iPhone aan of kies een simulator en druk op de afspeelknop.

Voor de App Store is een Apple Developer-account nodig ($99 per jaar). Daarna: in Xcode **Product > Archive** en uploaden naar App Store Connect.
