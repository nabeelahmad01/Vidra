import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  Keyboard,
  Dimensions
} from 'react-native';

import Icon from 'react-native-vector-icons/Feather';
import LinearGradient from 'react-native-linear-gradient';
import { COLORS } from '../theme/colors';
import { GlassCard } from '../components/GlassCard';
import { AnimatedButton } from '../components/AnimatedButton';
import { useAppStore } from '../store/useAppStore';
import { startExtraction, validateUrlClient, checkExtractionStatus } from '../api/client';

const { width } = Dimensions.get('window');

export const HomeScreen = ({ navigation }: any) => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const addRecentLink = useAppStore((state) => state.addRecentLink);
  const recentLinks = useAppStore((state) => state.recentLinks);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Focus effect to cancel pending requests when leaving the screen
  useEffect(() => {
    abortControllerRef.current = new AbortController();
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleClearText = () => {
    setUrl('');
  };

  const handlePaste = async (inputUrl: string) => {
    setUrl(inputUrl);
  };

  const handleExtract = async (targetUrl: string) => {
    const checkUrl = targetUrl || url;
    if (!checkUrl) {
      Alert.alert('Error', 'Please enter a video URL');
      return;
    }

    if (!validateUrlClient(checkUrl)) {
      Alert.alert('Invalid URL', 'Only HTTP and HTTPS links are supported');
      return;
    }

    Keyboard.dismiss();
    setLoading(true);
    addRecentLink(checkUrl);

    try {
      const response = await startExtraction(checkUrl, abortControllerRef.current?.signal);
      
      if (response.status === 'completed' && response.result) {
        setLoading(false);
        navigation.navigate('Results', { extraction: response.result, originalUrl: checkUrl });
      } else if (response.status === 'pending' && response.jobId) {
        // Poll status
        pollExtractionStatus(response.jobId, checkUrl);
      } else {
        throw new Error('Unexpected server response format');
      }
    } catch (err: any) {
      if (err.name === 'CanceledError') return;
      setLoading(false);
      Alert.alert('Extraction Failed', err.response?.data?.error || err.message || 'Server error occurred');
    }
  };

  const pollExtractionStatus = async (jobId: string, originalUrl: string) => {
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max polling time

    const interval = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(interval);
        setLoading(false);
        Alert.alert('Timeout', 'The request timed out. Please try again.');
        return;
      }

      try {
        const response = await checkExtractionStatus(jobId, abortControllerRef.current?.signal);
        if (response.status === 'completed' && response.result) {
          clearInterval(interval);
          setLoading(false);
          navigation.navigate('Results', { extraction: response.result, originalUrl });
        } else if (response.status === 'failed') {
          clearInterval(interval);
          setLoading(false);
          Alert.alert('Extraction Failed', response.error || 'Server processing failed');
        }
      } catch (err: any) {
        if (err.name === 'CanceledError') {
          clearInterval(interval);
          return;
        }
        clearInterval(interval);
        setLoading(false);
        Alert.alert('Status Error', 'Failed to retrieve extraction status');
      }
    }, 1500);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Background Depth Ambient Circles */}
      <View style={[styles.glowCircle, styles.glowTeal]} />
      <View style={[styles.glowCircle, styles.glowCoral]} />
      <View style={[styles.glowCircle, styles.glowIndigo]} />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Wordmark Center Header */}
        <View style={styles.headerContainer}>
          <Text style={styles.subtitleText}>UNIVERSAL DOWNLOADER</Text>
          <Text style={styles.brandText}>Vidra</Text>
        </View>

        {/* URL Input Form */}
        <GlassCard style={styles.inputCard}>
          <View style={styles.inputWrapper}>
            <Icon name="link" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Paste video link here..."
              placeholderTextColor={COLORS.textSecondary}
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            {url.length > 0 && (
              <TouchableOpacity onPress={handleClearText}>
                <Icon name="x" size={20} color={COLORS.textSecondary} style={styles.clearIcon} />
              </TouchableOpacity>
            )}
          </View>
        </GlassCard>

        {/* Action Button */}
        <View style={styles.buttonWrapper}>
          <AnimatedButton
            title="Find Videos"
            loading={loading}
            onPress={() => handleExtract(url)}
          />
        </View>

        {/* History Chips Row */}
        {recentLinks.length > 0 && (
          <View style={styles.historyContainer}>
            <Text style={styles.historyTitle}>Recent Searches</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.historyScroll}
            >
              {recentLinks.map((link, idx) => {
                const displayUrl = link.replace(/^https?:\/\/(www\.)?/, '').substring(0, 20);
                return (
                  <TouchableOpacity
                    key={`${link}-${idx}`}
                    style={styles.chip}
                    onPress={() => {
                      setUrl(link);
                      handleExtract(link);
                    }}
                  >
                    <Icon name="clock" size={12} color={COLORS.primaryTeal} style={styles.chipIcon} />
                    <Text style={styles.chipText} numberOfLines={1}>
                      {displayUrl}...
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.appBackground,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
    paddingBottom: 80,
  },
  // Depth Layer Ambient Glow styles
  glowCircle: {
    position: 'absolute',
    borderRadius: 999,
    pointerEvents: 'none',
  },
  glowTeal: {
    top: -50,
    left: -50,
    width: 200,
    height: 200,
    backgroundColor: COLORS.primaryTeal,
    opacity: COLORS.glowTealOpacity,
  },
  glowCoral: {
    bottom: 50,
    right: -50,
    width: 190,
    height: 190,
    backgroundColor: COLORS.primaryCoral,
    opacity: COLORS.glowCoralOpacity,
  },
  glowIndigo: {
    top: 100,
    right: -30,
    width: 100,
    height: 100,
    backgroundColor: COLORS.secondaryAccent,
    opacity: COLORS.glowIndigoOpacity,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  brandText: {
    fontSize: 64,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: -2,
    fontFamily: 'Inter-Black',
  },
  subtitleText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.secondaryAccent,
    letterSpacing: 2,
    marginBottom: 8,
    fontFamily: 'Inter-Bold',
  },
  inputCard: {
    marginBottom: 16,
    padding: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  clearIcon: {
    marginLeft: 10,
  },
  buttonWrapper: {
    width: '100%',
    marginBottom: 30,
  },
  historyContainer: {
    marginTop: 10,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 12,
    fontFamily: 'Inter-Bold',
  },
  historyScroll: {
    paddingRight: 20,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.glassSurface,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 160, 0.4)', // Teal border
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 10,
    shadowColor: COLORS.glassShadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  chipIcon: {
    marginRight: 6,
  },
  chipText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
});
