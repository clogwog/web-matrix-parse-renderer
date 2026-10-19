import { BUILD_VERSION } from "./version.js?v=20261019";
import { createClock } from "./matrix/clock.js?v=20261019";
import { findProject, listProjects } from "./projects/registry.js?v=20261019";
import { locationWithProject, resolveProjectId } from "./projects/url.js?v=20261019";
import { PanelView } from "./render/panel-view.js?v=20261019";

const description = document.querySelector("#description");
const repoLink = document.querySelector("#repo");
const clockLabel = document.querySelector("#clock");
const statusLabel = document.querySelector("#status");
const canvas = document.querySelector("#panel");
const pauseButton = document.querySelector("#pause");
const backLink = document.querySelector(".back");
const projectGrid = document.querySelector("#project-grid");

const view = new PanelView(canvas);
const clock = createClock(null);
let running = null;
let paused = false;
let frames = 0;
let fpsStamp = performance.now();
let fps = 0;
let currentId = null;
let bootToken = 0;

function pad(n)
{
    return String(n).padStart(2, "0");
}

function formatNow(ms)
{
    const date = new Date(ms);
    return pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds());
}

function projectIds()
{
    return listProjects().map(function (project)
    {
        return project.id;
    });
}

function repoLabel(url)
{
    if (!url)
    {
        return "";
    }
    return url.replace(/^https:\/\/github\.com\//, "");
}

function thumbUrl(project)
{
    if (!project.thumb)
    {
        return "";
    }
    const join = project.thumb.indexOf("?") === -1 ? "?" : "&";
    return project.thumb + join + "v=" + BUILD_VERSION;
}

function markSelected(id)
{
    const buttons = projectGrid.querySelectorAll(".project-icon");
    for (const button of buttons)
    {
        const on = button.dataset.project === id;
        button.setAttribute("aria-pressed", on ? "true" : "false");
    }
}

function writeProjectUrl(id, mode)
{
    const next = locationWithProject(window.location, id);
    const current = window.location.pathname + window.location.search + window.location.hash;
    if (next === current)
    {
        return;
    }
    const state = { project: id };
    if (mode === "push")
    {
        history.pushState(state, "", next);
        return;
    }
    history.replaceState(state, "", next);
}

function fillProjects()
{
    const projects = listProjects();
    for (const project of projects)
    {
        const tile = document.createElement("div");
        tile.className = "project-tile";

        const button = document.createElement("button");
        button.type = "button";
        button.className = "project-icon";
        button.dataset.project = project.id;
        button.setAttribute("aria-pressed", "false");
        button.setAttribute("aria-label", project.title);

        const tipId = "project-tip-" + project.id;
        button.setAttribute("aria-describedby", tipId);

        if (project.thumb)
        {
            const img = document.createElement("img");
            img.alt = "";
            img.src = thumbUrl(project);
            button.appendChild(img);
        }

        const tip = document.createElement("div");
        tip.className = "project-pop";
        tip.id = tipId;
        tip.setAttribute("role", "tooltip");

        const name = document.createElement("strong");
        name.textContent = project.title;

        const about = document.createElement("p");
        about.textContent = project.description;

        tip.appendChild(name);
        tip.appendChild(about);

        if (project.shows)
        {
            const shows = document.createElement("p");
            shows.className = "project-shows";
            shows.textContent = project.shows;
            tip.appendChild(shows);
        }

        if (project.repo)
        {
            const link = document.createElement("a");
            link.href = project.repo;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = repoLabel(project.repo);
            tip.appendChild(link);
        }

        button.addEventListener("click", function ()
        {
            boot(project.id, "push");
        });

        tile.appendChild(button);
        tile.appendChild(tip);
        projectGrid.appendChild(tile);
    }
}

function schedule(callback)
{
    return requestAnimationFrame(callback);
}

function cancel(id)
{
    cancelAnimationFrame(id);
}

async function boot(id, historyMode)
{
    const project = findProject(id);
    if (!project)
    {
        return;
    }
    if (historyMode === "push" && project.id === currentId)
    {
        return;
    }
    if (historyMode == null && project.id === currentId)
    {
        markSelected(project.id);
        return;
    }

    const token = ++bootToken;
    if (running)
    {
        running.stop();
        running = null;
    }
    currentId = project.id;
    markSelected(project.id);
    description.textContent = project.description;
    if (project.repo)
    {
        repoLink.href = project.repo;
        repoLink.textContent = repoLabel(project.repo);
    }
    if (historyMode)
    {
        writeProjectUrl(project.id, historyMode);
    }
    statusLabel.textContent = "Starting " + project.title + "…";
    frames = 0;
    fpsStamp = performance.now();
    try
    {
        const handle = await project.start({
            clock,
            schedule,
            cancel,
            paused()
            {
                return paused;
            },
            onFrame(frame, meta)
            {
                if (paused || token !== bootToken)
                {
                    return;
                }
                view.setFrame(frame);
                frames++;
                const now = performance.now();
                if (now - fpsStamp >= 500)
                {
                    fps = Math.round(frames * 1000 / (now - fpsStamp));
                    frames = 0;
                    fpsStamp = now;
                }
                const bright = meta && meta.brightness != null ? meta.brightness : 100;
                clockLabel.textContent = formatNow(clock.now());
                statusLabel.textContent = frame.width + "×" + frame.height
                    + "  ·  " + fps + " fps"
                    + "  ·  driver brightness " + bright + "%";
            },
            onError(error)
            {
                if (token !== bootToken)
                {
                    return;
                }
                statusLabel.textContent = "Interpreter error: " + error.message;
                console.error(error);
            },
            onDone()
            {
                if (token !== bootToken)
                {
                    return;
                }
                statusLabel.textContent = "Program finished.";
            }
        });
        if (token !== bootToken)
        {
            handle.stop();
            return;
        }
        running = handle;
    }
    catch (error)
    {
        if (token !== bootToken)
        {
            return;
        }
        statusLabel.textContent = "Could not start: " + error.message;
        console.error(error);
    }
}

pauseButton.addEventListener("click", function ()
{
    paused = !paused;
    pauseButton.textContent = paused ? "Resume" : "Pause";
    if (!paused)
    {
        fpsStamp = performance.now();
        frames = 0;
    }
});

backLink.addEventListener("click", function (event)
{
    event.preventDefault();
    history.back();
});

window.addEventListener("popstate", function ()
{
    boot(resolveProjectId(window.location.search, projectIds()), null);
});

window.addEventListener("resize", function ()
{
    view.resize();
});

fillProjects();
boot(resolveProjectId(window.location.search, projectIds()), "replace");
