import { useCallback, useEffect, useRef, useState } from 'react';
import { BarScene } from './components/BarScene';
import { gameAudio } from './game/audio';
import { gameEngine } from './game/GameEngine';
import { useGameSnapshot } from './game/useGameSnapshot';
import { Hud } from './ui/Hud';
import { Icon, preloadUiIcons } from './ui/Icon';
import type { VenueView } from './game/types';

export type SheetMode = null | 'manage' | 'staff';

const IPHONE_FRAME_KEY = 'brothel-iphone-9-16';

export default function App() {
  const snapshot = useGameSnapshot(gameEngine);
  const [contextLost, setContextLost] = useState(false);
  const [venueView, setVenueView] = useState<VenueView>('bar');
  const [sheetMode, setSheetMode] = useState<SheetMode>(null);
  const [iphoneFrame, setIphoneFrame] = useState(() => {
    try {
      return localStorage.getItem(IPHONE_FRAME_KEY) === '1';
    } catch {
      return false;
    }
  });
  const lastSoundEvent = useRef(0);
  const handleContextLost = useCallback(() => setContextLost(true), []);

  const toggleIphoneFrame = useCallback(() => {
    setIphoneFrame((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(IPHONE_FRAME_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const openManage = useCallback((view?: VenueView) => {
    if (view) setVenueView(view);
    setSheetMode('manage');
  }, []);

  useEffect(() => {
    preloadUiIcons();
  }, []);

  useEffect(() => {
    gameAudio.setEnabled(snapshot.soundEnabled, false);
  }, [snapshot.soundEnabled]);

  useEffect(() => {
    if (snapshot.started) return;
    setSheetMode(null);
    setVenueView('bar');
  }, [snapshot.started]);

  useEffect(() => {
    if (!snapshot.lastEvent || snapshot.lastEvent.id === lastSoundEvent.current) return;
    lastSoundEvent.current = snapshot.lastEvent.id;
    if (snapshot.started) gameAudio.event(snapshot.lastEvent);
  }, [snapshot.lastEvent, snapshot.started]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (event.ctrlKey && event.shiftKey && event.code === 'KeyM') {
        event.preventDefault();
        gameEngine.cheatMoney(99_999_999);
      } else if (event.ctrlKey && event.shiftKey && event.code === 'KeyR') {
        event.preventDefault();
        gameEngine.cheatRich();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    const api = {
      money: (amount = 99_999_999) => gameEngine.cheatMoney(amount),
      rich: () => gameEngine.cheatRich(),
    };
    (window as Window & { brothelCheats?: typeof api }).brothelCheats = api;
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      delete (window as Window & { brothelCheats?: typeof api }).brothelCheats;
    };
  }, []);

  return (
    <div className={`app-stage ${iphoneFrame ? 'is-iphone-frame' : ''}`}>
      <main className="game-shell">
        {contextLost ? (
          <div className="webgl-fallback">
            <Icon name="reset" />
            <h1>3D-сцена остановилась</h1>
            <p>Браузер потерял WebGL-контекст. Прогресс уже сохранён — можно безопасно перезапустить сцену.</p>
            <button onClick={() => window.location.reload()}>
              <Icon name="reset" />
              Перезапустить
            </button>
          </div>
        ) : (
          <BarScene
            engine={gameEngine}
            snapshot={snapshot}
            focus={venueView}
            developmentOpen={sheetMode !== null}
            onContextLost={handleContextLost}
            onSelectVenueManage={openManage}
          />
        )}
        <Hud
          engine={gameEngine}
          snapshot={snapshot}
          venueView={venueView}
          onVenueView={setVenueView}
          sheetMode={sheetMode}
          onSheetMode={setSheetMode}
          iphoneFrame={iphoneFrame}
          onToggleIphoneFrame={toggleIphoneFrame}
        />
        <div className="scene-vignette" />
      </main>
    </div>
  );
}
