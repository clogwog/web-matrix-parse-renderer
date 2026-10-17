import { createClock } from "./matrix/clock.js?v=20261017";
import { findProject, listProjects } from "./projects/registry.js?v=20261017";
import { PanelView } from "./render/panel-view.js?v=20261017";

const projectSelect = document.querySelector("#project");
const description = document.querySelector("#description");
const clockLabel = document.querySelector("#clock");
const statusLabel = document.querySelector("#status");
const canvas = document.querySelector("#panel");
const pauseButton = document.querySelector("#pause");
const backLink = document.querySelector(".back");

const view = new PanelView(canvas);
const clock = createClock(null);
let running = null;
let paused = false;
let frames = 0;
let fpsStamp = performance.now();
let fps = 0;

function pad(n)
{
    return String(n).padStart(2, "0");
}

function formatNow(ms)
{
    const date = new Date(ms);
    return pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds());
}

function fillProjects()
{
    const projects = listProjects();
    for (const project of projects)
    {
        const option = document.createElement("option");
        option.value = project.id;
        option.textContent = project.title;
        projectSelect.appendChild(option);
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

async function boot(id)
{
    if (running)
    {
        running.stop();
        running = null;
    }
    const project = findProject(id);
    description.textContent = project.description;
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
                if (paused)
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
                statusLabel.textContent = "Interpreter error: " + error.message;
                console.error(error);
            },
            onDone()
            {
                statusLabel.textContent = "Program finished.";
            }
        });
        running = handle;
    }
    catch (error)
    {
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

projectSelect.addEventListener("change", function ()
{
    boot(projectSelect.value);
});

window.addEventListener("resize", function ()
{
    view.resize();
});

fillProjects();
boot(projectSelect.value || "pacmanclock");
