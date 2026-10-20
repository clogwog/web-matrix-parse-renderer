import { compileSources } from "../../cpp/compile.js?v=20261022";
import { createSession } from "../../cpp/interpreter.js?v=20261022";
import { MatrixProject } from "../project.js?v=20261022";
import { TETRIS_ENTRIES, loadTetrisFiles } from "./load.js?v=20261022";

const DESCRIPTION = "Tetris pieces fall into the local time, and a dim frame creeps around the panel as the seconds pass. Interpreted from clogwog/tetrisclock.";
const SHOWS = "Digits are built from falling tetrominoes. A grey line walks the border once a minute.";
const FRAME_MS = 125;

export class TetrisClockProject extends MatrixProject
{
    constructor()
    {
        super({
            id: "tetrisclock",
            title: "Tetris Clock",
            description: DESCRIPTION,
            repo: "https://github.com/clogwog/tetrisclock",
            shows: SHOWS,
            thumb: "css/thumbs/tetrisclock.png"
        });
    }

    async start(host)
    {
        const files = await loadTetrisFiles();
        const program = compileSources(files, TETRIS_ENTRIES);
        const session = createSession(program, {
            clock: host.clock,
            files,
            argc: host.argc == null ? 1 : host.argc,
            argv: host.argv || ["tetrisclock"]
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
                        projectId: "tetrisclock",
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

export const tetrisClockProject = new TetrisClockProject();
