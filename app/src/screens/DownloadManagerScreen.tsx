import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  Share,
  Alert
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { FlashList } from '@shopify/flash-list';
import RNBackgroundDownloader from '@kesha-antonov/react-native-background-downloader';
import RNFS from 'react-native-fs';
import { COLORS } from '../theme/colors';
import { GlassCard } from '../components/GlassCard';
import { GradientProgressBar } from '../components/GradientProgressBar';
import { useAppStore, DownloadTask, CompletedDownload } from '../store/useAppStore';

export const DownloadManagerScreen = () => {
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const downloadQueue = useAppStore((state) => state.downloadQueue);
  const completedDownloads = useAppStore((state) => state.completedDownloads);
  const updateDownloadStatus = useAppStore((state) => state.updateDownloadStatus);
  const removeDownloadTask = useAppStore((state) => state.removeDownloadTask);
  const clearCompletedDownloads = useAppStore((state) => state.clearCompletedDownloads);

  const handlePauseResume = async (task: DownloadTask) => {
    const downloads = await RNBackgroundDownloader.checkForExistingDownloads();
    const activeJob = downloads.find(d => d.id === task.id);

    if (!activeJob) {
      Alert.alert('Error', 'Background download job not found');
      return;
    }

    if (task.status === 'downloading') {
      activeJob.pause();
      updateDownloadStatus(task.id, 'paused');
    } else if (task.status === 'paused') {
      activeJob.resume();
      updateDownloadStatus(task.id, 'downloading');
    }
  };

  const handleCancel = async (taskId: string) => {
    const downloads = await RNBackgroundDownloader.checkForExistingDownloads();
    const activeJob = downloads.find(d => d.id === taskId);
    
    if (activeJob) {
      activeJob.stop();
    }
    
    removeDownloadTask(taskId);
  };

  const handleShare = async (item: CompletedDownload) => {
    try {
      const exists = await RNFS.exists(item.localPath);
      if (!exists) {
        Alert.alert('File not found', 'The downloaded file was deleted or moved.');
        return;
      }

      await Share.share({
        url: `file://${item.localPath}`,
        title: item.title,
      });
    } catch {
      Alert.alert('Error', 'Failed to share file');
    }
  };

  const handleOpenFile = async (item: CompletedDownload) => {
    // Alert the path for the APK standalone compliance, or show detail dialog
    Alert.alert('File Location', `File saved at:\n${item.localPath}`);
  };

  const renderActiveItem = ({ item }: { item: DownloadTask }) => {
    const isPaused = item.status === 'paused';
    return (
      <GlassCard style={styles.taskCard}>
        <View style={styles.taskHeader}>
          <Text style={styles.taskTitle} numberOfLines={1}>{item.title}</Text>
          <View style={styles.actions}>
            <TouchableOpacity onPress={() => handlePauseResume(item)} style={styles.actionIcon}>
              <Icon name={isPaused ? "play" : "pause"} size={18} color={COLORS.primaryTeal} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleCancel(item.id)} style={styles.actionIcon}>
              <Icon name="trash" size={18} color={COLORS.error} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.progressRow}>
          <GradientProgressBar progress={item.progress} showLabel={true} />
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaText} numberOfLines={1}>
            Speed: {item.speed} • ETA: {item.eta}
          </Text>
          <Text style={styles.sizeText}>{item.sizeEstimate}</Text>
        </View>
      </GlassCard>
    );
  };

  const renderCompletedItem = ({ item }: { item: CompletedDownload }) => {
    return (
      <GlassCard style={styles.taskCard}>
        <View style={styles.taskHeader}>
          <Icon name="check-circle" size={20} color={COLORS.success} style={styles.successIcon} />
          <Text style={styles.taskTitle} numberOfLines={1}>{item.title}</Text>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>
            Size: {item.size} • {new Date(item.timestamp).toLocaleDateString()}
          </Text>
          <View style={styles.completedButtons}>
            <TouchableOpacity onPress={() => handleOpenFile(item)} style={styles.smallButton}>
              <Text style={styles.smallButtonText}>Open</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleShare(item)} style={styles.smallButton}>
              <Icon name="share-2" size={14} color={COLORS.primaryTeal} />
            </TouchableOpacity>
          </View>
        </View>
      </GlassCard>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Download Manager</Text>
        {activeTab === 'completed' && completedDownloads.length > 0 && (
          <TouchableOpacity onPress={clearCompletedDownloads}>
            <Text style={styles.clearAllText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'active' && styles.activeTab]}
          onPress={() => setActiveTab('active')}
        >
          <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>
            Active ({downloadQueue.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'completed' && styles.activeTab]}
          onPress={() => setActiveTab('completed')}
        >
          <Text style={[styles.tabText, activeTab === 'completed' && styles.activeTabText]}>
            Completed ({completedDownloads.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Lists */}
      <View style={styles.listContainer}>
        {activeTab === 'active' ? (
          downloadQueue.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Icon name="download-cloud" size={48} color={COLORS.textSecondary} style={styles.emptyIcon} />
              <Text style={styles.emptyText}>No active downloads</Text>
            </View>
          ) : (
            <FlashList
              data={downloadQueue}
              renderItem={renderActiveItem}
              estimatedItemSize={110}
              contentContainerStyle={styles.listContent}
            />
          )
        ) : (
          completedDownloads.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Icon name="folder" size={48} color={COLORS.textSecondary} style={styles.emptyIcon} />
              <Text style={styles.emptyText}>No completed downloads yet</Text>
            </View>
          ) : (
            <FlashList
              data={completedDownloads}
              renderItem={renderCompletedItem}
              estimatedItemSize={90}
              contentContainerStyle={styles.listContent}
            />
          )
        )}
      </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    fontFamily: 'Inter-Bold',
  },
  clearAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.error,
    fontFamily: 'Inter-SemiBold',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 16,
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  activeTab: {
    backgroundColor: '#FFFFFF',
    shadowColor: COLORS.glassShadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    fontFamily: 'Inter-SemiBold',
  },
  activeTabText: {
    color: COLORS.textPrimary,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  taskCard: {
    marginBottom: 12,
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  successIcon: {
    marginRight: 8,
  },
  taskTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    fontFamily: 'Inter-Bold',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIcon: {
    marginLeft: 12,
    padding: 4,
  },
  progressRow: {
    marginVertical: 6,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: 'Inter-Regular',
  },
  sizeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
    fontFamily: 'Inter-Bold',
  },
  completedButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  smallButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(123, 143, 255, 0.3)',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primaryTeal,
    fontFamily: 'Inter-Bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyIcon: {
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    fontFamily: 'Inter-Regular',
  }
});
