# Blind Spritz

A guessing game for fragrance people, in the style of the football-player guessing games. You see the hidden fragrance's note pyramid and a blurred photo of its bottle. You guess a fragrance, and each guess is compared with the answer on ten traits. When the round ends, the bottle comes into focus.

| Trait | Green | Gold | Arrow |
|---|---|---|---|
| Brand | same brand | same country and house type | |
| House | Designer / Niche / Arabian / Celebrity / Indie match | | |
| Gender | match | one of them is unisex | |
| Family | same main family | the family shows up in the answer's accords | |
| Year | same year | within 4 years | newer / older |
| Strength | same concentration | one step away (EDC → EDT → EDP → Parfum → Extrait) | stronger / weaker |
| Lasting | same longevity | one step away | ↑ ↓ |
| Sillage | same projection | one step away | ↑ ↓ |
| Hype | same popularity | one step away | ↑ ↓ |
| Notes | correct bottle | shares at least one note (shared notes light up on the strip) | |

## Modes

- **Easy**: the 49 most iconic bottles. Full pyramid plus accord bars, gender and house type. 10 guesses, 4 hints.
- **Medium**: the 98 popular bottles. Full pyramid only. 8 guesses, 3 hints.
- **Hard**: all 100. Two notes to start; every miss uncovers another note, and notes your guesses share with the answer are uncovered too. 6 guesses, 2 hints.

Filter by **All / Men / Women / Unisex** to play only one kind of bottle. Each mode has a **Daily** round (same bottle for everyone that day) and **Unlimited** practice. Hints you can spend: house type, gender, release decade, olfactive family, country, brand initial, and (hard) reveal a note. Stats, streaks and the share grid are saved in the browser.

The bottle blur is strongest on hard (34px), medium 24px, easy 16px.

## Run it

It's a static site with no build step. Open `index.html`, or serve the folder:

```
npx serve .
```

## Data and Fragrantica

`js/data.js` holds 100 bottles with Fragrantica-style top/heart/base pyramids. Each bottle has its Fragrantica image id; the game loads the photo from Fragrantica's image host (`fimgs.net/mdimg/perfume/375x500.<id>.jpg`), and every id was checked by eye against the right bottle. Lasting, sillage and hype are rounded approximations of Fragrantica community votes, so spot-check any you care about.

Fragrantica has no public API and sits behind Cloudflare, so the game doesn't call it live. To add or refresh bottles from it, run the fetch script on your own machine:

```
# urls.txt: one page per line, plus what the page doesn't state
https://www.fragrantica.com/perfume/Dior/Sauvage-31861.html house=D conc=EDT lon=4 sil=3 pop=5

node scripts/fetch-fragrantica.mjs urls.txt
```

It writes `js/data.extra.js`, which the game merges over the built-in list (same brand + name replaces, new ones are added). If Cloudflare serves a challenge page, save the perfume page from your browser and put the `.html` file path in `urls.txt` instead of the URL. Keep requests light and check Fragrantica's terms before scraping at volume.
