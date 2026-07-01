import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, BackHandler } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from './src/theme/colors';
import { HomeScreen } from './src/screens/HomeScreen';
import { ResultsScreen } from './src/screens/ResultsScreen';
import { DownloadManagerScreen } from './src/screens/DownloadManagerScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { registerDevice, getJwtToken } from './src/api/client';
import { AdBannerPlaceholder } from './src/components/AdBannerPlaceholder';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'Home' | 'Results' | 'Downloads' | 'Settings'>('Home');
  const [navigationHistory, setNavigationHistory] = useState<string[]>(['Home']);
  const [resultsParams, setResultsParams] = useState<any>(null);

  // Auto register device on app start if token is missing
  useEffect(() => {
    const initAuth = async () => {
      const existingToken = await getJwtToken();
      if (!existingToken) {
        try {
          const deviceId = 'vidra_device_' + Math.random().toString(36).substring(2, 11);
          await registerDevice(deviceId);
          console.log('[App] Auto registered device.');
        } catch (err) {
          console.error('[App] Failed to auto register device:', err);
        }
      }
    };
    initAuth();
  }, []);

  // Custom Navigation methods
  const navigateTo = (screenName: typeof currentScreen, params?: any) => {
    if (screenName === 'Results' && params) {
      setResultsParams(params);
    }
    setNavigationHistory(prev => [...prev, screenName]);
    setCurrentScreen(screenName);
  };

  const goBack = () => {
    if (navigationHistory.length > 1) {
      const updatedHistory = [...navigationHistory];
      updatedHistory.pop(); // remove current
      const prevScreen = updatedHistory[updatedHistory.length - 1] as typeof currentScreen;
      setNavigationHistory(updatedHistory);
      setCurrentScreen(prevScreen);
    }
  };

  // Handle Android physical back button
  useEffect(() => {
    const handleBackButton = () => {
      if (navigationHistory.length > 1) {
        goBack();
        return true;
      }
      return false; // let system exit the app
    };

    BackHandler.addEventListener('hardwareBackPress', handleBackButton);
    return () => {
      BackHandler.removeEventListener('hardwareBackPress', handleBackButton);
    };
  }, [navigationHistory]);

  const mockNavigationObj = {
    navigate: (name: string, params?: any) => {
      navigateTo(name as any, params);
    },
    goBack: () => {
      goBack();
    }
  };

  const renderActiveScreen = () => {
    switch (currentScreen) {
      case 'Home':
        return <HomeScreen navigation={mockNavigationObj} />;
      case 'Results':
        return <ResultsScreen route={{ params: resultsParams }} navigation={mockNavigationObj} />;
      case 'Downloads':
        return <DownloadManagerScreen />;
      case 'Settings':
        return <SettingsScreen />;
      default:
        return <HomeScreen navigation={mockNavigationObj} />;
    }
  };

  const showTabBar = currentScreen !== 'Results';

  return (
    <View style={styles.container}>
      {/* Active Screen Viewport */}
      <View style={styles.viewport}>
        {renderActiveScreen()}
      </View>

      {/* APK Ad Banner Placement */}
      {showTabBar && (
        <AdBannerPlaceholder />
      )}

      {/* Floating Glass Bottom Tab Bar */}
      {showTabBar && (
        <View style={styles.tabBarWrapper}>
          <BlurView
            style={StyleSheet.absoluteFill}
            blurType="light"
            blurAmount={15}
            reducedTransparencyFallbackColor="#FFFFFF"
          />
          <View style={styles.tabBarInner}>
            {/* Tab: Home */}
            <TouchableOpacity 
              style={styles.tabItem} 
              onPress={() => navigateTo('Home')}
            >
              <Icon 
                name="home" 
                size={22} 
                color={currentScreen === 'Home' ? COLORS.primaryTeal : COLORS.tabBarInactive} 
              />
              {currentScreen === 'Home' && (
                <LinearGradient
                  colors={[COLORS.primaryTeal, COLORS.primaryCoral]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.activePill}
                />
              )}
            </TouchableOpacity>

            {/* Tab: Downloads */}
            <TouchableOpacity 
              style={styles.tabItem} 
              onPress={() => navigateTo('Downloads')}
            >
              <Icon 
                name="download" 
                size={22} 
                color={currentScreen === 'Downloads' ? COLORS.primaryTeal : COLORS.tabBarInactive} 
              />
              {currentScreen === 'Downloads' && (
                <LinearGradient
                  colors={[COLORS.primaryTeal, COLORS.primaryCoral]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.activePill}
                />
              )}
            </TouchableOpacity>

            {/* Tab: Settings */}
            <TouchableOpacity 
              style={styles.tabItem} 
              onPress={() => navigateTo('Settings')}
            >
              <Icon 
                name="settings" 
                size={22} 
                color={currentScreen === 'Settings' ? COLORS.primaryTeal : COLORS.tabBarInactive} 
              />
              {currentScreen === 'Settings' && (
                <LinearGradient
                  colors={[COLORS.primaryTeal, COLORS.primaryCoral]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.activePill}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.appBackground,
  },
  viewport: {
    flex: 1,
  },
  tabBarWrapper: {
    position: 'absolute',
    bottom: 12,
    left: 20,
    right: 20,
    height: 64,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: COLORS.tabBarBackground,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 1.5,
    shadowColor: COLORS.glassShadowColor,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  tabBarInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    width: 60,
    position: 'relative',
  },
  activePill: {
    position: 'absolute',
    bottom: 6,
    width: 14,
    height: 4,
    borderRadius: 2,
  }
});
