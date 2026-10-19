import { pacmanClockProject } from "./pacmanclock/adapter.js?v=20261019";
import { pongClockProject } from "./pongclock/adapter.js?v=20261019";
import { matrixClockProject } from "./matrixclock/adapter.js?v=20261019";
import { tetrisClockProject } from "./tetrisclock/adapter.js?v=20261019";

const projects = [pacmanClockProject, pongClockProject, matrixClockProject, tetrisClockProject];

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
