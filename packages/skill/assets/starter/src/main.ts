import "./style.css";
import { Engine } from "@cazala/party";
import { sceneFactories, sceneNames, type SceneName } from "./scenes";

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
}

const canvas = requiredElement<HTMLCanvasElement>("#party");
const title = requiredElement<HTMLElement>("#scene-title");
const status = requiredElement<HTMLElement>("#status");
const links = requiredElement<HTMLElement>("#scene-links");

const requestedScene = new URLSearchParams(window.location.search).get("scene");
const sceneName: SceneName = sceneNames.includes(requestedScene as SceneName)
  ? (requestedScene as SceneName)
  : "vortex";

for (const name of sceneNames) {
  const link = document.createElement("a");
  link.href = `?scene=${name}`;
  link.textContent = name;
  if (name === sceneName) link.setAttribute("aria-current", "page");
  links.append(link);
}

const viewport = { width: window.innerWidth, height: window.innerHeight };
const scene = sceneFactories[sceneName](viewport);
title.textContent = scene.title;

const engine = new Engine({
  canvas,
  forces: scene.forces,
  render: scene.render,
  runtime: "auto",
  ...scene.engine,
});

function resize(): void {
  engine.setSize(window.innerWidth, window.innerHeight);
}

function screenToWorld(event: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const screenX = event.clientX - rect.left;
  const screenY = event.clientY - rect.top;
  const camera = engine.getCamera();
  const zoom = engine.getZoom();
  return {
    x: camera.x + (screenX - rect.width / 2) / zoom,
    y: camera.y + (screenY - rect.height / 2) / zoom,
  };
}

function moveInteraction(event: PointerEvent): void {
  if (!scene.interaction) return;
  const world = screenToWorld(event);
  scene.interaction.setPosition(world.x, world.y);
}

function activateInteraction(event: PointerEvent): void {
  moveInteraction(event);
  scene.interaction?.setActive(true);
  canvas.setPointerCapture(event.pointerId);
}

function deactivateInteraction(event: PointerEvent): void {
  scene.interaction?.setActive(false);
  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
}

async function start(): Promise<void> {
  await engine.initialize();
  resize();
  engine.setParticles(scene.particles);
  for (const oscillator of scene.oscillators ?? []) {
    engine.addOscillator(oscillator);
  }
  engine.play();
  status.textContent = `${engine.getActualRuntime().toUpperCase()} · ${scene.particles.length.toLocaleString()} particles`;

  window.addEventListener("resize", resize);
  canvas.addEventListener("pointermove", moveInteraction);
  canvas.addEventListener("pointerdown", activateInteraction);
  canvas.addEventListener("pointerup", deactivateInteraction);
  canvas.addEventListener("pointercancel", deactivateInteraction);

  window.addEventListener(
    "beforeunload",
    () => {
      window.removeEventListener("resize", resize);
      void engine.destroy();
    },
    { once: true }
  );
}

void start().catch((error: unknown) => {
  status.textContent =
    error instanceof Error ? error.message : "Could not start Party";
  console.error(error);
});
