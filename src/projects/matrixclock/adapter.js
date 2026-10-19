import { compileSources } from "../../cpp/compile.js?v=20261021";
import { createSession } from "../../cpp/interpreter.js?v=20261021";
import { MatrixProject } from "../project.js?v=20261021";
import { MATRIX_ENTRIES, loadMatrixFiles } from "./load.js?v=20261021";

const DESCRIPTION = "Matrix rain over the local time. Green streaks fall down the panel, and the hour and minute digits light up in full green where a streak crosses them. Interpreted from clogwog/matrixclock.";
const SHOWS = "Green streaks fall down the panel. Digit masks light up where a streak crosses them.";
const FRAME_MS = 25;

export class MatrixClockProject extends MatrixProject
{
    constructor()
    {
        super({
            id: "matrixclock",
            title: "Matrix Clock",
            description: DESCRIPTION,
            repo: "https://github.com/clogwog/matrixclock",
            shows: SHOWS,
            thumb: "css/thumbs/matrixclock.png"
        });
    }

    async start(host)
    {
        const files = await loadMatrixFiles();
        const program = compileSources(files, MATRIX_ENTRIES);
        const session = createSession(program, {
            clock: host.clock,
            files,
            argc: host.argc == null ? 1 : host.argc,
            argv: host.argv || ["matrixclock"]
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
                        projectId: "matrixclock",
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

export const matrixClockProject = new MatrixClockProject();
