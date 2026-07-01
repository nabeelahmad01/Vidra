import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../theme/colors';
import { GlassCard } from '../components/GlassCard';
import { CustomDropdown } from '../components/CustomDropdown';
import { useAppStore } from '../store/useAppStore';
import { getBaseUrl, setBaseUrl, registerDevice } from '../api/client';

export const SettingsScreen = () => {
  const defaultQuality = useAppStore((state) => state.defaultQuality);
  const setDefaultQuality = useAppStore((state) => state.setDefaultQuality);
  const downloadDirectory = useAppStore((state) => state.downloadDirectory);
  const setDownloadDirectory = useAppStore((state) => state.setDownloadDirectory);
  const clearRecentLinks = useAppStore((state) => state.clearRecentLinks);
  const clearCompletedDownloads = useAppStore((state) => state.clearCompletedDownloads);

  const [apiUrl, setApiUrlState] = useState(getBaseUrl());
  const [qualityDropdownVisible, setQualityDropdownVisible] = useState(false);
  const [registering, setRegistering] = useState(false);

  const handleSaveApiUrl = () => {
    if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
      Alert.alert('Invalid URL', 'API server address must start with http:// or https://');
      return;
    }

    setBaseUrl(apiUrl);
    Alert.alert('Saved', 'API server address updated successfully.');
  };

  const handleRegisterDevice = async () => {
    setRegistering(true);
    try {
      const randomId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      await registerDevice(randomId);
      Alert.alert('Device Registered', 'Successfully generated and saved signed JWT authorization credentials.');
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message || 'Could not connect to API server.');
    } finally {
      setRegistering(false);
    }
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Clear History',
      'Are you sure you want to clear your search history and recent links?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: () => {
            clearRecentLinks();
            Alert.alert('Success', 'Search history cleared.');
          }
        }
      ]
    );
  };

  const handleClearDownloads = () => {
    Alert.alert(
      'Clear Downloads Cache',
      'Are you sure you want to clear your completed downloads list from the app history? This will NOT delete the actual files from your device storage.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: () => {
            clearCompletedDownloads();
            Alert.alert('Success', 'Downloads history cleared.');
          }
        }
      ]
    );
  };

  const qualityItems = [
    { label: 'Highest Available (2160p/1080p)', value: 'best' },
    { label: 'High Definition (1080p)', value: '1080p' },
    { label: 'Standard Definition (720p)', value: '720p' },
    { label: 'Medium Definition (480p)', value: '480p' },
    { label: 'Low Quality (360p)', value: '360p' }
  ];

  const activeQualityLabel = qualityItems.find(q => q.value === defaultQuality)?.label || '1080p';

  return (
    <SafeAreaView style={styles.container}>
      {/* Background Depth Ambient Circles */}
      <View style={[styles.glowCircle, styles.glowTeal]} />
      <View style={[styles.glowCircle, styles.glowCoral]} />
      <View style={[styles.glowCircle, styles.glowIndigo]} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.headerTitle}>Settings</Text>

        {/* Server & API Settings */}
        <Text style={styles.sectionHeader}>Server Configuration</Text>
        <GlassCard style={styles.settingsCard}>
          <Text style={styles.settingLabel}>API Server URL</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.apiInput}
              value={apiUrl}
              onChangeText={setApiUrlState}
              placeholder="http://10.0.2.2:3000/api"
              placeholderTextColor={COLORS.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.saveButton} onPress={handleSaveApiUrl}>
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[styles.registerButton, registering && styles.disabled]} 
            onPress={handleRegisterDevice}
            disabled={registering}
          >
            <Icon name="key" size={16} color="#FFFFFF" style={styles.buttonIcon} />
            <Text style={styles.registerButtonText}>
              {registering ? 'Authorizing...' : 'Register Device & Get JWT'}
            </Text>
          </TouchableOpacity>
        </GlassCard>

        {/* Preferences */}
        <Text style={styles.sectionHeader}>Preferences</Text>
        <GlassCard style={styles.settingsCard}>
          {/* Quality Choice */}
          <TouchableOpacity 
            style={styles.rowItem} 
            onPress={() => setQualityDropdownVisible(true)}
          >
            <View style={styles.rowLeft}>
              <Icon name="sliders" size={20} color={COLORS.primaryTeal} style={styles.settingIcon} />
              <View>
                <Text style={styles.rowTitle}>Default Quality</Text>
                <Text style={styles.rowValue}>{activeQualityLabel}</Text>
              </View>
            </View>
            <Icon name="chevron-right" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Folder Path */}
          <View style={styles.rowItem}>
            <View style={styles.rowLeft}>
              <Icon name="folder" size={20} color={COLORS.primaryTeal} style={styles.settingIcon} />
              <View style={styles.folderTextContainer}>
                <Text style={styles.rowTitle}>Download Directory</Text>
                <TextInput
                  style={styles.folderInput}
                  value={downloadDirectory}
                  onChangeText={setDownloadDirectory}
                  placeholder="/storage/emulated/0/Download/Vidra"
                  placeholderTextColor={COLORS.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>
          </View>
        </GlassCard>

        {/* Maintenance / Cache */}
        <Text style={styles.sectionHeader}>History & Maintenance</Text>
        <GlassCard style={styles.settingsCard}>
          <TouchableOpacity style={styles.rowItem} onPress={handleClearHistory}>
            <View style={styles.rowLeft}>
              <Icon name="trash-2" size={20} color={COLORS.error} style={styles.settingIcon} />
              <Text style={styles.rowTitle}>Clear Search History</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.rowItem} onPress={handleClearDownloads}>
            <View style={styles.rowLeft}>
              <Icon name="database" size={20} color={COLORS.error} style={styles.settingIcon} />
              <Text style={styles.rowTitle}>Clear Downloads History</Text>
            </View>
          </TouchableOpacity>
        </GlassCard>

        {/* About App */}
        <Text style={styles.sectionHeader}>About</Text>
        <GlassCard style={styles.settingsCard}>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Version</Text>
            <Text style={styles.aboutValue}>1.0.0 (APK Distribution)</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>License</Text>
            <Text style={styles.aboutValue}>Production-grade Proprietary</Text>
          </View>
        </GlassCard>
      </ScrollView>

      {/* Quality Picker custom bottom sheet dropdown */}
      <CustomDropdown
        visible={qualityDropdownVisible}
        onClose={() => setQualityDropdownVisible(false)}
        title="Select Default Quality"
        items={qualityItems}
        selectedItemValue={defaultQuality}
        onSelect={setDefaultQuality}
      />
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 100,
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
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 24,
    fontFamily: 'Inter-Bold',
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.secondaryAccent,
    letterSpacing: 1.5,
    marginTop: 20,
    marginBottom: 10,
    textTransform: 'uppercase',
    fontFamily: 'Inter-Bold',
  },
  settingsCard: {
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 8,
    fontFamily: 'Inter-SemiBold',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  apiInput: {
    flex: 1,
    height: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 15,
    color: COLORS.textPrimary,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1,
    fontFamily: 'Inter-Regular',
  },
  saveButton: {
    marginLeft: 12,
    backgroundColor: COLORS.primaryTeal,
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
    fontFamily: 'Inter-Bold',
  },
  registerButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.secondaryAccent,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonIcon: {
    marginRight: 8,
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
    fontFamily: 'Inter-Bold',
  },
  rowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    marginRight: 16,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    fontFamily: 'Inter-SemiBold',
  },
  rowValue: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontFamily: 'Inter-Regular',
  },
  folderTextContainer: {
    flex: 1,
  },
  folderInput: {
    fontSize: 14,
    color: COLORS.textSecondary,
    padding: 0,
    marginTop: 4,
    height: 20,
    fontFamily: 'Inter-Regular',
  },
  divider: {
    height: 0.5,
    backgroundColor: 'rgba(123, 143, 255, 0.15)',
    marginVertical: 4,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  aboutLabel: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontWeight: '500',
    fontFamily: 'Inter-Medium',
  },
  aboutValue: {
    fontSize: 15,
    color: COLORS.textSecondary,
    fontFamily: 'Inter-Regular',
  },
  disabled: {
    opacity: 0.5,
  }
});
