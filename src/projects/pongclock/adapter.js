import { compileSources } from "../../cpp/compile.js";
import { createSession } from "../../cpp/interpreter.js";
import { MatrixProject } from "../project.js";
import { PONG_ENTRIES, loadPongFiles } from "./load.js";

const DESCRIPTION = "Auto-playing pong. The score is the local time, drawn from pongnumberfont.bdf, and a normal-distribution bar along the bottom is the second hand. Interpreted from clogwog/pongclock.";
const FRAME_MS = 25;

export class PongClockProject extends MatrixProject
{
    constructor()
    {
        super({
            id: "pongclock",
            title: "Pong Clock",
            description: DESCRIPTION
        });
    }

    async start(host)
    {
        const files = await loadPongFiles();
        const program = compileSources(files, PONG_ENTRIES);
        const session = createSession(program, {
            clock: host.clock,
            files,
            argc: host.argc == null ? 1 : host.argc,
            argv: host.argv || ["pongclock"]
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
                        projectId: "pongclock",
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

export const pongClockProject = new PongClockProject();
