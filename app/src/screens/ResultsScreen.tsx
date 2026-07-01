import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal
} from 'react-native';

import Icon from 'react-native-vector-icons/Feather';
import { FlashList } from '@shopify/flash-list';
import RNFS from 'react-native-fs';
import RNBackgroundDownloader from '@kesha-antonov/react-native-background-downloader';
import { FFmpegKit } from 'ffmpeg-kit-react-native';
import { COLORS } from '../theme/colors';
import { GlassCard } from '../components/GlassCard';
import { AnimatedButton } from '../components/AnimatedButton';
import { CustomDropdown, DropdownItem } from '../components/CustomDropdown';
import { useAppStore, DownloadTask } from '../store/useAppStore';
import { prepareDownload, checkPrepareStatus } from '../api/client';

export const ResultsScreen = ({ route, navigation }: any) => {
  const { extraction, originalUrl } = route.params;
  const { title, thumbnail, sourcePlatform, videos = [] } = extraction;

  const [selectedFormatId, setSelectedFormatId] = useState(videos[0]?.formatId || '');
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [prepareProgress, setPrepareProgress] = useState('');

  const addDownloadTask = useAppStore((state) => state.addDownloadTask);
  const updateDownloadProgress = useAppStore((state) => state.updateDownloadProgress);
  const updateDownloadStatus = useAppStore((state) => state.updateDownloadStatus);
  const downloadDirectory = useAppStore((state) => state.downloadDirectory);
  const addCompletedDownload = useAppStore((state) => state.addCompletedDownload);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortControllerRef.current = new AbortController();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const selectedVideo = videos.find((v: any) => v.formatId === selectedFormatId) || videos[0];

  const formatSize = (bytes?: number) => {
    if (!bytes) return 'Size unknown';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  // Convert formats list to dropdown options
  const dropdownItems: DropdownItem[] = videos.map((v: any) => {
    const mergeText = v.requiresMerge ? ' • Needs Merge' : '';
    const sizeText = formatSize(v.sizeEstimate);
    return {
      label: `${v.quality} (${v.format})`,
      subLabel: `${sizeText}${mergeText}`,
      value: v.formatId
    };
  });

  const handleDownloadTrigger = async () => {
    if (!selectedVideo) {
      Alert.alert('Error', 'Please select a format');
      return;
    }

    const { requiresMerge, url, formatId, quality, type } = selectedVideo;

    // Check storage folders
    const exists = await RNFS.exists(downloadDirectory);
    if (!exists) {
      await RNFS.mkdir(downloadDirectory);
    }

    const fileExt = type.includes('webm') ? 'webm' : 'mp4';
    const cleanTitle = title.replace(/[^\w\s-]/gi, '').substring(0, 30);
    const destinationPath = `${downloadDirectory}/${cleanTitle}_${quality}.${fileExt}`;
    const taskId = `${originalUrl}_${formatId}`;

    // 1. Check if format is HLS (m3u8) on generic scraper
    const isHls = url.includes('.m3u8') || type.includes('mpegURL');
    if (isHls && !requiresMerge) {
      // Trigger local ffmpeg HLS stitch download
      triggerLocalHlsDownload(url, destinationPath, taskId, quality);
      return;
    }

    // 2. Format needs backend merge
    if (requiresMerge) {
      setPreparing(true);
      setPrepareProgress('Initiating merge request...');
      try {
        const response = await prepareDownload(originalUrl, formatId, abortControllerRef.current?.signal);
        
        if (response.status === 'ready' && response.url) {
          setPreparing(false);
          startBackgroundDownload(response.url, destinationPath, taskId, quality);
        } else if (response.status === 'pending' && response.mergeJobId) {
          pollPrepareStatus(response.mergeJobId, destinationPath, taskId, quality);
        }
      } catch (err: any) {
        if (err.name === 'CanceledError') return;
        setPreparing(false);
        Alert.alert('Preparation Error', 'Server failed to initialize video merge');
      }
      return;
    }

    // 3. Progressive/direct format download
    startBackgroundDownload(url, destinationPath, taskId, quality);
  };

  const pollPrepareStatus = (mergeJobId: string, destPath: string, taskId: string, quality: string) => {
    let attempts = 0;
    const maxAttempts = 60; // 2 minutes timeout for rendering/merging

    const interval = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(interval);
        setPreparing(false);
        Alert.alert('Timeout', 'The server took too long to process video streams.');
        return;
      }

      try {
        const response = await checkPrepareStatus(mergeJobId, abortControllerRef.current?.signal);
        
        if (response.status === 'downloading') {
          setPrepareProgress('Downloading source streams on server...');
        } else if (response.status === 'merging') {
          setPrepareProgress('Merging audio & video channels...');
        } else if (response.status === 'completed' && response.downloadUrl) {
          clearInterval(interval);
          setPreparing(false);
          startBackgroundDownload(response.downloadUrl, destPath, taskId, quality);
        } else if (response.status === 'failed') {
          clearInterval(interval);
          setPreparing(false);
          Alert.alert('Merge Failed', response.error || 'Server failed to merge files');
        }
      } catch (err: any) {
        if (err.name === 'CanceledError') {
          clearInterval(interval);
          return;
        }
        clearInterval(interval);
        setPreparing(false);
        Alert.alert('Status Error', 'Connection lost while preparing file');
      }
    }, 2000);
  };

  const startBackgroundDownload = (downloadUrl: string, destPath: string, taskId: string, quality: string) => {
    const task: DownloadTask = {
      id: taskId,
      title: title,
      url: downloadUrl,
      progress: 0,
      speed: '0 MB/s',
      eta: 'Connecting...',
      status: 'downloading',
      localPath: destPath,
      sizeEstimate: formatSize(selectedVideo?.sizeEstimate)
    };

    addDownloadTask(task);
    navigation.navigate('Downloads');

    // Create background download session
    const downloadJob = RNBackgroundDownloader.download({
      id: taskId,
      url: downloadUrl,
      destination: destPath
    })
      .begin(({ expectedBytes }) => {
        console.log(`Starting download of size: ${expectedBytes}`);
      })
      .progress(({ bytesDownloaded, bytesTotal }) => {
        // approximate rate updates
        const percent = bytesTotal > 0 ? bytesDownloaded / bytesTotal : 0;
        updateDownloadProgress(taskId, percent * 100, 'Calculating...', '...');
      })
      .done(() => {
        updateDownloadStatus(taskId, 'completed', destPath);
        
        // Save to completed downloads history
        addCompletedDownload({
          id: taskId,
          title,
          size: task.sizeEstimate || 'Unknown',
          localPath: destPath,
          timestamp: Date.now()
        });
      })
      .error(({ error }) => {
        console.error('Download error', error);
        updateDownloadStatus(taskId, 'failed');
      });
  };

  const triggerLocalHlsDownload = (hlsUrl: string, destPath: string, taskId: string, quality: string) => {
    const task: DownloadTask = {
      id: taskId,
      title: title,
      url: hlsUrl,
      progress: 0,
      speed: 'Stitching...',
      eta: 'Stitching...',
      status: 'downloading',
      localPath: destPath,
      sizeEstimate: 'HLS Stream'
    };

    addDownloadTask(task);
    navigation.navigate('Downloads');

    // Use FFmpeg-kit to stitch HLS stream directly on-device
    FFmpegKit.executeAsync(
      `-y -i "${hlsUrl}" -c copy "${destPath}"`,
      async (session) => {
        const state = await session.getState();
        const returnCode = await session.getReturnCode();

        if (returnCode.isValueSuccess()) {
          updateDownloadProgress(taskId, 100, 'Done', '0:00');
          updateDownloadStatus(taskId, 'completed', destPath);
          addCompletedDownload({
            id: taskId,
            title,
            size: 'HLS Stitched',
            localPath: destPath,
            timestamp: Date.now()
          });
        } else {
          updateDownloadStatus(taskId, 'failed');
        }
      },
      (log) => {
        // Parse logs to calculate fake progress if needed, otherwise just set generic updates
        updateDownloadProgress(taskId, 50, 'Processing HLS...', '...');
      }
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Extraction Result</Text>
      </View>

      <View style={styles.mainContent}>
        <GlassCard style={styles.videoCard}>
          <Image source={{ uri: thumbnail }} style={styles.thumbnail} resizeMode="cover" />
          
          <View style={styles.infoSection}>
            <Text style={styles.videoTitle} numberOfLines={2}>{title}</Text>
            
            <View style={styles.badgeRow}>
              <View style={styles.platformBadge}>
                <Text style={styles.badgeText}>{sourcePlatform.toUpperCase()}</Text>
              </View>
            </View>

            {/* Quality drop down trigger */}
            <TouchableOpacity style={styles.dropdownTrigger} onPress={() => setDropdownVisible(true)}>
              <Text style={styles.dropdownLabel}>Quality:</Text>
              <View style={styles.dropdownValueWrapper}>
                <Text style={styles.dropdownValue}>
                  {selectedVideo ? `${selectedVideo.quality} (${selectedVideo.format})` : 'Select Format'}
                </Text>
                <Icon name="chevron-down" size={16} color={COLORS.primaryTeal} />
              </View>
            </TouchableOpacity>

            <AnimatedButton
              title="Download Now"
              onPress={handleDownloadTrigger}
              fullWidth={true}
            />
          </View>
        </GlassCard>
      </View>

      {/* Custom dropdown bottom sheet Modal */}
      <CustomDropdown
        visible={dropdownVisible}
        onClose={() => setDropdownVisible(false)}
        title="Choose Resolution"
        items={dropdownItems}
        selectedItemValue={selectedFormatId}
        onSelect={setSelectedFormatId}
      />

      {/* Prepare Progress Loading Overlay Modal */}
      <Modal transparent visible={preparing} animationType="fade">
        <View style={styles.loadingOverlay}>
          <GlassCard style={styles.loadingCard}>
            <ActivityIndicator size="large" color={COLORS.primaryTeal} />
            <Text style={styles.loadingTitle}>Preparing Stream</Text>
            <Text style={styles.loadingText}>{prepareProgress}</Text>
          </GlassCard>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.appBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    fontFamily: 'Inter-Bold',
    flex: 1,
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  videoCard: {
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    marginBottom: 16,
  },
  infoSection: {
    width: '100%',
  },
  videoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 10,
    fontFamily: 'Inter-Bold',
    lineHeight: 24,
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  platformBadge: {
    backgroundColor: 'rgba(123, 143, 255, 0.2)', // Soft indigo badge background
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.secondaryAccent,
    fontFamily: 'Inter-Bold',
  },
  dropdownTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  dropdownLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    fontFamily: 'Inter-SemiBold',
  },
  dropdownValueWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dropdownValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginRight: 6,
    fontFamily: 'Inter-Bold',
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(26, 31, 58, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingCard: {
    width: '100%',
    padding: 24,
    alignItems: 'center',
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 16,
    marginBottom: 8,
    fontFamily: 'Inter-Bold',
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
  }
});
