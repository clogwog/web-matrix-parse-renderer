import { compileSources } from "../../cpp/compile.js?v=20261023";
import { createSession } from "../../cpp/interpreter.js?v=20261023";
import { MatrixProject } from "../project.js?v=20261023";
import { PLASMA_ENTRIES, loadPlasmaFiles } from "./load.js?v=20261023";

const DESCRIPTION = "A plasma field fills the panel, and the local time is cut out of it in black. Interpreted from clogwog/plasmaclock.";
const SHOWS = "Swirling colour covers the matrix. Hour and minute digits stay black.";
const FRAME_MS = 100;

export class PlasmaClockProject extends MatrixProject
{
    constructor()
    {
        super({
            id: "plasmaclock",
            title: "Plasma Clock",
            description: DESCRIPTION,
            repo: "https://github.com/clogwog/plasmaclock",
            shows: SHOWS,
            thumb: "css/thumbs/plasmaclock.png"
        });
    }

    async start(host)
    {
        const files = await loadPlasmaFiles();
        const program = compileSources(files, PLASMA_ENTRIES);
        const session = createSession(program, {
            clock: host.clock,
            files,
            argc: host.argc == null ? 1 : host.argc,
            argv: host.argv || ["plasmaclock"]
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
                        projectId: "plasmaclock",
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

export const plasmaClockProject = new PlasmaClockProject();
