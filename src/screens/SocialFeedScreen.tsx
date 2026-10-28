/**
 * SocialFeedScreen.tsx — Community feed.
 *
 * This screen used to render a static array with component-local likes, a
 * "refresh" that was a 1.2 s timeout, and a post you composed that vanished on
 * the next mount. Everything now goes through `communityService`: posts,
 * likes, comments and follows are stored on the device and survive a restart,
 * relative timestamps come from real stored dates, and Share hands the post to
 * the OS share sheet.
 *
 * There is no social backend yet, so the seeded sample posts are flagged
 * `isSeed` in the service. Swapping that module for a Supabase table is a
 * drop-in change — this screen only ever calls the service.
 */

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  Share,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

import {AnimatedText as Text} from '../components/AnimatedText';
import {AppCard} from '../components/AppCard';
import {SmoothScrollView} from '../components/SmoothScrollView';
import {ATHLEO_COLORS, ATHLEO_SPACING, TAB_BAR_BOTTOM_PADDING} from '../theme/theme';
import {getCachedDisplayName} from '../services/profileSync';
import {triggerHaptic} from '../services/haptics';
import {
  addComment,
  commentCount,
  createPost,
  deletePost,
  getComments,
  getGroups,
  getPosts,
  getRelativeTime,
  getSuggestedPeople,
  isFollowing,
  isLiked,
  likeCount,
  loadCommunity,
  toggleFollow,
  toggleLike,
  type CommunityPost,
  type CommunityState,
} from '../services/communityService';

/** A post is "live" for the first few minutes after it is created. */
const LIVE_WINDOW_MS = 5 * 60 * 1000;
/** Relative labels are re-rendered on this cadence so "just now" never sticks. */
const CLOCK_TICK_MS = 60 * 1000;

function initialsFor(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

function LikeButton({
  liked,
  count,
  onPress,
}: {
  liked: boolean;
  count: number;
  onPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const colorAnim = useRef(new Animated.Value(liked ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(colorAnim, {
      toValue: liked ? 1 : 0,
      duration: 150,
      useNativeDriver: false,
    }).start();
  }, [liked, colorAnim]);

  const handlePress = useCallback(() => {
    triggerHaptic('impactLight');
    Animated.sequence([
      Animated.timing(scaleAnim, {toValue: 1.4, duration: 80, useNativeDriver: true}),
      Animated.spring(scaleAnim, {toValue: 1, friction: 3, tension: 200, useNativeDriver: true}),
    ]).start();
    onPress();
  }, [onPress, scaleAnim]);

  const heartColor = colorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [ATHLEO_COLORS.muted, '#FF5A5F'],
  });

  return (
    <TouchableOpacity onPress={handlePress} style={styles.likeBtn} accessibilityLabel="Like post">
      <Animated.Text style={[styles.likeHeart, {transform: [{scale: scaleAnim}], color: heartColor}]}>
        ♥
      </Animated.Text>
      <Text style={[styles.actionText, liked && styles.actionTextLiked]}>{count}</Text>
    </TouchableOpacity>
  );
}

function FollowButton({following, onPress}: {following: boolean; onPress: () => void}) {
  const bgAnim = useRef(new Animated.Value(following ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(bgAnim, {
      toValue: following ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [following, bgAnim]);

  const bgColor = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(184,255,77,0.12)', 'rgba(184,255,77,0.28)'],
  });

  return (
    <Animated.View style={[styles.followButton, {backgroundColor: bgColor}]}>
      <TouchableOpacity onPress={onPress}>
        <Text style={styles.followText}>{following ? '✓ Following' : 'Follow'}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function SocialFeedScreen() {
  const [tab, setTab] = useState<'Following' | 'Discover'>('Following');
  const [state, setState] = useState<CommunityState>(() => loadCommunity());
  const [refreshing, setRefreshing] = useState(false);
  const [composeVisible, setComposeVisible] = useState(false);
  const [composeText, setComposeText] = useState('');
  const [commentPost, setCommentPost] = useState<CommunityPost | null>(null);
  const [commentText, setCommentText] = useState('');
  const [, setClockTick] = useState(0);

  const displayName = useMemo(() => getCachedDisplayName(), []);
  const people = useMemo(() => getSuggestedPeople(), []);
  const groups = useMemo(() => getGroups(), []);
  const posts = useMemo(() => getPosts(state), [state]);

  // Keeps "just now" / "12m ago" honest without re-rendering every second.
  useEffect(() => {
    const id = setInterval(() => setClockTick(tick => tick + 1), CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // A real re-read from storage rather than a cosmetic timeout.
    setState(loadCommunity());
    setRefreshing(false);
  }, []);

  const handleCompose = useCallback(() => {
    if (!composeText.trim()) {
      setComposeVisible(false);
      return;
    }
    triggerHaptic('notificationSuccess');
    setState(current => createPost(current, {authorName: displayName, body: composeText}));
    setComposeText('');
    setComposeVisible(false);
  }, [composeText, displayName]);

  const handleShare = useCallback(async (post: CommunityPost) => {
    try {
      await Share.share({
        message: `${post.authorName} on Athleo: ${post.body}`,
      });
    } catch {
      /* the user dismissed the sheet — nothing to do */
    }
  }, []);

  const handleDelete = useCallback((post: CommunityPost) => {
    setState(current => deletePost(current, post.id));
  }, []);

  const handleAddComment = useCallback(() => {
    if (!commentPost || !commentText.trim()) {return;}
    triggerHaptic('impactLight');
    const postId = commentPost.id;
    setState(current => addComment(current, {postId, authorName: displayName, body: commentText}));
    setCommentText('');
  }, [commentPost, commentText, displayName]);

  const comments = commentPost ? getComments(state, commentPost.id) : [];

  return (
    <View style={styles.wrapper}>
      <SmoothScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={ATHLEO_COLORS.accent}
            colors={[ATHLEO_COLORS.accent]}
          />
        }>
        <Text style={styles.title}>Community</Text>

        <AppCard style={styles.tabCard}>
          <View style={styles.segmentedTabs}>
            {(['Following', 'Discover'] as const).map(item => (
              <TouchableOpacity
                key={item}
                style={[styles.tabButton, tab === item && styles.tabActive]}
                onPress={() => setTab(item)}>
                <Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </AppCard>

        {tab === 'Following' ? (
          <>
            {posts.length === 0 ? (
              <AppCard style={styles.sectionCard}>
                <Text style={styles.emptyText}>
                  Your feed is empty. Tap the compose button to post the first update.
                </Text>
              </AppCard>
            ) : (
              posts.map(post => {
                const liked = isLiked(state, post.id);
                const isLive = Date.now() - post.createdAt < LIVE_WINDOW_MS;
                return (
                  <AppCard key={post.id} style={styles.postCard}>
                    <View style={styles.postHeader}>
                      <View style={styles.avatarCircle}>
                        {post.avatar ? (
                          <Image source={{uri: post.avatar}} style={styles.avatarImg} />
                        ) : (
                          <Text style={styles.avatarInitial}>{initialsFor(post.authorName)}</Text>
                        )}
                      </View>
                      <View style={styles.postMeta}>
                        <View style={styles.nameRow}>
                          <Text style={styles.name}>{post.authorName}</Text>
                          {isLive ? (
                            <View style={styles.liveBadge}>
                              <View style={styles.liveDot} />
                              <Text style={styles.liveText}>LIVE</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.handle}>
                          {post.handle} • {getRelativeTime(post.createdAt)}
                        </Text>
                      </View>
                      {!post.isSeed ? (
                        <TouchableOpacity
                          onPress={() => handleDelete(post)}
                          accessibilityLabel="Delete your post">
                          <Icon name="trash-outline" size={17} color={ATHLEO_COLORS.danger} />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          onPress={() => handleShare(post)}
                          accessibilityLabel="Share post">
                          <Icon name="share-outline" size={17} color={ATHLEO_COLORS.accent} />
                        </TouchableOpacity>
                      )}
                    </View>

                    <Text style={styles.postText}>{post.body}</Text>

                    {post.image ? (
                      <Image source={{uri: post.image}} style={styles.postMediaImage} resizeMode="cover" />
                    ) : null}

                    {post.workout ? (
                      <View style={styles.workoutCard}>
                        <Text style={styles.workoutTitle}>{post.workout.title}</Text>
                        {post.workout.volumeKg > 0 ? (
                          <Text style={styles.workoutMeta}>
                            Volume: {post.workout.volumeKg.toLocaleString()} kg
                          </Text>
                        ) : null}
                        {post.workout.durationMin > 0 ? (
                          <Text style={styles.workoutMeta}>
                            Duration: {post.workout.durationMin} min
                          </Text>
                        ) : null}
                        {post.workout.pr ? (
                          <Text style={styles.workoutMeta}>PR: {post.workout.pr}</Text>
                        ) : null}
                      </View>
                    ) : null}

                    <View style={styles.actionsRow}>
                      <LikeButton
                        liked={liked}
                        count={likeCount(state, post)}
                        onPress={() => setState(current => toggleLike(current, post.id))}
                      />
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => {
                          setCommentText('');
                          setCommentPost(post);
                        }}>
                        <Icon name="chatbubble-outline" size={15} color={ATHLEO_COLORS.muted} />
                        <Text style={styles.actionText}>{commentCount(state, post)}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => handleShare(post)}>
                        <Icon name="arrow-redo-outline" size={15} color={ATHLEO_COLORS.muted} />
                        <Text style={styles.actionText}>Share</Text>
                      </TouchableOpacity>
                    </View>
                  </AppCard>
                );
              })
            )}
          </>
        ) : (
          <>
            <AppCard style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Suggested People</Text>
              {people.map(person => (
                <View key={person.id} style={styles.personRow}>
                  <View style={styles.personAvatarCircle}>
                    {person.avatar ? (
                      <Image source={{uri: person.avatar}} style={styles.personAvatarImg} />
                    ) : (
                      <Text style={styles.personAvatarInitial}>{initialsFor(person.name)}</Text>
                    )}
                  </View>
                  <View style={styles.personMeta}>
                    <Text style={styles.personName}>{person.name}</Text>
                    <Text style={styles.personGoal}>{person.goal}</Text>
                  </View>
                  <FollowButton
                    following={isFollowing(state, person.id)}
                    onPress={() => setState(current => toggleFollow(current, person.id))}
                  />
                </View>
              ))}
              <Text style={styles.discoverNote}>
                Following {state.followingIds.length} of {people.length} suggested athletes. Your
                choices are kept on this device.
              </Text>
            </AppCard>

            <AppCard style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Groups</Text>
              {groups.map(group => (
                <View key={group.id} style={styles.groupRow}>
                  <View style={styles.groupBadge}>
                    <Image source={require('../assets/images/group.png')} style={styles.groupBadgeIcon} resizeMode="contain" />
                  </View>
                  <View style={styles.personMeta}>
                    <Text style={styles.personName}>{group.name}</Text>
                    <Text style={styles.personGoal}>{group.members}</Text>
                  </View>
                </View>
              ))}
            </AppCard>
          </>
        )}
      </SmoothScrollView>

      {/* Compose FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setComposeVisible(true)}
        accessibilityLabel="Write a post">
        <Icon name="create-outline" size={22} color="#111" />
      </TouchableOpacity>

      {/* Compose sheet */}
      <Modal
        visible={composeVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setComposeVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>New Post</Text>
              <TouchableOpacity onPress={() => setComposeVisible(false)}>
                <Icon name="close" size={22} color={ATHLEO_COLORS.muted} />
              </TouchableOpacity>
            </View>
            <TextInput
              value={composeText}
              onChangeText={setComposeText}
              placeholder="Share your progress, tips, or wins..."
              placeholderTextColor={ATHLEO_COLORS.muted}
              multiline
              style={styles.sheetInput}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.sheetPostBtn, !composeText.trim() && styles.sheetPostBtnDisabled]}
              onPress={handleCompose}>
              <Text style={styles.sheetPostText}>Post</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Comments sheet */}
      <Modal
        visible={commentPost !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setCommentPost(null)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Comments</Text>
              <TouchableOpacity onPress={() => setCommentPost(null)}>
                <Icon name="close" size={22} color={ATHLEO_COLORS.muted} />
              </TouchableOpacity>
            </View>

            <SmoothScrollView style={styles.commentList} contentContainerStyle={styles.commentListContent}>
              {comments.length === 0 ? (
                <Text style={styles.emptyText}>
                  No comments stored on this device yet. Be the first to reply.
                </Text>
              ) : (
                comments.map(comment => (
                  <View key={comment.id} style={styles.commentRow}>
                    <View style={styles.commentAvatar}>
                      <Text style={styles.commentAvatarText}>{initialsFor(comment.authorName)}</Text>
                    </View>
                    <View style={styles.commentBody}>
                      <Text style={styles.commentAuthor}>
                        {comment.authorName} • {getRelativeTime(comment.createdAt)}
                      </Text>
                      <Text style={styles.commentText}>{comment.body}</Text>
                    </View>
                  </View>
                ))
              )}
            </SmoothScrollView>

            <View style={styles.commentComposer}>
              <TextInput
                value={commentText}
                onChangeText={setCommentText}
                placeholder="Add a comment..."
                placeholderTextColor={ATHLEO_COLORS.muted}
                style={styles.commentInput}
              />
              <TouchableOpacity
                style={[styles.commentSend, !commentText.trim() && styles.sheetPostBtnDisabled]}
                onPress={handleAddComment}
                disabled={!commentText.trim()}
                accessibilityLabel="Send comment">
                <Icon name="send" size={16} color={ATHLEO_COLORS.background} />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {flex: 1},
  screen: {flex: 1, backgroundColor: ATHLEO_COLORS.background},
  content: {padding: ATHLEO_SPACING.lg, paddingBottom: TAB_BAR_BOTTOM_PADDING + 60, gap: ATHLEO_SPACING.md},
  title: {color: ATHLEO_COLORS.text, fontSize: 30, fontWeight: '800'},
  tabCard: {padding: 8, borderRadius: 16},
  segmentedTabs: {flexDirection: 'row', gap: 6},
  tabButton: {flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center'},
  tabActive: {backgroundColor: ATHLEO_COLORS.accentDim, borderWidth: 1, borderColor: 'rgba(184,255,77,0.16)'},
  tabText: {color: ATHLEO_COLORS.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase'},
  tabTextActive: {color: ATHLEO_COLORS.accent},
  postCard: {padding: 14, borderRadius: 18},
  postHeader: {flexDirection: 'row', alignItems: 'center', gap: 10},
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(184,255,77,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {color: ATHLEO_COLORS.accent, fontWeight: '800', fontSize: 16},
  avatarImg: {width: 40, height: 40, borderRadius: 20},
  postMediaImage: {width: '100%', height: 180, borderRadius: 12, marginTop: 10},
  postMeta: {flex: 1},
  nameRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  name: {color: ATHLEO_COLORS.text, fontWeight: '700'},
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(106,226,141,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  liveDot: {width: 6, height: 6, borderRadius: 999, backgroundColor: ATHLEO_COLORS.accent},
  liveText: {color: ATHLEO_COLORS.accent, fontSize: 12, fontWeight: '900', letterSpacing: 0.8},
  handle: {color: '#E2FCE8', fontSize: 13, marginTop: 2, fontWeight: '700'},
  postText: {color: '#FFFFFF', fontSize: 15, lineHeight: 22, marginTop: 10, fontWeight: '700'},
  workoutCard: {backgroundColor: '#0F3820', borderRadius: 12, padding: 14, marginTop: 10, borderWidth: 1.5, borderColor: 'rgba(184, 255, 77, 0.35)'},
  workoutTitle: {color: '#FFFFFF', fontWeight: '900', fontSize: 16},
  workoutMeta: {color: '#E2FCE8', marginTop: 4, fontSize: 13, fontWeight: '700'},
  actionsRow: {flexDirection: 'row', gap: 16, marginTop: 12, alignItems: 'center'},
  likeBtn: {flexDirection: 'row', alignItems: 'center', gap: 4},
  likeHeart: {fontSize: 16, fontWeight: '700'},
  actionBtn: {flexDirection: 'row', alignItems: 'center', gap: 5},
  actionText: {color: '#FFFFFF', fontWeight: '800', fontSize: 13},
  actionTextLiked: {color: '#FF5A5F'},
  sectionCard: {padding: 16, borderRadius: 18, backgroundColor: '#0D331D', borderWidth: 1.5, borderColor: 'rgba(184, 255, 77, 0.35)'},
  sectionTitle: {color: '#FFFFFF', fontSize: 18, fontWeight: '900', marginBottom: 12},
  emptyText: {color: '#E2FCE8', fontSize: 14, lineHeight: 20, fontWeight: '700'},
  personRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10},
  personAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(184,255,77,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(184,255,77,0.4)',
    overflow: 'hidden',
  },
  personAvatarImg: {width: 44, height: 44, borderRadius: 22},
  personAvatarInitial: {color: ATHLEO_COLORS.accent, fontWeight: '900'},
  personMeta: {flex: 1},
  personName: {color: '#FFFFFF', fontWeight: '900', fontSize: 15},
  personGoal: {color: '#E2FCE8', fontSize: 13, marginTop: 2, fontWeight: '700'},
  followButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: ATHLEO_COLORS.accent,
    backgroundColor: '#0F3820',
  },
  followText: {color: '#FFFFFF', fontWeight: '800', fontSize: 13},
  discoverNote: {color: '#E2FCE8', fontSize: 13, marginTop: 4, fontWeight: '700'},
  groupRow: {flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10},
  groupBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(184,255,77,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupBadgeIcon: {width: 20, height: 20, tintColor: ATHLEO_COLORS.accent},
  fab: {
    position: 'absolute',
    right: 20,
    bottom: TAB_BAR_BOTTOM_PADDING + 12,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: ATHLEO_COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ATHLEO_COLORS.accent,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  sheetBackdrop: {flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)'},
  sheet: {
    backgroundColor: ATHLEO_COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    borderWidth: 1,
    borderColor: ATHLEO_COLORS.hairline,
  },
  sheetHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14},
  sheetTitle: {color: ATHLEO_COLORS.text, fontSize: 18, fontWeight: '800'},
  sheetInput: {
    color: ATHLEO_COLORS.text,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 100,
    backgroundColor: ATHLEO_COLORS.surfaceSolid,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: ATHLEO_COLORS.hairline,
    textAlignVertical: 'top',
  },
  sheetPostBtn: {
    marginTop: 14,
    backgroundColor: ATHLEO_COLORS.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  sheetPostBtnDisabled: {opacity: 0.4},
  sheetPostText: {color: '#111', fontWeight: '800', fontSize: 15},
  commentList: {maxHeight: 320},
  commentListContent: {gap: 10, paddingBottom: 12},
  commentRow: {flexDirection: 'row', gap: 10},
  commentAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(184,255,77,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarText: {color: ATHLEO_COLORS.accent, fontWeight: '800', fontSize: 12},
  commentBody: {flex: 1},
  commentAuthor: {color: '#FFFFFF', fontSize: 13, fontWeight: '800'},
  commentText: {color: '#E2FCE8', fontSize: 14, marginTop: 3, lineHeight: 20, fontWeight: '700'},
  commentComposer: {flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6},
  commentInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    backgroundColor: '#0D331D',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(184, 255, 77, 0.40)',
  },
  commentSend: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ATHLEO_COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
