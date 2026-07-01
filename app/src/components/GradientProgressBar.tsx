import React, { useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { COLORS } from '../theme/colors';

interface GradientProgressBarProps {
  progress: number; // 0 to 100
  showLabel?: boolean;
}

export const GradientProgressBar: React.FC<GradientProgressBarProps> = ({
  progress,
  showLabel = true
}) => {
  const animatedProgress = useSharedValue(0);

  useEffect(() => {
    // Keep bounds safe
    const clampedProgress = Math.max(0, Math.min(100, progress));
    animatedProgress.value = withSpring(clampedProgress, {
      stiffness: 100,
      damping: 15
    });
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      width: `${animatedProgress.value}%`
    };
  });

  return (
    <View style={styles.container}>
      <View style={styles.track}>
        <Animated.View style={[styles.progressIndicator, animatedStyle]}>
          <LinearGradient
            colors={[COLORS.primaryTeal, COLORS.primaryCoral]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradient}
          />
        </Animated.View>
      </View>
      {showLabel && (
        <Text style={styles.label}>{Math.round(progress)}%</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  track: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  progressIndicator: {
    height: '100%',
    borderRadius: 4,
    overflow: 'hidden',
  },
  gradient: {
    width: '100%',
    height: '100%',
  },
  label: {
    marginLeft: 10,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    minWidth: 35,
    textAlign: 'right',
    fontFamily: 'Inter-Bold',
  }
});
