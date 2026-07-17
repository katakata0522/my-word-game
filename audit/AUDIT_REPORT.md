# Comprehensive repository audit

- Files: **4**
- Bytes: **21,787**
- Findings: CRITICAL 0, HIGH 6, MEDIUM 0, LOW 0

## Syntax checks

- PASS `game_ver2.js` (JS)

## Findings

- **HIGH · broken-reference** `index.html:263` — Missing local audio src: bgm.mp3
- **HIGH · broken-reference** `index.html:266` — Missing local audio src: correct.mp3
- **HIGH · broken-reference** `index.html:267` — Missing local audio src: wrong.mp3
- **HIGH · broken-reference** `index.html:268` — Missing local audio src: win.mp3
- **HIGH · broken-reference** `index.html:269` — Missing local audio src: lose.mp3
- **HIGH · broken-reference** `index.html:270` — Missing local audio src: hint.mp3

## Structure

- Workflows: none
- Manifests: none
- Tests: none
- Backup-like paths: 0
- Tracked but ignored: none
- Duplicate file groups: 0

## Largest files

- `game_ver2.js` — 11,941 bytes, 330 lines
- `index.html` — 9,734 bytes, 277 lines
- `.gitattributes` — 66 bytes, 3 lines
- `README.md` — 46 bytes, 6 lines

## Limitations

- Pattern matches require manual validation.
- Static audit does not exercise production networking, visual layout, or every user interaction.
