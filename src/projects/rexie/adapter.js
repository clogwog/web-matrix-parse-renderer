import { compileSources } from "../../cpp/compile.js?v=20261026";
import { createSession } from "../../cpp/interpreter.js?v=20261026";
import { MatrixProject } from "../project.js?v=20261026";
import { REXIE_ENTRIES, loadRexieFiles } from "./load.js?v=20261026";

const DESCRIPTION = "The offline Chrome dinosaur runs under a dim HH:MM. Only the pixels that changed are repainted. Interpreted from clogwog/rexie.";
const SHOWS = "80 sprite frames, played twice, with the hour and minute from pongnumberfont.bdf.";
const FRAME_MS = 150;

export class RexieProject extends MatrixProject
{
    constructor()
    {
        super({
            id: "rexie",
            title: "Rexie",
            description: DESCRIPTION,
            repo: "https://github.com/clogwog/rexie",
            shows: SHOWS,
            thumb: "css/thumbs/rexie.png"
        });
    }

    async start(host)
    {
        const files = await loadRexieFiles();
        const program = compileSources(files, REXIE_ENTRIES);
        const session = createSession(program, {
            clock: host.clock,
            files,
            argc: host.argc == null ? 1 : host.argc,
            argv: host.argv || ["rexie"]
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
                        projectId: "rexie",
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

export const rexieProject = new RexieProject();
