/**
 * Stage dev panel - sliders for the values that can only be judged by eye.
 *
 * Opt-in with ?dev=1. Nothing is imported, created, or shipped to a normal
 * visitor; celeste.html only loads this module when the flag is present.
 *
 * Modelled on nikke_game/vrm-test.html, which solved the same problem: root
 * rotation and camera framing are impossible to get right by reasoning about
 * axes - two attempts at "rotate her counter-clockwise" landed on the wrong
 * axis and then the wrong direction. Drag it, read the number, paste it in.
 */

const PANEL_CSS = `
.devpanel{position:fixed;top:64px;right:12px;z-index:60;width:270px;
  font:12px/1.5 ui-monospace,monospace;color:#ffe9a3;background:rgba(12,4,18,.92);
  border:1px solid rgba(217,79,144,.55);border-radius:10px;padding:10px 12px;
  max-height:calc(100dvh - 90px);overflow:auto;backdrop-filter:blur(6px)}
.devpanel h4{margin:10px 0 4px;font-size:11px;letter-spacing:.14em;color:#ff8ac8;
  text-transform:uppercase}
.devpanel h4:first-child{margin-top:0}
.devpanel .row{display:grid;grid-template-columns:64px 1fr 42px;gap:6px;align-items:center}
.devpanel input[type=range]{width:100%}
.devpanel output{text-align:right;color:#fff}
.devpanel button{margin-top:8px;width:100%;padding:5px;cursor:pointer;
  background:rgba(217,79,144,.25);color:#ffe9a3;border:1px solid rgba(217,79,144,.6);
  border-radius:6px;font:inherit}
.devpanel textarea{width:100%;height:96px;margin-top:6px;font:11px/1.4 ui-monospace,monospace;
  background:#08030d;color:#9fe;border:1px solid rgba(217,79,144,.4);border-radius:6px;padding:6px}
.devpanel .pose{color:#9fe}
.devpanel .poses{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0 2px}
.devpanel .poses button{width:auto;flex:1 1 46%;margin:0;padding:4px 2px;font-size:11px}
.devpanel .poses button.on{background:rgba(217,79,144,.6);color:#fff}
`;

function slider(label, min, max, step, value, onInput) {
  const row = document.createElement('div');
  row.className = 'row';
  const l = document.createElement('label');
  l.textContent = label;
  const r = document.createElement('input');
  Object.assign(r, { type: 'range', min, max, step, value });
  const o = document.createElement('output');
  o.textContent = value;
  r.addEventListener('input', () => {
    const v = parseFloat(r.value);
    o.textContent = v;
    onInput(v);
  });
  row.append(l, r, o);
  return { row, set: (v) => { r.value = v; o.textContent = v; } };
}

export function initDevPanel(stage) {
  const style = document.createElement('style');
  style.textContent = PANEL_CSS;
  document.head.appendChild(style);

  const panel = document.createElement('div');
  panel.className = 'devpanel';
  document.body.appendChild(panel);

  const poseLabel = document.createElement('div');
  poseLabel.className = 'pose';
  panel.appendChild(poseLabel);

  // Jump straight to a pose. Without this you had to scroll to section 05 to
  // touch `prone`, and any slider you moved before that silently edited
  // whichever pose was on screen instead - which looks exactly like the panel
  // doing nothing.
  const poseRow = document.createElement('div');
  poseRow.className = 'poses';
  panel.appendChild(poseRow);
  const poseButtons = {};
  for (const name of stage.poseNames()) {
    const b = document.createElement('button');
    b.textContent = name;
    b.addEventListener('click', () => stage.setPose(name));
    poseRow.appendChild(b);
    poseButtons[name] = b;
  }

  /** Per-pose edits live here so switching sections does not lose your work. */
  const edits = {};
  const current = () => stage.devActivePose || 'idle';
  // Seed each pose's edits from what actually ships, so the sliders open on
  // the live value rather than zero - otherwise the first drag throws away the
  // configured rotation without showing that it did.
  const entry = () => (edits[current()] ??= stage.configuredRoot(current()));

  const apply = () => {
    const e = entry();
    stage.setRootOverride(e.x || e.y || e.z ? { ...e } : null);
  };

  const heading = (t) => {
    const h = document.createElement('h4');
    h.textContent = t;
    panel.appendChild(h);
  };

  heading('root rotation (deg)');
  const rootSliders = {};
  for (const axis of ['x', 'y', 'z']) {
    const s = slider(axis, -180, 180, 1, 0, (v) => { entry()[axis] = v; apply(); });
    rootSliders[axis] = s;
    panel.appendChild(s.row);
  }

  /** Pushes the current pose's stored values into the sliders. Camera reads
   *  from the stage because a pose may carry its own framing override. */
  function syncRoot() {
    const e = entry();
    for (const axis of ['x', 'y', 'z']) rootSliders[axis].set(e[axis] ?? 0);
    camDist?.set(+stage.targetCameraDistance.toFixed(2));
    camElev?.set(Math.round(stage.cameraElevation));
    camY?.set(+stage.lookTarget.y.toFixed(2));
  }

  heading('camera');
  const camDist = slider('dist', 0.8, 8, 0.05, stage.targetCameraDistance,
    (v) => { stage.targetCameraDistance = v; });
  const camElev = slider('elev', -30, 90, 1, stage.cameraElevation,
    (v) => { stage.cameraElevation = v; });
  const camY = slider('look y', 0, 2.2, 0.01, stage.lookTarget.y,
    (v) => { stage.lookTarget.y = v; });
  panel.append(camDist.row, camElev.row, camY.row);

  const reset = document.createElement('button');
  reset.textContent = 'Reset to shipped values';
  reset.addEventListener('click', () => {
    // Drop every pose's edits, not just the visible one - otherwise a pose you
    // tuned earlier stays modified and reappears the next time you switch to
    // it, which reads as Reset not having worked.
    for (const key of Object.keys(edits)) delete edits[key];
    stage.setRootOverride(null);
    stage.resetCamera();
    camDist.set(stage.targetCameraDistance);
    camElev.set(stage.cameraElevation);
    camY.set(stage.lookTarget.y);
    syncRoot();
    out.value = '';
  });
  panel.appendChild(reset);

  heading('output');
  const out = document.createElement('textarea');
  out.readOnly = true;
  const dump = document.createElement('button');
  dump.textContent = 'Dump config';
  dump.addEventListener('click', () => {
    const rootLines = Object.entries(edits)
      .filter(([, e]) => e.x || e.y || e.z)
      .map(([pose, e]) => {
        const parts = ['x', 'y', 'z'].filter((a) => e[a]).map((a) => `${a}: ${e[a]}`);
        return `  ${pose}: { ${parts.join(', ')} },`;
      });
    out.value = [
      '// src/3d/celeste-stage.js',
      'const POSE_ROOT = {',
      ...(rootLines.length ? rootLines : ['  // no root rotation set']),
      '};',
      '',
      '// POSE_CAMERA entry for the pose on screen',
      `  ${current()}: { lookY: ${stage.lookTarget.y.toFixed(2)}, `
        + `dist: ${stage.targetCameraDistance.toFixed(2)}, `
        + `elevation: ${Math.round(stage.cameraElevation)} },`,
    ].join('\n');
    out.select();
    try { document.execCommand('copy'); } catch { /* clipboard blocked; text is selectable */ }
  });
  panel.append(dump, out);

  /** Called by the stage on section change so the sliders track the pose. */
  return {
    onPose(name) {
      poseLabel.textContent = `pose: ${name || 'idle'}`;
      for (const [n, b] of Object.entries(poseButtons)) b.classList.toggle('on', n === name);
      syncRoot();
    },
  };
}
