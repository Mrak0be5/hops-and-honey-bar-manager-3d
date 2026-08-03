import { describe, expect, it } from 'vitest';
import { getPoseTargets } from '../../src/v2/render/AmberCharacter';
import { getCameraFrame, getVenueCenter } from '../../src/v2/render/layout';
import { formatAmberNumber } from '../../src/v2/ui/AmberHud';
import { clampProgress } from '../../src/v2/view/model';

describe('Amber Club visual helpers', () => {
  it('keeps progress values safe for CSS and ARIA', () => {
    expect(clampProgress(-4)).toBe(0);
    expect(clampProgress(0.45)).toBe(0.45);
    expect(clampProgress(3)).toBe(1);
    expect(clampProgress(Number.NaN)).toBe(0);
  });

  it('returns copies of venue positions', () => {
    const first = getVenueCenter('karaoke');
    first.x = 999;
    expect(getVenueCenter('karaoke')).toEqual({ x: -15, z: 0 });
  });

  it('frames a focused room closer than the full bar', () => {
    const bar = getCameraFrame('bar', 1280, 720, false);
    const sauna = getCameraFrame('sauna', 1280, 720, false);
    const drawer = getCameraFrame('sauna', 1280, 720, true);

    expect(sauna.zoom).toBeGreaterThan(bar.zoom);
    expect(drawer.lookAt[0]).toBeLessThan(sauna.lookAt[0]);
  });

  it('uses opposing limbs for a readable walk cycle', () => {
    const pose = getPoseTargets('walk', Math.PI / 2);
    expect(pose.leftShoulderX).toBeCloseTo(-pose.rightShoulderX);
    expect(pose.leftHipX).toBeCloseTo(-pose.rightHipX);
    expect(pose.leftShoulderX).toBeGreaterThan(0);
  });

  it('never exposes invalid resource text', () => {
    expect(formatAmberNumber(Number.NaN)).not.toMatch(/NaN/);
    expect(formatAmberNumber(-10)).toBe(formatAmberNumber(0));
  });
});
