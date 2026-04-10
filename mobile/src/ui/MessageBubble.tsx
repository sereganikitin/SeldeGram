import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Message, ChatMember } from '../types';
import { MediaBubble } from './MediaBubble';
import { StickerImage } from './StickerImage';
import { AudioPlayer } from './AudioPlayer';
import { PollBubble } from './PollBubble';
import { formatTime, messagePreview } from '../helpers';

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
  bubbleMine: { backgroundColor: '#5fe3d4', alignSelf: 'flex-end' },
  bubbleOther: { backgroundColor: '#eef0f3', alignSelf: 'flex-start' },
  senderName: { fontSize: 12, fontWeight: '700', color: '#5fe3d4', marginBottom: 4 },
  forwardedMine: { color: '#cce4ff', fontSize: 12, fontStyle: 'italic', marginBottom: 4 },
  forwardedOther: { color: '#777', fontSize: 12, fontStyle: 'italic', marginBottom: 4 },
  replyQuote: { borderLeftWidth: 3, paddingLeft: 8, paddingVertical: 4, marginBottom: 6, borderRadius: 4 },
  replyQuoteMine: { borderLeftColor: '#fff', backgroundColor: '#ffffff22' },
  replyQuoteOther: { borderLeftColor: '#5fe3d4', backgroundColor: '#5fe3d411' },
  replyTextMine: { color: '#e5f1ff', fontSize: 13 },
  replyTextOther: { color: '#444', fontSize: 13 },
  textMine: { color: '#fff', fontSize: 16 },
  textOther: { color: '#000', fontSize: 16 },
  deletedMine: { color: '#cce4ff', fontStyle: 'italic', fontSize: 14 },
  deletedOther: { color: '#999', fontStyle: 'italic', fontSize: 14 },
  meta: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 4, gap: 4 },
  timeMine: { color: '#cce4ff', fontSize: 11 },
  timeOther: { color: '#888', fontSize: 11 },
  editedMine: { color: '#cce4ff', fontSize: 11, fontStyle: 'italic' },
  editedOther: { color: '#888', fontSize: 11, fontStyle: 'italic' },
  checks: { color: '#cce4ff', fontSize: 12, marginLeft: 2 },
  stickerWrap: { marginVertical: 4 },
  stickerMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, paddingHorizontal: 4 },
  stickerTime: { color: '#888', fontSize: 11 },
  stickerChecks: { color: '#5fe3d4', fontSize: 12 },
});
