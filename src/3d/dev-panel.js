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

  /** Per-pose edits live here so switching sections does not lose your work. */
  const edits = {};
  const current = () => stage.devActivePose || 'idle';
  const entry = () => (edits[current()] ??= { x: 0, y: 0, z: 0 });

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

  heading('camera');
  const camDist = slider('dist', 0.8, 8, 0.05, stage.targetCameraDistance,
    (v) => { stage.targetCameraDistance = v; });
  const camElev = slider('elev', -30, 90, 1, stage.cameraElevation,
    (v) => { stage.cameraElevation = v; });
  const camY = slider('look y', 0, 2.2, 0.01, stage.lookTarget.y,
    (v) => { stage.lookTarget.y = v; });
  panel.append(camDist.row, camElev.row, camY.row);

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
      `// camera defaults`,
      `lookTarget = new THREE.Vector3(0, ${stage.lookTarget.y.toFixed(2)}, 0);`,
      `targetCameraDistance = ${stage.targetCameraDistance.toFixed(2)};`,
      `cameraElevation = ${Math.round(stage.cameraElevation)};`,
    ].join('\n');
    out.select();
    try { document.execCommand('copy'); } catch { /* clipboard blocked; text is selectable */ }
  });
  panel.append(dump, out);

  /** Called by the stage on section change so the sliders track the pose. */
  return {
    onPose(name) {
      poseLabel.textContent = `pose: ${name || 'idle'}`;
      const e = entry();
      for (const axis of ['x', 'y', 'z']) rootSliders[axis].set(e[axis] ?? 0);
    },
  };
}
