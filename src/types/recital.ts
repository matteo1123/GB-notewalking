export interface RecitalSchedule {
  id: string;
  title: string;
  scheduled_for: string; // ISO timestamptz
  notes: string | null;
  created_by: string;
  auto_started: boolean;
  created_at: string;
}

export interface Recital {
  id: string;
  created_by: string;
  schedule_id: string | null;
  status: 'active' | 'ended';
  daily_room_url: string | null;
  daily_room_name: string | null;
  current_performer_id: string | null;
  performer_slot_started_at: string | null;
  started_at: string;
  ended_at: string | null;
}

export interface RecitalQueueEntry {
  id: string;
  recital_id: string;
  user_id: string;
  display_name: string;
  ready: boolean;
  chat_banned_this_session: boolean;
  video_banned: boolean;
  joined_at: string;
  performed_at: string | null;
}

export interface RecitalChatMessage {
  id: string;
  recital_id: string;
  user_id: string;
  display_name: string;
  body: string;
  deleted_by_admin: boolean;
  created_at: string;
}

export const PERFORMER_SLOT_SECONDS = 180; // 3 minutes
