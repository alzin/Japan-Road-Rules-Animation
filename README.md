# Japan Road Rules

An interactive 3D guide to the rules of the road in Japan — keep left, 止まれ stop
signs, crosswalk priority, railway crossings, expressways, alcohol, phones,
bicycles and more. Every rule is shown as a small animated scene you can scrub
through, alongside the penalty points and the article of the Road Traffic Act it
comes from.

**[▶ Open the guide](https://alzin.github.io/japan-road-rules/)**

Bilingual: English / 日本語.

## Chapters

| # | Chapter | # | Chapter |
|---|---|---|---|
| 1 | Keep left | 9 | Night driving |
| 2 | Speed limits | 10 | Alcohol |
| 3 | Stop means stop (止まれ) | 11 | Phones and seatbelts |
| 4 | Pedestrians first | 12 | Expressways |
| 5 | Signals and turns | 13 | Roundabouts |
| 6 | Who goes first | 14 | Sharing with bicycles |
| 7 | Railway crossings | 15 | Following distance and road rage |
| 8 | Emergency vehicles | 16 | Marks and manners |

Plus a driver-marks reference (wakaba, kōreisha and friends), a guide to the
lines painted on the road, a penalty-points table, a timeline of recent rule
changes, and a quiz to check what stuck.

## Running it locally

It is a single self-contained HTML file — no build step, no dependencies to
install. Open `index.html` in a browser, or serve the folder if you prefer:

```bash
python -m http.server 8000
```

Then visit <http://localhost:8000>.

The page pulls [three.js](https://threejs.org/) r128 from cdnjs and two fonts
from Google Fonts, so the 3D scenes need an internet connection the first time.

## Contributing

Issues and pull requests are welcome — especially corrections to the rules,
penalties, or Japanese wording. All the content lives in `index.html`.

## Disclaimer

This is an educational project, not legal advice. Rules and penalties change;
always check the current text of the 道路交通法 (Road Traffic Act) and your local
prefectural police guidance before relying on anything here.

## License

[MIT](LICENSE) © Mohamad Ghaith Alzin
