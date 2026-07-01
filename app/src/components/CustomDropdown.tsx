import React from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity, ScrollView, Pressable } from 'react-native';
import { GlassCard } from './GlassCard';
import { COLORS } from '../theme/colors';

export interface DropdownItem {
  label: string;  // e.g. "1080p"
  subLabel?: string; // e.g. "MP4 (15.4 MB) - Requires Merge"
  value: string; // e.g. "137" (formatId)
}

interface CustomDropdownProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  items: DropdownItem[];
  selectedItemValue?: string;
  onSelect: (value: string) => void;
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
  visible,
  onClose,
  title,
  items,
  selectedItemValue,
  onSelect
}) => {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.sheetContainer}>
          <GlassCard style={styles.glassCardSheet}>
            <View style={styles.header}>
              <Text style={styles.titleText}>{title}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.closeButton}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
              {items.map((item, index) => {
                const isSelected = item.value === selectedItemValue;
                return (
                  <TouchableOpacity
                    key={`${item.value}-${index}`}
                    style={[styles.itemRow, isSelected && styles.selectedRow]}
                    onPress={() => {
                      onSelect(item.value);
                      onClose();
                    }}
                  >
                    <View style={styles.itemInfo}>
                      <Text style={[styles.itemLabel, isSelected && styles.selectedText]}>
                        {item.label}
                      </Text>
                      {item.subLabel && (
                        <Text style={[styles.itemSubLabel, isSelected && styles.selectedSubText]}>
                          {item.subLabel}
                        </Text>
                      )}
                    </View>
                    
                    {isSelected && (
                      <View style={styles.checkIndicator}>
                        <View style={styles.checkDot} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </GlassCard>
        </View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(26, 31, 58, 0.4)', // Muted deep navy background overlay
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  glassCardSheet: {
    padding: 20,
    maxHeight: 400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.3)',
    paddingBottom: 16,
    marginBottom: 12,
  },
  titleText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    fontFamily: 'Inter-Bold',
  },
  closeButton: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.secondaryAccent,
    fontFamily: 'Inter-SemiBold',
  },
  scrollContainer: {
    width: '100%',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(123, 143, 255, 0.15)',
  },
  selectedRow: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    fontFamily: 'Inter-SemiBold',
  },
  itemSubLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
    fontFamily: 'Inter-Regular',
  },
  selectedText: {
    color: COLORS.primaryCoral,
  },
  selectedSubText: {
    color: COLORS.textPrimary,
  },
  checkIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.primaryCoral,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primaryCoral,
  }
});
