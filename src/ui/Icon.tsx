export const UI_ICON_NAMES = [
  'coins',
  'reputation',
  'customers',
  'time-speed',
  'move-speed',
  'order-speed',
  'prep-speed',
  'clean-speed',
  'assortment',
  'advertising',
  'cash',
  'upgrades',
  'upgrade-arrow',
  'pause',
  'play',
  'sound',
  'reset',
] as const;

export type IconName = (typeof UI_ICON_NAMES)[number];

let preloadedUiIcons: HTMLImageElement[] | null = null;

export function preloadUiIcons() {
  if (preloadedUiIcons || typeof Image === 'undefined') return;
  preloadedUiIcons = UI_ICON_NAMES.map((name) => {
    const image = new Image(64, 64);
    image.decoding = 'async';
    image.loading = 'eager';
    image.src = `${import.meta.env.BASE_URL}assets/ui/${name}.webp`;
    void image.decode().catch(() => undefined);
    return image;
  });
}

type Props = {
  name: IconName | string;
  alt?: string;
  className?: string;
};

export function Icon({ name, alt = '', className = '' }: Props) {
  return (
    <img
      className={`game-icon ${className}`.trim()}
      src={`${import.meta.env.BASE_URL}assets/ui/${name}.webp`}
      alt={alt}
      width={64}
      height={64}
      decoding="async"
      loading="eager"
      draggable={false}
    />
  );
}
