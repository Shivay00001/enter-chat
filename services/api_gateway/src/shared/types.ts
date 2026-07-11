/**
 * Shared TypeScript types for the API.
 * These mirror the database enums and API contract types.
 */

// --- Database Enums (matching PostgreSQL enums) ---

export type AccountState = 'active' | 'restricted' | 'suspended' | 'deleting' | 'deleted';
export type DevicePlatform = 'android' | 'ios' | 'web' | 'desktop';
export type ContactSource = 'phonebook' | 'username' | 'qr' | 'bridge' | 'manual';
export type ChatType = 'direct' | 'group' | 'channel' | 'community_room' | 'bridge';
export type ChatVisibility = 'private' | 'invite' | 'public';
export type E2eeMode = 'required' | 'optional' | 'unavailable' | 'bridge_dependent';
export type MemberRole = 'owner' | 'admin' | 'moderator' | 'member' | 'guest';
export type MemberState = 'active' | 'muted' | 'left' | 'banned' | 'pending';
export type NotificationLevel = 'all' | 'mentions' | 'muted';
export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'voice' | 'document' | 'contact' | 'location' | 'poll' | 'sticker' | 'gif' | 'system';
export type MessageState = 'active' | 'edited' | 'deleted' | 'tombstoned';
export type MediaEncryptionMode = 'server' | 'client_e2ee';
export type MediaProcessingState = 'uploading' | 'uploaded' | 'scanning' | 'transcoding' | 'ready' | 'failed' | 'blocked';
export type InvitePolicy = 'open_link' | 'approval' | 'admin_only';
export type ChannelVisibility = 'private' | 'public';
export type CallType = 'audio' | 'video' | 'group';
export type CallState = 'ringing' | 'active' | 'ended' | 'missed' | 'failed';
export type NotificationDeliveryState = 'pending' | 'sent' | 'failed' | 'suppressed';

// --- API Request/Response Types ---

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    retryAfterSeconds?: number;
    correlationId: string;
  };
}

export interface CursorPaginationParams {
  cursor?: string;
  limit?: number;
}

export interface CursorPaginatedResponse<T> {
  data: T[];
  cursor: string | null;
  hasMore: boolean;
}

// --- Auth ---

export interface OtpStartRequest {
  channel: 'phone' | 'email';
  identifier: string;
}

export interface OtpVerifyRequest {
  verificationId: string;
  otp: string;
  device: {
    platform: DevicePlatform;
    deviceName?: string;
    publicKey?: string;
  };
}

export interface AuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserProfile;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// --- User ---

export interface UserProfile {
  id: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  statusText: string | null;
  accountState: AccountState;
}

export interface UpdateProfileRequest {
  displayName?: string;
  username?: string;
  statusText?: string;
}

// --- Chat ---

export interface CreateDirectChatRequest {
  recipientUserId: string;
}

export interface ChatListItem {
  id: string;
  type: ChatType;
  name: string | null;
  avatarUrl: string | null;
  lastMessage: MessageSummary | null;
  unreadCount: number;
  updatedAt: string;
}

export interface MessageSummary {
  id: string;
  senderDisplayName: string;
  type: MessageType;
  preview: string | null;
  createdAt: string;
}

// --- Message ---

export interface SendMessageRequest {
  clientMessageId: string;
  type: MessageType;
  body?: string;
  ciphertext?: string;
  metadata?: Record<string, unknown>;
  replyToMessageId?: string;
}

export interface MessageResponse {
  id: string;
  chatId: string;
  senderUserId: string;
  type: MessageType;
  body: string | null;
  metadata: Record<string, unknown> | null;
  replyToMessageId: string | null;
  state: MessageState;
  createdAt: string;
  editedAt: string | null;
}
