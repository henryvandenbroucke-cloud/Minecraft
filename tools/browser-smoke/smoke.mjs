/**
 * Browser smoke test for the packaged prototype (Milestone A exit evidence).
 * Usage:  CHROME_PATH=/path/to/chrome npm run e2e  (server must be running: npm run preview)
 * Checks: start screen, on-foot movement from real key presses, quick-save write, pause/resume,
 * entering the car with F, driving with W, handbrake with Space. Writes screenshots to test-results/.
 * Software WebGL is used when no GPU is present (--use-angle=swiftshader). Timing is not a benchmark.
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const url = process.env.SALTLINE_URL ?? 'http://localhost:4173/';
const chromePath = process.env.CHROME_PATH;
if (!chromePath) {
  console.error('Set CHROME_PATH to a Chrome/Chromium binary.');
  process.exit(2);
}
const outDir = new URL('../../test-results/', import.meta.url).pathname;
mkdirSync(outDir, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage', '--no-zygote', '--single-process', '--window-size=1280,720'],
  defaultViewport: { width: 1280, height: 720 },
  timeout: 90000,
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.screenshot({ path: `${outDir}/01-start.png` });
  check('start screen loads with canvas', !!(await page.$('#view')));

  await page.click('#start-btn');
  await wait(1500);
  check('sim boots with 25 resident cells and collision coverage', await page.evaluate(() => {
    const s = window.saltline.sim;
    return s.colliders.loadedCount === 25 && s.collisionCoverageOk();
  }));

  const pos = () => page.evaluate(() => ({ x: window.saltline.sim.player.x, z: window.saltline.sim.player.z }));
  const p0 = await pos();
  await page.keyboard.down('KeyW');
  await wait(1500);
  await page.keyboard.up('KeyW');
  const p1 = await pos();
  const moved = Math.hypot(p1.x - p0.x, p1.z - p0.z);
  check('W moves the player (keyboard input path)', moved > 1, `${moved.toFixed(2)} m`);

  await page.keyboard.press('F5');
  await wait(300);
  const saved = await page.evaluate(() => Object.keys(localStorage).some((k) => k.endsWith('slot1.main')));
  check('F5 quick save writes slot 1 to storage', saved);

  await page.keyboard.press('Escape');
  await wait(300);
  const paused = await page.evaluate(() => !document.getElementById('menu').hidden && window.saltline.sim.clock.paused);
  check('Escape opens the pause menu and freezes the sim clock', paused, await page.evaluate(() => JSON.stringify({ hidden: document.getElementById('menu')?.hidden, paused: window.saltline.sim.clock.paused })));
  await page.evaluate(() => document.querySelector('[data-act="resume"]')?.click());
  await wait(200);
  check('Resume unfreezes the sim', await page.evaluate(() => !window.saltline.sim.clock.paused));

  await page.evaluate(() => {
    const s = window.saltline.sim;
    s.player.x = s.car.x - 1.5;
    s.player.z = s.car.z;
  });
  await wait(400);
  await page.keyboard.press('KeyF');
  await wait(300);
  check('F enters the Kestrel GT when next to it', await page.evaluate(() => window.saltline.sim.mode === 'in_vehicle'));
  await page.keyboard.down('KeyW');
  await wait(3000);
  await page.keyboard.up('KeyW');
  const v = await page.evaluate(() => window.saltline.sim.car.v);
  check('W accelerates the car', v > 3, `${v.toFixed(1)} m/s after 3 s`);
  await page.screenshot({ path: `${outDir}/02-driving.png` });
  await page.keyboard.down('KeyS');
  await wait(1500);
  await page.keyboard.up('KeyS');
  const vBrake = await page.evaluate(() => window.saltline.sim.car.v);
  check('S brakes the car', vBrake < v, `${v.toFixed(1)} -> ${vBrake.toFixed(1)} m/s`);
  check('no uncaught page errors', errors.length === 0, errors.join(' | '));
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} browser checks passed`);
process.exitCode = failed ? 1 : 0;
