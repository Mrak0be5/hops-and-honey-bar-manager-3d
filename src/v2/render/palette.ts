export const AMBER_PALETTE = {
  spruce: '#123b3b',
  spruceDeep: '#092d30',
  plaster: '#f3e7d3',
  cream: '#fff4dc',
  honey: '#f4b740',
  honeyLight: '#ffd77c',
  terracotta: '#c85c3c',
  teal: '#2b7a78',
  tealLight: '#74c6b7',
  charcoal: '#232629',
  walnut: '#6f4433',
  oak: '#c78345',
  brass: '#c79636',
  karaoke: '#6b4cc2',
  karaokeHot: '#d8589d',
  karaokeBlue: '#6bd6e8',
  sauna: '#c78345',
  saunaLight: '#f3c56d',
  massage: '#4f9f85',
  massageLight: '#a5d8c8',
  warning: '#e4574d',
  shadow: '#142d2f',
  backdrop: '#9ecdc4',
} as const;

export const AMBER_MATERIAL = {
  plaster: { color: AMBER_PALETTE.plaster, roughness: 0.88, metalness: 0.01 },
  darkWood: { color: AMBER_PALETTE.walnut, roughness: 0.7, metalness: 0.02 },
  oak: { color: AMBER_PALETTE.oak, roughness: 0.72, metalness: 0.02 },
  brass: { color: AMBER_PALETTE.brass, roughness: 0.3, metalness: 0.72 },
  upholstery: { color: AMBER_PALETTE.teal, roughness: 0.82, metalness: 0 },
  stone: { color: '#7b847b', roughness: 0.94, metalness: 0 },
} as const;

export const ROOM_ACCENTS = {
  karaoke: AMBER_PALETTE.karaokeHot,
  sauna: AMBER_PALETTE.saunaLight,
  massage: AMBER_PALETTE.massageLight,
} as const;
