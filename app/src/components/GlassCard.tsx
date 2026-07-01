import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { COLORS } from '../theme/colors';

interface GlassCardProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, style }) => {
  return (
    <View style={[styles.card, style]}>
      {/* Specular highlight: light catching strip at the top (30% of card) */}
      <View style={styles.specularHighlight} />
      
      {/* Content wrapper */}
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.glassSurface,
    borderColor: COLORS.glassBorder,
    borderWidth: COLORS.glassBorderWidth,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    
    // Spec shadow values
    shadowColor: COLORS.glassShadowColor,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 4,
  },
  specularHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '30%',
    backgroundColor: COLORS.glassSpecularHighlight,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    pointerEvents: 'none'
  },
  content: {
    padding: 16,
    zIndex: 1
  }
});
