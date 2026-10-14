export interface LiveReleaseInfo {
  is_live: boolean;
  version?: string;
  pub_date?: string;
  notes?: string;
  url?: string;
}

export interface StagedReleaseInfo {
  version: string;
  notes: string;
  pub_date: string;
  exe_name: string;
  exe_size_bytes: number;
  exe_size_formatted: string;
  signature_present: boolean;
  staged_folder: string;
  live_info?: LiveReleaseInfo | null;
}

export interface PublishReleaseResult {
  success: boolean;
  version: string;
  timestamp: string;
  active_exe_url: string;
  active_manifest_url: string;
  backup_folder: string;
  backup_files: string[];
  message: string;
}

export interface R2BackupFileInfo {
  file_name: string;
  key: string;
  size_bytes: number;
  size_formatted: string;
  download_url: string;
}

export interface R2BackupGroup {
  folder_name: string;
  timestamp: string;
  version: string;
  total_size_formatted: string;
  files: R2BackupFileInfo[];
}
