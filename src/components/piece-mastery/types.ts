export interface Piece {
    id: string;
    user_id: string;
    name: string;
    notes: string | null;
    audio_url: string | null;
    segment_seconds: number | null;
    duration_seconds: number | null;
    created_at: string;
}

export interface PieceProgress {
    id: string;
    user_id: string;
    piece_id: string;
    current_block_index: number;
    total_practice_seconds: number;
    last_practiced: string | null;
}
