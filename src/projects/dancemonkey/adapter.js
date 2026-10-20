import { compileSources } from "../../cpp/compile.js?v=20261026";
import { createSession } from "../../cpp/interpreter.js?v=20261026";
import { MatrixProject } from "../project.js?v=20261026";
import { DANCE_ENTRIES, loadDanceFiles } from "./load.js?v=20261026";

const DESCRIPTION = "David Brent dances across the panel under a dim HH:MM. Only the pixels that changed are repainted. Interpreted from clogwog/dancemonkey.";
const SHOWS = "141 sprite frames, played twice, with the hour and minute from pongnumberfont.bdf.";
const FRAME_MS = 100;

export class DanceMonkeyProject extends MatrixProject
{
    constructor()
    {
        super({
            id: "dancemonkey",
            title: "Dance Monkey",
            description: DESCRIPTION,
            repo: "https://github.com/clogwog/dancemonkey",
            shows: SHOWS,
            thumb: "css/thumbs/dancemonkey.png"
        });
    }

    async start(host)
    {
        const files = await loadDanceFiles();
        const program = compileSources(files, DANCE_ENTRIES);
        const session = createSession(program, {
            clock: host.clock,
            files,
            argc: host.argc == null ? 1 : host.argc,
            argv: host.argv || ["dancemonkey"]
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
                        projectId: "dancemonkey",
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

export const danceMonkeyProject = new DanceMonkeyProject();
