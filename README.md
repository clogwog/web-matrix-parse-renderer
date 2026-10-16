# Matrix bench

A browser simulator for a 32×32 RGB LED matrix. The first project is [pacmanclock](https://github.com/clogwog/pacmanclock): the page loads that program’s C++ and runs it on a virtual panel of round, glowing pixels. The clock uses this computer’s local time.

![Pac-Man Clock at 14:35](docs/preview/pacmanclock-1435.png)

![Same clock a moment later, after Pac-Man has stepped](docs/preview/pacmanclock-1435-chomp.png)

## Run it

The site is static. ES modules will not load from a `file://` URL, so use a local static server from the repo root:

```bash
npm start
```

Then open `http://127.0.0.1:8080/`. `npm start` is `python3 -m http.server 8080`. Any other static server works the same way.

```bash
python3 -m http.server 8080
```

There is no build step. Nothing here drives a physical HAT or a Raspberry Pi. GPIO, syslog, and `SwapOnVSync` are host stubs; the visible panel is the browser canvas.

## Tests

Node’s built-in test runner is enough. No extra packages.

```bash
npm test
```

The tests cover the preprocessor (digit macros, include guards), a small interpreted drawing program (integer division, reference parameters, `SetPixel`), and pacmanclock itself: parsed colours, the 3×5 digit tables, the right-facing mouth sprite, a 14:35 frame (colon, hour tens digit, walls, pellets, Pac-Man), and movement after the 80&nbsp;ms step.

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
| `src/projects/pacmanclock/` | Vendored app sources, system stubs, adapter |
| `index.html` | The bench UI |

`VirtualMatrix` is the shared pixel buffer (`SetPixel`, `Clear`, `Fill`). `createClock()` is the shared time source (`time`, `localtime`, `gettimeofday`). `BitmapFont` is the shared glyph drawer for a future project written in JavaScript. Pac-Man Clock does not call `BitmapFont`; its digits are the `bool` tables in `digit.cc`, drawn by the interpreted `Digit::hittest`.

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

To reuse the interpreter, put the `.cc` sources and any stub headers in that project folder, build a `Map` of filename to text (see `load.js`), and pass the entry files to `compileSources`. `createSession(program, { clock }).step(nowMs)` runs until the next `SwapOnVSync` and returns that frame.

## Interpreter trade-off

pacmanclock is ordinary C++: globals, a couple of classes, 2D `bool` tables, `vector`, `rand`, and `Canvas::SetPixel`. It does not use the RGB-matrix font renderer. Two ways to show it:

- **Hand-port the maze and the sprite to JavaScript.** Faster and easier to debug. The port is a second program, and it drifts the moment the C++ changes.
- **Interpret a C++ subset and execute the vendored sources.** The maze rules, colours, glyph tables, chomp timing, and `main` loop stay in `pacmanclock.cc` and `digit.cc`. The cost is a bespoke engine and a frame time around 20&nbsp;ms in Node, which is enough for the 80&nbsp;ms step but is not a general C++ compiler.

This repo takes the second path. Hardware from [rpi-rgb-led-matrix](https://github.com/hzeller/rpi-rgb-led-matrix) is not interpreted. Those headers in upstream are GPL-2; this tree replaces them with empty stubs and implements `SetPixel`, `Clear`, `CreateFrameCanvas`, and `SwapOnVSync` on `VirtualMatrix`. A frame is published when the program calls `SwapOnVSync`, which is the same point the real loop flips the back buffer.

`rand` is a small LCG, not glibc’s generator, so two runs with the same seed still will not match a Pi binary. `srand(time(NULL))` is honoured, so each visit gets a new maze.

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

The picker is the registry. Only Pac-Man Clock is registered today.

## What is not simulated

- Templates other than `vector<T>` as a built-in
- Inheritance, virtual calls, exceptions, lambdas, operator overloading, namespaces as scopes
- Preprocessor tricks beyond object-like macros, simple function-like macros, includes, and include guards. `#if` only handles `0`, `1`, and `defined`
- References other than reference parameters and `for (auto& x : vec)`
- Pointer arithmetic, arrays above 2D, and most of the standard library
- `DrawText`, BDF fonts, and the rest of `graphics.cc` (pacmanclock includes the header and does not call them)
- PWM, hardware pulsing, multi-panel chains beyond `width = cols * chain_length`, and brightness applied inside `SetPixel`. The source sets brightness to 50; the bench shows the raw pixel values and prints the driver setting beside the panel
- Signals, syslog output, and a GPIO init failure
- The optional `./pacmanclock <seconds>` quit timer, unless a host passes `argc` / `argv`. The bench passes `argc == 1`, so the loop runs until you leave the page
- Catch-up if a frame is late: the C++ steps at most once per refresh, and the interpreter does the same

## Sources

`src/projects/pacmanclock/sources/pacmanclock.cc`, `digit.cc`, and `digit.h` are the app sources from [clogwog/pacmanclock](https://github.com/clogwog/pacmanclock) at `d8c3611d10ceb1dd1803e91cadfbdf1be35a6fef`. Upstream has no license file. The RGB-matrix library itself is not vendored.
