# FRAKKERA RUN – How the map graphics work

There are no image files for the map. The whole village (sky, street, houses, banners,
gardens, obstacles, particles) is built in code with Three.js when the game starts.
To change how the map looks, you edit a few JavaScript files, and the browser updates live.

## Run it on your Mac
1. Install Node.js (https://nodejs.org, LTS version).
2. In Terminal, inside this folder: `npm install` then `npm run dev`
3. Open the address it prints (http://localhost:5173). Every time you save a file, the game reloads.
4. When you're happy: `npm run build` creates the `dist/` folder, which is what goes online.

## Where to change things (easiest first)

### 1. Colours of the village – `src/game/models.js`, top of the file, `PAL`
- `plaster`: house wall colours (one is picked at random per house)
- `stone`, `roof`, `shutter` (window shutters), `door`, `glass`, `lit` (lit windows)
- `leaf`, `flower`: plants and flower boxes
Just change the hex codes (e.g. `'#efcf9f'`). Add or remove entries to get more or less variety.

### 2. Sky, light and fog – `src/game/world3d.js`, `MOODS` (around line 24)
Three moods: `menu` (dusk), `run` (sunset, during play), `over` (night, game over).
- `top`, `mid`, `hor`: sky gradient from top to horizon
- `fog`, `fogNear`, `fogFar`: fog colour and distance (smaller numbers = thicker fog)
- `hemiS` / `hemiG` / `hemiI`: sky light colour, ground light colour, strength
- `dirC` / `dirI`: sun colour and strength
- `sun`, `moon`: 0 or 1, whether they are visible
- `far`: tint of the far mountains

### 3. Street size – `src/game/world3d.js`, top
- `ROAD_W` (road width, metres), `WALK_W` (sidewalk width), `FAR_Z` (how far you can see)
Careful: the lanes are tied to gameplay, so change the road width only a little.

### 4. Ground textures – `src/game/tex3d.js`
Textures drawn with code on a canvas:
- `cobbleTexture()`: the cobblestone street
- `slabTexture()`: sidewalk slabs
- `staveTexture()` / `lidTexture()`: wine barrel wood and lid
- `carpetTexture()`: the Sa Burra carpets
Here you can change colours, stone size, line thickness, and so on.
You can also replace one with a real photo/texture: put the image in `public/textures/`
and load it with `new THREE.TextureLoader().load('./textures/your-file.jpg')`.

### 5. The objects – `src/game/models.js`
Each object has a function:
- `buildHouse(seed)`: houses (windows, balconies, flower boxes, lanterns, roof)
- `buildGarden`, `buildBanner` (festival banners across the street), `buildStoneWall`
- `buildGoat`, `buildAsphodel`, `buildFerula` (plants/obstacles), `buildPistol`
- `barrelGeometry`: wine barrel shape
- `buildNarrow`: narrow alley sections
- `buildFar`: the far mountains/skyline
Sizes are in metres. `k.add(G.box(w, h, d), colour, { x, y, z })` adds a box, and the other shapes work the same way.

### 6. How the village is assembled – `src/game/world3d.js`
- `buildVillage()`: how many house variants (18), gardens (5), banners (4)
- `buildGround()`: street and sidewalks
- `buildSky()`: sky dome, sun, moon, mountains
- `buildLights()`: lights
- `COL` (around line 48): particle colours (sparks, smoke, wine splash, wood pieces, carpet confetti)

### 7. Using real 3D models instead of code
You can model houses or props in Blender, export them as `.glb` into `public/models/`,
and load them the same way the character is loaded (see `src/game/character3d.js`, GLTFLoader).
Send them to me and I can wire them in.

## Folders
- `reference/` – the reference images used so far
- `screenshots/` – how v4 looks now (mobile and desktop)
- `public/models/frakkera-man.glb` – the 3D character
- `blender/` – the script that builds the character in Blender

When you've made changes, send me the folder (or just the files you touched) and I'll test,
build and publish it to a test link for you.
