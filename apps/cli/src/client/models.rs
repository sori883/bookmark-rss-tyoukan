use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct PaginatedResponse<T> {
    pub data: Vec<T>,
    pub total: u64,
    pub page: u32,
    pub limit: u32,
}

#[derive(Debug, Deserialize)]
pub struct ErrorResponseBody {
    pub error: ErrorDetail,
}

#[derive(Debug, Deserialize)]
pub struct ErrorDetail {
    pub code: String,
    pub message: String,
}

// API response types: all fields deserialized for spec compliance
#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct FeedResponse {
    pub id: String,
    pub user_id: String,
    pub url: String,
    pub title: String,
    pub site_url: String,
    pub last_fetched_at: Option<String>,
    pub created_at: String,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct ArticleResponse {
    pub id: String,
    pub user_id: String,
    pub feed_id: String,
    pub url: String,
    pub title: String,
    pub is_read: bool,
    pub published_at: String,
    pub created_at: String,
    pub updated_at: String,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct BookmarkResponse {
    pub id: String,
    pub user_id: String,
    pub article_id: Option<String>,
    pub url: String,
    pub title: String,
    pub content_markdown: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct ImportOpmlResponse {
    pub imported_count: u32,
    pub feeds: Vec<FeedResponse>,
}

#[derive(Debug, Serialize)]
pub struct CreateFeedRequest {
    pub url: String,
}

#[derive(Debug, Serialize)]
pub struct CreateBookmarkRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub article_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SocialSignInRequest {
    pub provider: String,
    #[serde(rename = "callbackURL")]
    pub callback_url: String,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct SocialSignInResponse {
    pub url: String,
    pub redirect: bool,
}

// Used by OAuth HTML bridge (JS-side), kept for spec completeness
#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct SessionResponse {
    pub session: SessionInfo,
    pub user: SessionUser,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct SessionInfo {
    pub id: String,
    #[serde(rename = "userId")]
    pub user_id: String,
    pub token: String,
    #[serde(rename = "expiresAt")]
    pub expires_at: String,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct SessionUser {
    pub id: String,
    pub email: String,
    pub name: String,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct TokenResponse {
    pub token: String,
}
