import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../theme/colors';

interface AdBannerPlaceholderProps {
  size?: 'banner' | 'largeBanner';
}

export const AdBannerPlaceholder: React.FC<AdBannerPlaceholderProps> = ({
  size = 'banner'
}) => {
  const isLarge = size === 'largeBanner';

  return (
    <View style={[styles.adContainer, isLarge && styles.largeContainer]}>
      {/* Top Specular glass reflect */}
      <View style={styles.specularHighlight} />
      
      <View style={styles.adInner}>
        <Text style={styles.adTag}>SPONSORED ADVERTISEMENT</Text>
        <Text style={styles.adContent}>Ad banner slot placeholder (App APK Monetization)</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  adContainer: {
    backgroundColor: COLORS.glassSurface,
    borderColor: COLORS.glassBorder,
    borderWidth: COLORS.glassBorderWidth,
    borderRadius: 16,
    height: 60,
    marginHorizontal: 20,
    marginBottom: 88, // Ensure it sits cleanly above the floating bottom tab bar (height 64 + margins)
    overflow: 'hidden',
    position: 'relative',
    
    shadowColor: COLORS.glassShadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  largeContainer: {
    height: 100,
  },
  specularHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: COLORS.glassSpecularHighlight,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    pointerEvents: 'none',
  },
  adInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
    zIndex: 1,
  },
  adTag: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.secondaryAccent,
    letterSpacing: 1.5,
    marginBottom: 4,
    fontFamily: 'Inter-Bold',
  },
  adContent: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    fontFamily: 'Inter-SemiBold',
  }
});
