# Matrix bench

A browser simulator for a 32×32 RGB LED matrix. The registered projects are [pacmanclock](https://github.com/clogwog/pacmanclock) and [pongclock](https://github.com/clogwog/pongclock). The page loads each program’s C++ and runs it on a virtual panel of round, glowing pixels. Clocks use this computer’s local time.

![Pac-Man Clock at 14:35](docs/preview/pacmanclock-1435.png)

![Same clock a moment later, after Pac-Man has stepped](docs/preview/pacmanclock-1435-chomp.png)

![Pong Clock at 14:35](docs/preview/pongclock-1435.png)

## Run it

The site is static. ES modules will not load from a `file://` URL, so use a local static server from the repo root:

```bash
npm start
```

Then open `http://127.0.0.1:8080/`. `npm start` is `python3 -m http.server 8080`. Any other static server works the same way. Asset URLs are relative (`css/app.css`, `src/main.js`, and the loaders’ `import.meta.url` fetches), so the same tree also works under a subpath such as `https://clogwog.net/projects/panel-player/`.

```bash
python3 -m http.server 8080
```

There is no build step. Nothing here drives a physical HAT or a Raspberry Pi. GPIO, syslog, and `SwapOnVSync` are host stubs; the visible panel is the browser canvas.

## Tests

Node’s built-in test runner is enough. No extra packages.

```bash
npm test
```

The tests cover the preprocessor (digit macros, include guards), a small interpreted drawing program (integer division, reference parameters, `SetPixel`), default arguments and in-class initializers, pacmanclock (parsed colours, the 3×5 digit tables, the right-facing mouth sprite, a 14:35 frame, and movement after the 80&nbsp;ms step), and pongclock (a 14:35 frame with BDF digits, centre dashes, the second-hand row, paddles, and a ball that moves on the next `usleep`).

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
| `src/projects/registry.js` | Project list behind the picker |
| `src/projects/pacmanclock/` | Vendored Pac-Man Clock sources, system stubs, adapter |
| `src/projects/pongclock/` | Vendored Pong Clock sources, font, system stubs, adapter |
| `src/matrix/bdf.js` | BDF loader used by the Pong Clock host `DrawText` |
| `index.html` | The bench UI |

`VirtualMatrix` is the shared pixel buffer (`SetPixel`, `Clear`, `Fill`). `createClock()` is the shared time source (`time`, `localtime`, `gettimeofday`). `BitmapFont` is the shared glyph drawer for a future project written in JavaScript. Pac-Man Clock does not call `BitmapFont`; its digits are the `bool` tables in `digit.cc`, drawn by the interpreted `Digit::hittest`. Pong Clock’s digits come from `pongnumberfont.bdf` through the host `rgb_matrix::DrawText`.

## Adding a project

1. Create `src/projects/<id>/adapter.js` exporting an object with `id`, `title`, `description`, and `async start(host)`.
2. Register it in the array inside `src/projects/registry.js`.
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

To reuse the interpreter, put the `.cc` sources and any stub headers in that project folder, build a `Map` of filename to text (see `load.js`), and pass the entry files to `compileSources`. `createSession(program, { clock, files }).step(nowMs)` runs until the next frame. Pac-Man Clock yields at `SwapOnVSync`. Pong Clock yields at `usleep`. Pass the same file map as `files` when the program calls `LoadFont` on a path such as `./pongnumberfont.bdf`.

## Interpreter trade-off

pacmanclock is ordinary C++: globals, a couple of classes, 2D `bool` tables, `vector`, `rand`, and `Canvas::SetPixel`. It does not use the RGB-matrix font renderer. Two ways to show it:

- **Hand-port the maze and the sprite to JavaScript.** Faster and easier to debug. The port is a second program, and it drifts the moment the C++ changes.
- **Interpret a C++ subset and execute the vendored sources.** The maze rules, colours, glyph tables, chomp timing, and `main` loop stay in `pacmanclock.cc` and `digit.cc`. The cost is a bespoke engine and a frame time around 20&nbsp;ms in Node, which is enough for the 80&nbsp;ms step but is not a general C++ compiler.

This repo takes the second path. Hardware from [rpi-rgb-led-matrix](https://github.com/hzeller/rpi-rgb-led-matrix) is not interpreted. Those headers in upstream are GPL-2; this tree replaces them with empty stubs and implements `SetPixel`, `Clear`, `CreateFrameCanvas`, and `SwapOnVSync` on `VirtualMatrix`. Pac-Man Clock publishes a frame at `SwapOnVSync`. Pong Clock never calls that; it draws on the `RGBMatrix` itself, so `usleep` publishes the live canvas. The host also implements the BDF slice of `Font::LoadFont`, `Font::baseline`, and `DrawText` that Pong Clock calls. The library sources are not vendored.

`rand` is a small 15-bit LCG, not glibc’s generator, so two runs with the same seed still will not match a Pi binary. `RAND_MAX` in the Pong Clock stub is 32767 so it matches that generator. `srand(time(NULL))` is honoured, so each visit gets a new maze or a new ball.

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

The picker is the registry. Pac-Man Clock and Pong Clock are both registered.

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

## What is not simulated

- Templates other than `vector<T>` as a built-in
- Inheritance, virtual calls, exceptions, lambdas, operator overloading, namespaces as scopes
- Preprocessor tricks beyond object-like macros, simple function-like macros, includes, and include guards. `#if` only handles `0`, `1`, and `defined`
- References other than reference parameters and `for (auto& x : vec)`
- Pointer arithmetic, arrays above 2D, and most of the standard library
- `cout` / `operator<<` (the font-failure branch in Pong Clock parses, and is not taken when the BDF loads)
- The rest of `graphics.cc` beyond `LoadFont`, `baseline`, and the 6-argument `DrawText` (ink pixels only, no background colour)
- PWM, hardware pulsing, multi-panel chains beyond `width = cols * chain_length`, and brightness applied inside `SetPixel`. Pac-Man Clock sets brightness to 50; Pong Clock does not set it. The bench shows the raw pixel values and prints the driver setting beside the panel
- Signals, syslog output, and a GPIO init failure. `interrupt_received` stays false, so both loops run until you leave the page
- A real `usleep` delay inside the interpreter. The bench paces Pong Clock at 25&nbsp;ms per frame and does not catch up if a frame is late
- `strcpy` into the unused `line[6]` buffer is implemented, and nothing reads that buffer
- The optional `./pacmanclock <seconds>` quit timer, unless a host passes `argc` / `argv`. The bench passes `argc == 1`
- Catch-up if a Pac-Man frame is late: the C++ steps at most once per refresh, and the interpreter does the same

## Sources

`src/projects/pacmanclock/sources/pacmanclock.cc`, `digit.cc`, and `digit.h` are the app sources from [clogwog/pacmanclock](https://github.com/clogwog/pacmanclock) at `d8c3611d10ceb1dd1803e91cadfbdf1be35a6fef`. Upstream has no license file.

`src/projects/pongclock/sources/pongclock.cc` and `pongnumberfont.bdf` are from [clogwog/pongclock](https://github.com/clogwog/pongclock) at `ee2549e077be6f9f7ad70ba120809dcf9824fc33`. The font file says it is public domain. The RGB-matrix library itself is not vendored for either project.
