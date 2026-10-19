# Matrix bench

A browser simulator for a 32×32 RGB LED matrix. The registered projects are [pacmanclock](https://github.com/clogwog/pacmanclock), [pongclock](https://github.com/clogwog/pongclock), and [matrixclock](https://github.com/clogwog/matrixclock). The page loads each program’s C++ and runs it on a virtual panel of round, glowing pixels. Clocks use this computer’s local time.

![Pac-Man Clock at 14:35](docs/preview/pacmanclock-1435.png)

![Same clock a moment later, after Pac-Man has stepped](docs/preview/pacmanclock-1435-chomp.png)

![Pong Clock at 14:35](docs/preview/pongclock-1435.png)

![Matrix Clock at 14:35, rain crossing the digits](docs/preview/matrixclock-1435.png)

![Tetris Clock at 14:35, pieces still falling](docs/preview/tetrisclock-1435.png)

## Run it

The site is static. ES modules will not load from a `file://` URL, so use a local static server from the repo root:

```bash
npm start
```

Then open `http://127.0.0.1:8080/`. `npm start` is `python3 -m http.server 8080`. Any other static server works the same way. Asset URLs are relative (`css/app.css`, `src/main.js`, and the loaders’ `import.meta.url` fetches), so the same tree also works under a subpath such as `https://clogwog.net/projects/panel-player/`.

The page reads a `project` query parameter. These open a project directly:

- `?project=pacmanclock`
- `?project=pongclock`
- `?project=matrixclock`
- `?project=tetrisclock`

A missing or unknown value starts Pac-Man Clock, the same project as a visit with no query. Other parameters stay on the URL. The first load uses `history.replaceState` so the address names the running project. Choosing an icon uses `history.pushState`, which keeps the link shareable and lets Back return to the previous project. The path is whatever page you opened, including `/projects/panel-player/`.

Those URLs carry `?v=` from `BUILD_VERSION` in `src/version.js` (the CSS link, every relative module import, and each fetched `.cc`, `.h`, and `.bdf`). A CDN that keeps brotli for days then fetches the new file instead of the previous one. After changing `BUILD_VERSION`, run `node scripts/stamp-version.js` so the query strings match the constant. `npm test` checks that they do. Node strips the query while resolving modules; browsers keep it as a cache key.

```bash
python3 -m http.server 8080
```

There is no build step. Nothing here drives a physical HAT or a Raspberry Pi. GPIO, syslog, and `SwapOnVSync` are host stubs; the visible panel is the browser canvas.

## Tests

Node’s built-in test runner is enough. No extra packages.

```bash
npm test
```

The tests cover the preprocessor (digit macros, include guards), a small interpreted drawing program (integer division, reference parameters, `SetPixel`), default arguments and in-class initializers, the `?project=` parser (the three ids, unknown values, and a subpath that keeps its other parameters), pacmanclock (parsed colours, the 3×5 digit tables, the right-facing mouth sprite, a 14:35 frame, and movement after the 80&nbsp;ms step), pongclock (a 14:35 frame with BDF digits, centre dashes, the second-hand row, paddles, and a ball that moves on the next `usleep`), matrixclock (digits still 0 for 14 frames, then 14:35 on the 15th, with the rain moving and a full-green mask pixel once a streak crosses a digit), and tetrisclock (17 grey second-frame pixels at 14:35:08, then falling tetrominoes that land on later frames).

Regenerate the README pictures with:

```bash
npm run preview
```

## GitHub Pages

`.github/workflows/pages.yml` publishes `index.html`, `css/`, and `src/` to GitHub Pages on pushes to `main`. Turn on Pages with the source set to **GitHub Actions**. The preview appears after that workflow runs on `main`; a pull request does not deploy by itself.

## Layout

| Path | Role |
| --- | --- |
| `src/cpp/` | Preprocessor, parser, and interpreter for the C++ subset |
| `src/matrix/` | Shared `VirtualMatrix`, local clock, and bitmap font |
| `src/render/panel-view.js` | 32×32 glowing-dot canvas |
| `src/projects/registry.js` | Project list behind the icon grid |
| `src/projects/url.js` | `?project=` parsing and shareable URLs |
| `css/thumbs/` | Square LED previews for the project icons |
| `src/projects/pacmanclock/` | Vendored Pac-Man Clock sources, system stubs, adapter |
| `src/projects/pongclock/` | Vendored Pong Clock sources, font, system stubs, adapter |
| `src/projects/matrixclock/` | Vendored Matrix Clock sources, digit masks, font, system stubs, adapter |
| `src/projects/tetrisclock/` | Vendored Tetris Clock sources, piece tables, system stubs, adapter |
| `src/matrix/bdf.js` | BDF loader used by the Pong Clock host `DrawText` |
| `index.html` | The bench UI |

`VirtualMatrix` is the shared pixel buffer (`SetPixel`, `Clear`, `Fill`). `createClock()` is the shared time source (`time`, `localtime`, `gettimeofday`). `BitmapFont` is the shared glyph drawer for a future project written in JavaScript. Pac-Man Clock does not call `BitmapFont`; its digits are the `bool` tables in `digit.cc`, drawn by the interpreted `Digit::hittest`. Pong Clock’s digits come from `pongnumberfont.bdf` through the host `rgb_matrix::DrawText`. Matrix Clock loads that same BDF so `main` continues, and draws its digits from the `bool` masks in `number.cc`.

## Adding a project

1. Create `src/projects/<id>/adapter.js` exporting an object with `id`, `title`, `description`, and `async start(host)`. `repo`, `shows`, and `thumb` fill the sidebar link, the hover card, and the icon (`thumb` is a page-relative path such as `css/thumbs/<id>.png`).
2. Register it in the array inside `src/projects/registry.js`. The id is also the `?project=` value.
3. From `start`, call `host.onFrame(frame)` with `{ width, height, pixels, brightness }`. `pixels` is a `Uint8ClampedArray` of packed RGB, length `width * height * 3`, row-major, origin at the top left.
4. Use `host.clock.now()` for wall time, `host.schedule` / `host.cancel` to pace frames, and `host.paused()` if the bench pause button should freeze the sim.

`host` is the bench, not a matrix driver. A project can draw with `VirtualMatrix` directly, or it can compile C++ through `compileSources` and `createSession` when the source stays inside the subset below.

```javascript
import { VirtualMatrix } from "../../matrix/virtual-matrix.js";
import { MatrixProject } from "../project.js";

export class SolidProject extends MatrixProject
{
    constructor()
    {
        super({
            id: "solid",
            title: "Solid",
            description: "One lit pixel so the registry has a second entry."
        });
    }

    async start(host)
    {
        const matrix = new VirtualMatrix(32, 32);
        let timer = 0;
        let stopped = false;
        const tick = function ()
        {
            if (stopped || (host.paused && host.paused()))
            {
                timer = host.schedule(tick);
                return;
            }
            matrix.clear();
            matrix.setPixel(1, 1, 255, 220, 0);
            host.onFrame(matrix.snapshot());
            timer = host.schedule(tick);
        };
        timer = host.schedule(tick);
        return {
            stop()
            {
                stopped = true;
                host.cancel(timer);
            }
        };
    }
}
```

To reuse the interpreter, put the `.cc` sources and any stub headers in that project folder, build a `Map` of filename to text (see `load.js`), and pass the entry files to `compileSources`. `createSession(program, { clock, files }).step(nowMs)` runs until the next frame. Pac-Man Clock yields at `SwapOnVSync`. Pong Clock and Matrix Clock yield at `usleep`. Pass the same file map as `files` when the program calls `LoadFont` on a path such as `./pongnumberfont.bdf`.

## Interpreter trade-off

pacmanclock is ordinary C++: globals, a couple of classes, 2D `bool` tables, `vector`, `rand`, and `Canvas::SetPixel`. It does not use the RGB-matrix font renderer. Two ways to show it:

- **Hand-port the maze and the sprite to JavaScript.** Faster and easier to debug. The port is a second program, and it drifts the moment the C++ changes.
- **Interpret a C++ subset and execute the vendored sources.** The maze rules, colours, glyph tables, chomp timing, and `main` loop stay in `pacmanclock.cc` and `digit.cc`. The cost is a bespoke engine and a frame time around 20&nbsp;ms in Node, which is enough for the 80&nbsp;ms step but is not a general C++ compiler.

This repo takes the second path. Hardware from [rpi-rgb-led-matrix](https://github.com/hzeller/rpi-rgb-led-matrix) is not interpreted. Those headers in upstream are GPL-2; this tree replaces them with empty stubs and implements `SetPixel`, `Clear`, `CreateFrameCanvas`, and `SwapOnVSync` on `VirtualMatrix`. Pac-Man Clock publishes a frame at `SwapOnVSync`. Pong Clock and Matrix Clock draw on the `RGBMatrix` itself, so `usleep` publishes the live canvas. The host also implements the BDF slice of `Font::LoadFont`, `Font::baseline`, and `DrawText` that Pong Clock calls. Matrix Clock only needs `LoadFont` to succeed. The library sources are not vendored.

`rand` is a small 15-bit LCG, not glibc’s generator, so two runs with the same seed still will not match a Pi binary. `RAND_MAX` in the Pong Clock and Matrix Clock stubs is 32767 so it matches that generator. `srand(time(NULL))` is honoured, so each visit gets a new maze, a new ball, or a new set of streaks.

## What pacmanclock does here

Interpreted from the current upstream sources:

- 5×5 randomised DFS maze, plus the extra random edges
- Blue wall outline around corridor cells
- Pellets at cell centres and open midpoints
- 2×2 power pellets on the four corner cells
- Rainbow pellet flash for 0.35&nbsp;s after a power pellet
- 5×5 Pac-Man, directional mouth, chomp each step, no-backtrack wandering
- New maze when every pellet is gone
- White HH:MM, 3×5 digits from `digit.cc`, colon at (15, 2) and (15, 4)
- Step about every 80&nbsp;ms of wall time
- Local hour and minute (`localtime`), 24-hour

The picker is the registry. Pac-Man Clock, Pong Clock, Matrix Clock, and Tetris Clock are registered.

## What pongclock does here

Interpreted from the current upstream sources:

- Left paddle at column 0 and right paddle at column 30, each a short vertical pair of lines
- Ball with a random start and direction, bouncing off the top and bottom
- Paddles track the ball, and deliberately miss when the hour or minute is due to change
- Hour and minute as two digits from `pongnumberfont.bdf`, grey `(100,100,100)`, hour at x=4 and minute at x=16
- Old digits are redrawn in black when that side scores
- Dashed centre line at x=15, colour `(10,10,10)`
- Second hand: a normal distribution along y=31, colour shifting from aqua toward orange by the hour
- One physics step per `usleep(25000)`. The bench waits about 25&nbsp;ms of wall time between steps
- Local time (`localtime` / `gettimeofday`), 24-hour, with a leading zero

## What matrixclock does here

Interpreted from the current upstream sources:

- Falling streaks, at most four in each of the 32 columns
- A new streak in column `t` when that column has room and `t == rand() % 64`
- Random height from 3 to 15, speed from 0.1 to 0.5, and a per-row strength from 50 to 89
- Body pixels fade green `(70, 170, 24)` toward black by that strength. The head fades white `(170, 170, 170)` the same way
- The cell just behind a streak is cleared
- Four 8×16 digit masks from `number.cc`, at x = 0, 8, 17, and 25, y = 9
- A mask cell that a streak crosses is drawn in the full green
- Digits stay 0 until the 15th frame, then follow the local hour and minute, and refresh every 15 frames after that
- `LoadFont("./pongnumberfont.bdf")` has to succeed. Nothing draws with that font
- One frame per `usleep(25000)`. The bench waits about 25&nbsp;ms between steps
- `shared_ptr<Rune>` is the `Rune` object itself, held in `vector<shared_ptr<Rune>> runes[32]`

## What tetrisclock does here

Interpreted from the current upstream sources:

- The time string `"HHMM"` is handed to `setText`. Each character is a falling tetromino sequence from `TetrisLetters.h`
- Pieces drop one row per frame, rotate on the way down, and stay where `y_stop` says
- Colours are the nine tetris colours scaled by `brightness` 0.2, so a full channel is 51
- A dim grey `(16,16,16)` second frame walks the border. At 14:35:08 that is 17 pixels, starting at the top from x=16
- One frame per `usleep(125000)`. The bench waits about 125&nbsp;ms between steps
- `drawNumbers` and the colon are in the library and are not called from `main`
- Added to the subset for this clock: `typedef struct { ... } Name`, a constructor initializer `field(arg)`, `string` addition, `substr`, and `string[i]` as a character code. Default arguments on the declaration stay when the out-of-line definition leaves them off. An `int` initializer truncates

## What is not simulated

- A general template system. The subset knows `vector<T>`, `shared_ptr<T>` as the object itself (no control block or `use_count`), `make_shared<T>(...)`, and `vector::begin` / `erase` combined with iterator `+`. A `>>` token can close two template argument lists
- Inheritance, virtual calls, exceptions, lambdas, operator overloading, namespaces as scopes
- Preprocessor tricks beyond object-like macros, simple function-like macros, includes, and include guards. `#if` only handles `0`, `1`, and `defined`
- References other than reference parameters and `for (auto& x : vec)`
- Pointer arithmetic, arrays above 2D, and most of the standard library
- In-class fixed arrays are allocated. A read past the end of a plain array returns 0, and a write past the end is ignored. `vector` still throws. Matrix Clock indexes `localstrength[32]` once a streak’s head is past the last row; that y is already off the panel
- `cout` / `operator<<` (the font-failure branch parses, and is not taken when the BDF loads)
- The rest of `graphics.cc` beyond `LoadFont`, `baseline`, and the 6-argument `DrawText` (ink pixels only, no background colour). Matrix Clock and Tetris Clock never call `DrawText`. Tetris Clock’s `drawChar` mentions a `Font*` that `main` never sets
- `thematrix.gif` from upstream (about 14&nbsp;MB). Matrix Clock does not open it. Tetris Clock’s README points at a remote gif; that file is not in the repo
- `scale` above 1 and `drawLargerShape`. Tetris Clock leaves `scale` at 1
- PWM, hardware pulsing, multi-panel chains beyond `width = cols * chain_length`, and brightness applied inside `SetPixel`. Pac-Man Clock sets driver brightness to 50. Pong Clock, Matrix Clock, and Tetris Clock leave it at 100. Tetris Clock additionally scales its own colours by 0.2. The bench shows the raw pixel values and prints the driver setting beside the panel
- Signals, syslog output, and a GPIO init failure. `interrupt_received` stays false, so the loops run until you leave the page
- A real `usleep` delay inside the interpreter. The bench paces Pong Clock and Matrix Clock at 25&nbsp;ms per frame and Tetris Clock at 125&nbsp;ms, and does not catch up if a frame is late
- `strcpy` into the unused `line[6]` buffer is implemented, and nothing reads that buffer
- The optional `<seconds>` quit timer, unless a host passes `argc` / `argv`. The bench passes `argc == 1`
- Catch-up if a Pac-Man frame is late: the C++ steps at most once per refresh, and the interpreter does the same

## Sources

`src/projects/pacmanclock/sources/pacmanclock.cc`, `digit.cc`, and `digit.h` are the app sources from [clogwog/pacmanclock](https://github.com/clogwog/pacmanclock) at `d8c3611d10ceb1dd1803e91cadfbdf1be35a6fef`. Upstream has no license file.

`src/projects/pongclock/sources/pongclock.cc` and `pongnumberfont.bdf` are from [clogwog/pongclock](https://github.com/clogwog/pongclock) at `ee2549e077be6f9f7ad70ba120809dcf9824fc33`. The font file says it is public domain. The RGB-matrix library itself is not vendored.

`src/projects/matrixclock/sources/matrixclock.cc`, `number.cc`, `number.h`, and `pongnumberfont.bdf` are from [clogwog/matrixclock](https://github.com/clogwog/matrixclock) at `db376ca4e62ee836c096d4a1604f6042937e55df`. Upstream’s `thematrix.gif` is not included. The RGB-matrix library itself is not vendored.

`src/projects/tetrisclock/sources/tetrisclock.cpp`, `TetrisMatrixDraw.cpp`, `TetrisMatrixDraw.h`, `TetrisNumbers.h`, and `TetrisLetters.h` are from [clogwog/tetrisclock](https://github.com/clogwog/tetrisclock) at `706b526468e9ce17cfddedb0a25e2b69552aab10`. The piece tables are the font. `TetrisMatrixDraw` carries Tobias Blum’s LGPL-2.1 header. The RGB-matrix library itself is not vendored.
