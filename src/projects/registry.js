import { pacmanClockProject } from "./pacmanclock/adapter.js?v=20261027";
import { pongClockProject } from "./pongclock/adapter.js?v=20261027";
import { matrixClockProject } from "./matrixclock/adapter.js?v=20261027";
import { tetrisClockProject } from "./tetrisclock/adapter.js?v=20261027";
import { plasmaClockProject } from "./plasmaclock/adapter.js?v=20261027";
import { snakeClockProject } from "./snakeclock/adapter.js?v=20261027";
import { marioClockProject } from "./marioclock/adapter.js?v=20261027";
import { gameOfLifeProject } from "./gameoflifegame/adapter.js?v=20261027";
import { danceMonkeyProject } from "./dancemonkey/adapter.js?v=20261027";
import { rexieProject } from "./rexie/adapter.js?v=20261027";

const projects = [pacmanClockProject, pongClockProject, matrixClockProject, tetrisClockProject, plasmaClockProject, snakeClockProject, marioClockProject, gameOfLifeProject, danceMonkeyProject, rexieProject];

export function listProjects()
{
    return projects.slice();
}

export function findProject(id)
{
    for (const project of projects)
    {
        if (project.id === id)
        {
            return project;
        }
    }
    return projects[0];
}

export function registerProject(project)
{
    const existing = projects.findIndex(function (item)
    {
        return item.id === project.id;
    });
    if (existing >= 0)
    {
        projects[existing] = project;
        return;
    }
    projects.push(project);
}
