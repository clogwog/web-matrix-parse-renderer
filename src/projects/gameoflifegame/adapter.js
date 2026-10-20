import { compileSources } from "../../cpp/compile.js?v=20261028";
import { createSession } from "../../cpp/interpreter.js?v=20261028";
import { MatrixProject } from "../project.js?v=20261028";
import { LIFE_ENTRIES, loadLifeFiles } from "./load.js?v=20261028";

const DESCRIPTION = "Conway's Life fills the panel. A new cell is orange and ages toward cyan, and a field that stops changing is scrambled. Interpreted from clogwog/gameoflifegame.";
const SHOWS = "Each live cell counts its eight neighbours. Two or three keep it, three birth a dead cell, and age shifts the colour.";
const FRAME_MS = 75;

export class GameOfLifeProject extends MatrixProject
{
    constructor()
    {
        super({
            id: "gameoflifegame",
            title: "Game of Life",
            description: DESCRIPTION,
            repo: "https://github.com/clogwog/gameoflifegame",
            shows: SHOWS,
            thumb: "css/thumbs/gameoflifegame.png"
        });
    }

    async start(host)
    {
        const files = await loadLifeFiles();
        const program = compileSources(files, LIFE_ENTRIES);
        const session = createSession(program, {
            clock: host.clock,
            files,
            argc: host.argc == null ? 1 : host.argc,
            argv: host.argv || ["gameoflife"]
        });
        let timer = 0;
        let stopped = false;
        let nextStep = 0;

        const tick = function ()
        {
            if (stopped)
            {
                return;
            }
            if (host.paused && host.paused())
            {
                timer = host.schedule(tick);
                return;
            }
            const now = host.clock.now();
            if (nextStep && now < nextStep)
            {
                timer = host.schedule(tick);
                return;
            }
            try
            {
                const step = session.step(now);
                nextStep = now + FRAME_MS;
                if (step.frame)
                {
                    host.onFrame(step.frame, {
                        projectId: "gameoflifegame",
                        brightness: step.frame.brightness
                    });
                }
                if (step.done)
                {
                    stopped = true;
                    if (host.onDone)
                    {
                        host.onDone();
                    }
                    return;
                }
            }
            catch (error)
            {
                stopped = true;
                if (host.onError)
                {
                    host.onError(error);
                }
                return;
            }
            timer = host.schedule(tick);
        };

        timer = host.schedule(tick);

        return {
            stop()
            {
                stopped = true;
                if (timer && host.cancel)
                {
                    host.cancel(timer);
                }
            }
        };
    }
}

export const gameOfLifeProject = new GameOfLifeProject();
