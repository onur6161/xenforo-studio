export interface R2ObjectItem {
  key: string;
  name: string;
  size_bytes: number;
  size_formatted: string;
  last_modified: string;
  etag: string;
  download_url: string;
  bbcode: string;
  extension: string;
  file_category: string;
}

export interface R2FolderItem {
  prefix: string;
  name: string;
}

export interface BreadcrumbItem {
  name: string;
  prefix: string;
}

export interface R2ExplorerResponse {
  success: boolean;
  current_prefix: string;
  parent_prefix: string | null;
  breadcrumbs: BreadcrumbItem[];
  folders: R2FolderItem[];
  files: R2ObjectItem[];
  total_folders: number;
  total_files: number;
  total_size_formatted: string;
  bucket_name: string;
  custom_domain: string;
  error_message: string | null;
}

export interface SelectedFileInfo {
  file_path: string;
  file_name: string;
  size_bytes: number;
  size_formatted: string;
}

export interface ArchiveEntry {
  name: string;
  is_dir: boolean;
  uncompressed_size: number;
  uncompressed_size_formatted: string;
  compressed_size: number;
  compressed_size_formatted: string;
  compression_ratio: string;
}

export interface ArchiveInspectResult {
  success: boolean;
  file_name: string;
  total_entries: number;
  total_files: number;
  total_dirs: number;
  total_uncompressed_bytes: number;
  total_uncompressed_formatted: string;
  total_compressed_bytes: number;
  total_compressed_formatted: string;
  entries: ArchiveEntry[];
  error_message: string | null;
}

export interface R2CategoryStat {
  category: string;
  count: number;
  total_bytes: number;
  total_formatted: string;
}

export interface R2BucketStats {
  total_files: number;
  total_bytes: number;
  total_size_formatted: string;
  category_breakdown: R2CategoryStat[];
  estimated_monthly_bandwidth: string;
}

export interface SimpleForumNode {
  node_id: number;
  title: string;
  description: string | null;
}

export interface CreateThreadResult {
  success: boolean;
  thread_id: number;
  view_url: string;
  message: string;
}

export interface R2UploadProgress {
  file_name: string;
  target_key: string;
  total_bytes: number;
  uploaded_bytes: number;
  percentage: number;
  speed_mbps: number;
  eta_seconds: number;
  current_part: number;
  total_parts: number;
  is_completed: boolean;
}

