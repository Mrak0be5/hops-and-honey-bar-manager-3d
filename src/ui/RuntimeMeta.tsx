import { useSyncExternalStore } from 'react';
import packageJson from '../../package.json';
import {
  getFrameRateSnapshot,
  subscribeToFrameRate,
} from '../performance/frameRateStore';

export const GAME_VERSION = packageJson.version;

export function RuntimeMeta() {
  const frameRate = useSyncExternalStore(
    subscribeToFrameRate,
    getFrameRateSnapshot,
    getFrameRateSnapshot,
  );

  return (
    <div className="runtime-meta" aria-label="Техническая информация игры">
      <output
        className="runtime-badge fps-counter"
        data-fps={frameRate ?? ''}
        aria-label={frameRate === null ? 'Частота кадров: измерение' : `Частота кадров: ${frameRate} FPS`}
        aria-live="off"
      >
        <b>{frameRate ?? '—'}</b> FPS
      </output>
      <span className="runtime-badge game-version" aria-label={`Версия игры ${GAME_VERSION}`}>
        v{GAME_VERSION}
      </span>
    </div>
  );
}
