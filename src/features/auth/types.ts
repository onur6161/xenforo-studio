export interface ForumUser {
  user_id: number;
  username: string;
  email?: string;
  is_admin: boolean;
  is_moderator: boolean;
  is_super_admin: boolean;
  is_staff: boolean;
  user_title?: string;
  avatar_url?: string;
}

export interface AuthResult {
  success: boolean;
  message: string;
  user?: ForumUser;
  role?: "super_admin" | "admin" | "staff" | "unauthorized";
  session_token?: string;
}
