import { compileSources } from "../../cpp/compile.js?v=20261028";
import { createSession } from "../../cpp/interpreter.js?v=20261028";
import { MatrixProject } from "../project.js?v=20261028";
import { MARIO_ENTRIES, loadMarioFiles } from "./load.js?v=20261028";

const DESCRIPTION = "Mario walks the bottom of the panel under a gold HH:MM, and jumps to knock the minute digits away when they change. Interpreted from clogwog/marioclock.";
const SHOWS = "Four walk frames, a mirrored return trip, and a bump that launches the old minute off the top.";
const FRAME_MS = 25;

export class MarioClockProject extends MatrixProject
{
    constructor()
    {
        super({
            id: "marioclock",
            title: "Mario Clock",
            description: DESCRIPTION,
            repo: "https://github.com/clogwog/marioclock",
            shows: SHOWS,
            thumb: "css/thumbs/marioclock.png"
        });
    }

    async start(host)
    {
        const files = await loadMarioFiles();
        const program = compileSources(files, MARIO_ENTRIES);
        const session = createSession(program, {
            clock: host.clock,
            files,
            argc: host.argc == null ? 1 : host.argc,
            argv: host.argv || ["marioclock"]
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
                        projectId: "marioclock",
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

export const marioClockProject = new MarioClockProject();
