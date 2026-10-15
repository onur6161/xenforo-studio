export interface TransferJob {
  id: string;
  name: string;
  source_url: string;
  target_key: string;
  total_bytes: number;
  transferred_bytes: number;
  percentage: number;
  speed_mbps: number;
  eta_seconds: number;
  status: "queued" | "running" | "paused" | "completed" | "failed" | "cancelled";
  provider?: "gdrive" | "yandex" | "mediafire" | "direct" | string;
  stage?: string;
  error_message?: string | null;
  created_at: string;
  completed_at?: string | null;
}

export interface TransferQueueStats {
  active_count: number;
  queued_count: number;
  completed_count: number;
  failed_count: number;
  total_transferred_bytes: number;
  current_bandwidth_mbps: number;
}

export interface TransferQueueResponse {
  jobs: TransferJob[];
  stats: TransferQueueStats;
}
