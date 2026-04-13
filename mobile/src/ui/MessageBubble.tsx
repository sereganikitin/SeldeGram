import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Message, ChatMember } from '../types';
import { MediaBubble } from './MediaBubble';
import { StickerImage } from './StickerImage';
import { AudioPlayer } from './AudioPlayer';
import { PollBubble } from './PollBubble';
import { formatTime, messagePreview, groupReactions } from '../helpers';

interface Props {
  message: Message;
  mine: boolean;
  showSenderName: boolean;
  senderName?: string;
  isRead: boolean;
  onLongPress: () => void;
  onReplyPress?: (replyToId: string) => void;
}

export function MessageBubble({
  message,
  mine,
  showSenderName,
  senderName,
  isRead,
  onLongPress,
  onReplyPress,
}: Props) {
  const hasMedia = !!message.mediaKey && !!message.mediaType;
  const isAudio = hasMedia && message.mediaType!.startsWith('audio/');
  const isPoll = message.content?.startsWith('📊 ');
  const isDeleted = !!message.deletedAt;
  const isSticker = !!message.isSticker && !isDeleted;

  if (isSticker) {
    return (
      <Pressable
        onLongPress={onLongPress}
        delayLongPress={300}
        style={[styles.stickerWrap, mine ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]}
      >
        {showSenderName && !mine && (
          <Text style={[styles.senderName, { marginLeft: 4 }]}>{senderName}</Text>
        )}
        <StickerImage mediaKey={message.mediaKey!} mediaType={message.mediaType ?? undefined} size={150} />
        <View style={styles.stickerMeta}>
          <Text style={styles.stickerTime}>{formatTime(message.createdAt)}</Text>
          {mine && <Text style={styles.stickerChecks}>{isRead ? '✓✓' : '✓'}</Text>}
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onLongPress={isDeleted ? undefined : onLongPress}
      delayLongPress={300}
      style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}
    >
      {showSenderName && !mine && !isDeleted && (
        <Text style={styles.senderName}>{senderName}</Text>
      )}

      {message.forwardedFromId && !isDeleted && (
        <Text style={mine ? styles.forwardedMine : styles.forwardedOther}>↪ Переслано</Text>
      )}

      {message.replyTo && !isDeleted && (
        <Pressable
          onPress={() => message.replyToId && onReplyPress?.(message.replyToId)}
          style={[styles.replyQuote, mine ? styles.replyQuoteMine : styles.replyQuoteOther]}
        >
          <Text style={mine ? styles.replyTextMine : styles.replyTextOther} numberOfLines={2}>
            {messagePreview(message.replyTo)}
          </Text>
        </Pressable>
      )}

      {isDeleted ? (
        <Text style={mine ? styles.deletedMine : styles.deletedOther}>удалено</Text>
      ) : (
        <>
          {isAudio ? (
            <AudioPlayer mediaKey={message.mediaKey!} duration={message.mediaSize} mine={mine} />
          ) : hasMedia ? (
            <MediaBubble
              mediaKey={message.mediaKey!}
              mediaType={message.mediaType!}
              mediaName={message.mediaName}
              mediaSize={message.mediaSize}
              mine={mine}
            />
          ) : null}
          {isPoll ? (
            <PollBubble messageId={message.id} mine={mine} />
          ) : message.content ? (
            <Text style={[mine ? styles.textMine : styles.textOther, hasMedia && { marginTop: 6 }]}>
              {message.content}
            </Text>
          ) : null}
        </>
      )}

      {message.reactions && message.reactions.length > 0 && !isDeleted && (
        <View style={styles.reactionsRow}>
          {groupReactions(message.reactions).map((r) => (
            <View key={r.emoji} style={[styles.reactionBadge, mine ? styles.reactionBadgeMine : styles.reactionBadgeOther]}>
              <Text style={styles.reactionEmoji}>{r.emoji}</Text>
              {r.count > 1 && <Text style={[styles.reactionCount, { color: mine ? '#ffd4e1' : '#8c6471' }]}>{r.count}</Text>}
            </View>
          ))}
        </View>
      )}
      <View style={styles.meta}>
        {message.editedAt && !isDeleted && (
          <Text style={mine ? styles.editedMine : styles.editedOther}>изм. </Text>
        )}
        <Text style={mine ? styles.timeMine : styles.timeOther}>{formatTime(message.createdAt)}</Text>
        {mine && !isDeleted && (
          <Text style={styles.checks}>{isRead ? '✓✓' : '✓'}</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    borderRadius: 16,
    marginVertical: 3,
  },
  bubbleMine: { backgroundColor: '#ff7a99', alignSelf: 'flex-end' },
  bubbleOther: { backgroundColor: '#ffe8f0', alignSelf: 'flex-start' },
  senderName: { fontSize: 12, fontWeight: '700', color: '#e84e76', marginBottom: 4 },
  forwardedMine: { color: '#ffd4e1', fontSize: 12, fontStyle: 'italic', marginBottom: 4 },
  forwardedOther: { color: '#8c6471', fontSize: 12, fontStyle: 'italic', marginBottom: 4 },
  replyQuote: { borderLeftWidth: 3, paddingLeft: 8, paddingVertical: 4, marginBottom: 6, borderRadius: 4 },
  replyQuoteMine: { borderLeftColor: '#fff', backgroundColor: '#ffffff22' },
  replyQuoteOther: { borderLeftColor: '#ff7a99', backgroundColor: '#ff7a9911' },
  replyTextMine: { color: '#ffe8f0', fontSize: 13 },
  replyTextOther: { color: '#5a2a3a', fontSize: 13 },
  textMine: { color: '#fff', fontSize: 16 },
  textOther: { color: '#3d1a28', fontSize: 16 },
  deletedMine: { color: '#ffd4e1', fontStyle: 'italic', fontSize: 14 },
  deletedOther: { color: '#b59aa4', fontStyle: 'italic', fontSize: 14 },
  meta: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 4, gap: 4 },
  timeMine: { color: '#ffd4e1', fontSize: 11 },
  timeOther: { color: '#8c6471', fontSize: 11 },
  editedMine: { color: '#ffd4e1', fontSize: 11, fontStyle: 'italic' },
  editedOther: { color: '#8c6471', fontSize: 11, fontStyle: 'italic' },
  checks: { color: '#ffd4e1', fontSize: 12, marginLeft: 2 },
  reactionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  reactionBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  reactionBadgeMine: { backgroundColor: '#ffffff22' },
  reactionBadgeOther: { backgroundColor: '#ff7a9915' },
  reactionEmoji: { fontSize: 14 },
  reactionCount: { fontSize: 11, marginLeft: 3 },
  stickerWrap: { marginVertical: 4 },
  stickerMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, paddingHorizontal: 4 },
  stickerTime: { color: '#888', fontSize: 11 },
  stickerChecks: { color: '#ff7a99', fontSize: 12 },
});
