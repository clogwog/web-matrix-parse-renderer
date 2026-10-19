import { compileSources } from "../../cpp/compile.js?v=20261019";
import { createSession } from "../../cpp/interpreter.js?v=20261019";
import { MatrixProject } from "../project.js?v=20261019";
import { PACMAN_ENTRIES, loadPacmanFiles } from "./load.js?v=20261019";

const DESCRIPTION = "Random 5×5 maze, HH:MM at the top, and a 5×5 Pac-Man that eats pellets. Interpreted from clogwog/pacmanclock.";
const SHOWS = "Yellow Pac-Man walks a blue maze while the hour and minute sit on the top row.";

export class PacmanClockProject extends MatrixProject
{
    constructor()
    {
        super({
            id: "pacmanclock",
            title: "Pac-Man Clock",
            description: DESCRIPTION,
            repo: "https://github.com/clogwog/pacmanclock",
            shows: SHOWS,
            thumb: "css/thumbs/pacmanclock.png"
        });
    }

    async start(host)
    {
        const files = await loadPacmanFiles();
        const program = compileSources(files, PACMAN_ENTRIES);
        const session = createSession(program, {
            clock: host.clock,
            argc: host.argc == null ? 1 : host.argc,
            argv: host.argv || ["pacmanclock"]
        });
        let timer = 0;
        let stopped = false;

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
            try
            {
                const step = session.step(host.clock.now());
                if (step.frame)
                {
                    host.onFrame(step.frame, {
                        projectId: "pacmanclock",
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

export const pacmanClockProject = new PacmanClockProject();
