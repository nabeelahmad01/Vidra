export const COLORS = {
  // App background: Pearl Lavender (soft, premium, not white)
  appBackground: '#EBF0FF',

  // Glassmorphism constants
  glassSurface: 'rgba(255, 255, 255, 0.44)',
  glassBorder: 'rgba(255, 255, 255, 0.75)',
  glassBorderWidth: 1.5,
  glassSpecularHighlight: 'rgba(255, 255, 255, 0.12)',
  glassShadowColor: '#7B8FFF',

  // Primary Gradient (Electric Teal -> Warm Coral)
  primaryGradient: ['#00E5A0', '#FF6B5A'] as const,
  primaryTeal: '#00E5A0',
  primaryCoral: '#FF6B5A',

  // Secondary Accent (Soft Indigo)
  secondaryAccent: '#7B8FFF',

  // Typography Palette (NOT black - Deep Navy & Muted Blue-Gray)
  textPrimary: '#1A1F3A',
  textSecondary: '#6B7494',

  // Status Indicators
  success: '#00C896', // teal variant
  error: '#FF5252',
  
  // Tab Bar State
  tabBarBackground: 'rgba(255, 255, 255, 0.85)',
  tabBarInactive: '#6B7494',
  
  // Ambient Glow Blur Coordinates Opacities
  glowTealOpacity: 0.10,
  glowCoralOpacity: 0.08,
  glowIndigoOpacity: 0.07
};
