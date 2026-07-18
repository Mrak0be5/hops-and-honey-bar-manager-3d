export type IconName =
  | 'coins'
  | 'reputation'
  | 'customers'
  | 'time-speed'
  | 'move-speed'
  | 'order-speed'
  | 'prep-speed'
  | 'clean-speed'
  | 'assortment'
  | 'advertising'
  | 'cash'
  | 'upgrades'
  | 'upgrade-arrow'
  | 'pause'
  | 'play'
  | 'sound'
  | 'reset';

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
      draggable={false}
    />
  );
}
