import { StarType } from '../core/types';

export interface Theme {
  name: string;
  colors: {
    bg: string;
    text: string;
    dimText: string;
    accent: string;
    border: string;
    rulerArrow: string;
    tradeRoute: string;
    alliance: string;
    war: string;
    selectionRing: string;
    starColors: Record<StarType, string>;
    ui: {
      panelBg: string;
      panelBorder: string;
      header: string;
      tabActiveBg: string;
      tabActiveBorder: string;
      tabInactiveBg: string;
      tabInactiveBorder: string;
      tabTextActive: string;
      tabTextInactive: string;
      listHeader: string;
      success: string;
      warning: string;
      danger: string;
      info: string;
    };
  };
  effects: {
    enableGlow: boolean;
    enableShadows: boolean;
    starSizeMultiplier: number;
    lineWidthMultiplier: number;
    fontSizeMultiplier: number;
    font: string;
    useGradients: boolean;
  };
}

export const THEME_FOUNDATION: Theme = {
  name: 'foundation',
  colors: {
    bg: '#000000',
    text: '#00ffff',
    dimText: '#88bbdd',
    accent: '#00ffff',
    border: '#00ffff',
    rulerArrow: '#2299dd',
    tradeRoute: 'rgba(255, 204, 88, 0.50)',
    alliance: 'rgba(88, 255, 88, 0.2)',
    war: 'rgba(255, 50, 50, 0.3)',
    selectionRing: 'rgba(0, 255, 255, 0.5)',
    starColors: {
      [StarType.BlueGiant]: '#4477FF',
      [StarType.YellowDwarf]: '#FFDD44',
      [StarType.RedDwarf]: '#DD4444',
      [StarType.RedGiant]: '#FF6633',
      [StarType.WhiteDwarf]: '#EEFFFF',
      [StarType.Binary]: '#FF88DD',
    },
    ui: {
      panelBg: '#000000',
      panelBorder: '#003355',
      header: '#00ffff',
      tabActiveBg: '#003366',
      tabActiveBorder: '#0088ff',
      tabInactiveBg: '#001122',
      tabInactiveBorder: '#003355',
      tabTextActive: '#00ffff',
      tabTextInactive: '#4477aa',
      listHeader: '#4477aa',
      success: '#00ff88',
      warning: '#ffcc58',
      danger: '#ff4444',
      info: '#0088ff'
    }
  },
  effects: {
    enableGlow: true,
    enableShadows: true,
    starSizeMultiplier: 1.0,
    lineWidthMultiplier: 1.0,
    fontSizeMultiplier: 1.0,
    font: '"Courier New"',
    useGradients: true
  }
};

export const THEME_ZX: Theme = {
  name: 'zx',
  colors: {
    bg: '#000000',
    text: '#FFFF00', // Yellow text
    dimText: '#00FFFF', // Cyan text
    accent: '#FFFF00',
    border: '#FFFF00',
    rulerArrow: '#0000D7', // Blue
    tradeRoute: '#D7D700', // Yellow
    alliance: '#00D700',   // Green
    war: '#D70000',        // Red
    selectionRing: '#FFFFFF',
    starColors: {
      [StarType.BlueGiant]: '#00FFFF',   // Cyan
      [StarType.YellowDwarf]: '#FFFF00', // Yellow
      [StarType.RedDwarf]: '#D70000',    // Red
      [StarType.RedGiant]: '#D700D7',    // Magenta
      [StarType.WhiteDwarf]: '#FFFFFF',  // White
      [StarType.Binary]: '#00D700',      // Green
    },
    ui: {
      panelBg: '#000000',
      panelBorder: '#FFFF00',
      header: '#FFFF00',
      tabActiveBg: '#0000D7', // Blue
      tabActiveBorder: '#FFFF00',
      tabInactiveBg: '#000000',
      tabInactiveBorder: '#D7D7D7', // White
      tabTextActive: '#FFFF00',
      tabTextInactive: '#D7D7D7',
      listHeader: '#00FFFF', // Cyan
      success: '#00D700',
      warning: '#FFFF00',
      danger: '#D70000',
      info: '#00FFFF'
    }
  },
  effects: {
    enableGlow: false,
    enableShadows: false,
    starSizeMultiplier: 1.2, // Slightly blockier/larger
    lineWidthMultiplier: 1.5,
    fontSizeMultiplier: 1.4,
    font: '"Courier New"', // Keep Courier
    useGradients: false
  }
};
