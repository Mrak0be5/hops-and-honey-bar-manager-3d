import { useCallback, useEffect, useRef, useState } from 'react';
import { BarScene } from './components/BarScene';
import { gameAudio } from './game/audio';
import { gameEngine } from './game/GameEngine';
import { useGameSnapshot } from './game/useGameSnapshot';
import { Hud } from './ui/Hud';
import { Icon, preloadUiIcons } from './ui/Icon';
import type { VenueView } from './game/types';

export default function App() {
  const snapshot = useGameSnapshot(gameEngine);
  const [contextLost, setContextLost] = useState(false);
  const [venueView, setVenueView] = useState<VenueView>('bar');
  const [upgradesOpen, setUpgradesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [portraitPreview, setPortraitPreview] = useState(false);
  const lastSoundEvent = useRef(0);
  const handleContextLost = useCallback(() => setContextLost(true), []);

  useEffect(() => {
    preloadUiIcons();
  }, []);

  useEffect(() => {
    gameAudio.setEnabled(snapshot.soundEnabled, false);
  }, [snapshot.soundEnabled]);

  useEffect(() => {
    if (snapshot.started) return;
    setUpgradesOpen(false);
    setSettingsOpen(false);
    setVenueView('bar');
  }, [snapshot.started]);

  useEffect(() => {
    if (!snapshot.lastEvent || snapshot.lastEvent.id === lastSoundEvent.current) return;
    lastSoundEvent.current = snapshot.lastEvent.id;
    if (snapshot.started) gameAudio.event(snapshot.lastEvent);
  }, [snapshot.lastEvent, snapshot.started]);

  const togglePortraitPreview = () => {
    gameAudio.setEnabled(snapshot.soundEnabled);
    gameAudio.click();
    setPortraitPreview((enabled) => !enabled);
  };

  const handleUpgradesOpen = useCallback((open: boolean) => {
    setUpgradesOpen(open);
    if (!open && venueView !== 'bar' && !snapshot.rooms.find((room) => room.id === venueView)?.unlocked) {
      setVenueView('bar');
    }
    if (open) setSettingsOpen(false);
  }, [snapshot.rooms, venueView]);

  const handleSettingsOpen = useCallback((open: boolean) => {
    setSettingsOpen(open);
    if (open) {
      setUpgradesOpen(false);
      if (venueView !== 'bar' && !snapshot.rooms.find((room) => room.id === venueView)?.unlocked) {
        setVenueView('bar');
      }
    }
  }, [snapshot.rooms, venueView]);

  return (
    <div className={`app-stage ${portraitPreview ? 'is-portrait-preview' : ''} ${upgradesOpen || settingsOpen ? 'is-menu-open' : ''}`}>
      <main className="game-shell" data-viewport-mode={portraitPreview ? 'portrait' : 'adaptive'}>
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
            developmentOpen={upgradesOpen}
            onContextLost={handleContextLost}
          />
        )}
        <Hud
          engine={gameEngine}
          snapshot={snapshot}
          venueView={venueView}
          onVenueView={setVenueView}
          upgradesOpen={upgradesOpen}
          onUpgradesOpen={handleUpgradesOpen}
          settingsOpen={settingsOpen}
          onSettingsOpen={handleSettingsOpen}
        />
        <div className="scene-vignette" />
      </main>

      <button
        type="button"
        className={`viewport-mode-toggle ${portraitPreview ? 'is-active' : ''}`}
        onClick={togglePortraitPreview}
        aria-label={portraitPreview ? 'Вернуть адаптивный вид' : 'Включить вид 9:16'}
        aria-pressed={portraitPreview}
        title={portraitPreview ? 'Вернуть адаптивный вид' : 'Показать интерфейс iPhone в формате 9:16'}
      >
        <span className="viewport-mode-device" aria-hidden="true"><i>9:16</i></span>
        <span className="viewport-mode-copy">
          <strong>{portraitPreview ? 'Авто' : '9:16'}</strong>
          <small>{portraitPreview ? 'Во весь экран' : 'Вид iPhone'}</small>
        </span>
      </button>
    </div>
  );
}
