import { compileSources } from "../../cpp/compile.js?v=20261025";
import { createSession } from "../../cpp/interpreter.js?v=20261025";
import { MatrixProject } from "../project.js?v=20261025";
import { SNAKE_ENTRIES, loadSnakeFiles } from "./load.js?v=20261025";

const DESCRIPTION = "A green snake hunts a red apple while the local time cycles from red through white toward green. Interpreted from clogwog/snakeclock.";
const SHOWS = "The snake grows when it reaches the apple. HH:MM:SS sits across the top in a shifting colour.";
const FRAME_MS = 200;

export class SnakeClockProject extends MatrixProject
{
    constructor()
    {
        super({
            id: "snakeclock",
            title: "Snake Clock",
            description: DESCRIPTION,
            repo: "https://github.com/clogwog/snakeclock",
            shows: SHOWS,
            thumb: "css/thumbs/snakeclock.png"
        });
    }

    async start(host)
    {
        const files = await loadSnakeFiles();
        const program = compileSources(files, SNAKE_ENTRIES);
        const session = createSession(program, {
            clock: host.clock,
            files,
            argc: host.argc == null ? 1 : host.argc,
            argv: host.argv || ["snakeclock"]
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
                        projectId: "snakeclock",
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

export const snakeClockProject = new SnakeClockProject();
