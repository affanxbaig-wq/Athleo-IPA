import React, {useState} from 'react';
import {Image, StyleSheet, TouchableOpacity, View} from 'react-native';

import {AnimatedText as Text} from '../components/AnimatedText';
import {AppCard} from '../components/AppCard';
import {SmoothScrollView} from '../components/SmoothScrollView';
import {progressPhotos} from '../data/athleoProgress';
import {ATHLEO_COLORS, ATHLEO_SPACING} from '../theme/theme';

export function ProgressPhotosScreen() {
  const [selected, setSelected] = useState(progressPhotos[0]);

  return (
    <SmoothScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <AppCard style={styles.captureCard}>
        <Text style={styles.sectionTitle}>Guided Capture</Text>
        <View style={styles.captureRow}>
          {['Front', 'Side', 'Back'].map(label => (
            <TouchableOpacity key={label} style={[styles.captureChip, selected.label === label && styles.captureChipActive]}>
              <Text style={[styles.captureText, selected.label === label && styles.captureTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.photoFrame}>
          <Image source={{uri: selected.uri}} style={styles.bigImage} />
          <View style={styles.overlayBody} />
        </View>
        <Text style={styles.captureMeta}>Timer: 05:00 • posture check</Text>
      </AppCard>

      <AppCard style={styles.galleryCard}>
        <Text style={styles.sectionTitle}>Progress Gallery</Text>
        <View style={styles.grid}>
          {progressPhotos.map(photo => (
            <TouchableOpacity key={photo.id} onPress={() => setSelected(photo)}>
              <Image source={{uri: photo.uri}} style={styles.thumbnail} />
            </TouchableOpacity>
          ))}
        </View>
      </AppCard>
    </SmoothScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ATHLEO_COLORS.background },
  content: { padding: ATHLEO_SPACING.lg, paddingBottom: 96, gap: ATHLEO_SPACING.md },
  captureCard: { padding: 16, borderRadius: 18 },
  sectionTitle: { color: ATHLEO_COLORS.text, fontSize: 18, fontWeight: '700', marginBottom: 10 },
  captureRow: { flexDirection: 'row', gap: 8 },
  captureChip: { flex: 1, borderRadius: 10, backgroundColor: '#17181A', paddingVertical: 8, alignItems: 'center' },
  captureChipActive: { backgroundColor: 'rgba(184,255,77,0.12)', borderWidth: 1, borderColor: 'rgba(184,255,77,0.22)' },
  captureText: { color: ATHLEO_COLORS.muted, fontWeight: '700' },
  captureTextActive: { color: ATHLEO_COLORS.accent },
  photoFrame: { position: 'relative', marginTop: 12, borderRadius: 18, overflow: 'hidden', height: 260 },
  bigImage: { width: '100%', height: '100%' },
  overlayBody: {
    position: 'absolute',
    left: '18%',
    top: '12%',
    width: '64%',
    height: '76%',
    borderRadius: 60,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  captureMeta: { color: ATHLEO_COLORS.muted, marginTop: 10, fontSize: 12 },
  galleryCard: { padding: 16, borderRadius: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumbnail: { width: '31.5%', height: 120, borderRadius: 12 },
});
