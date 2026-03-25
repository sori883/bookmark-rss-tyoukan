use std::path::Path;
use std::time::Duration;

use anyhow::{Context, Result};
use reqwest::Client;
use serde::de::DeserializeOwned;
use serde::Serialize;

use crate::client::models::{
    ArticleResponse, BookmarkResponse, CreateBookmarkRequest, CreateFeedRequest, ErrorResponseBody,
    FeedResponse, ImportOpmlResponse, PaginatedResponse,
};
use crate::error::ApiError;

pub struct ApiClient {
    client: Client,
    api_url: String,
    token: String,
}

impl ApiClient {
    pub fn new(api_url: &str, token: &str) -> Result<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .context("Failed to build HTTP client")?;

        Ok(Self {
            client,
            api_url: api_url.to_string(),
            token: token.to_string(),
        })
    }

    async fn handle_error_response(&self, response: reqwest::Response) -> anyhow::Error {
        let status = response.status().as_u16();

        if let Ok(body) = response.json::<ErrorResponseBody>().await {
            ApiError {
                code: body.error.code,
                message: body.error.message,
                status,
            }
            .into()
        } else {
            ApiError {
                code: "UNKNOWN".to_string(),
                message: format!("Request failed with status {status}"),
                status,
            }
            .into()
        }
    }

    async fn get<T: DeserializeOwned>(&self, path: &str) -> Result<T> {
        let url = format!("{}{}", self.api_url, path);
        let response = self
            .client
            .get(&url)
            .bearer_auth(&self.token)
            .send()
            .await
            .context("Failed to send request")?;

        if !response.status().is_success() {
            return Err(self.handle_error_response(response).await);
        }

        response
            .json::<T>()
            .await
            .context("Failed to parse response")
    }

    async fn post<B: Serialize, T: DeserializeOwned>(&self, path: &str, body: &B) -> Result<T> {
        let url = format!("{}{}", self.api_url, path);
        let response = self
            .client
            .post(&url)
            .bearer_auth(&self.token)
            .json(body)
            .send()
            .await
            .context("Failed to send request")?;

        if !response.status().is_success() {
            return Err(self.handle_error_response(response).await);
        }

        response
            .json::<T>()
            .await
            .context("Failed to parse response")
    }

    async fn delete(&self, path: &str) -> Result<()> {
        let url = format!("{}{}", self.api_url, path);
        let response = self
            .client
            .delete(&url)
            .bearer_auth(&self.token)
            .send()
            .await
            .context("Failed to send request")?;

        if !response.status().is_success() {
            return Err(self.handle_error_response(response).await);
        }

        Ok(())
    }

    async fn post_multipart<T: DeserializeOwned>(
        &self,
        path: &str,
        form: reqwest::multipart::Form,
    ) -> Result<T> {
        let url = format!("{}{}", self.api_url, path);
        let response = self
            .client
            .post(&url)
            .bearer_auth(&self.token)
            .multipart(form)
            .send()
            .await
            .context("Failed to send request")?;

        if !response.status().is_success() {
            return Err(self.handle_error_response(response).await);
        }

        response
            .json::<T>()
            .await
            .context("Failed to parse response")
    }

    // --- Feed API ---

    pub async fn list_feeds(&self) -> Result<Vec<FeedResponse>> {
        self.get("/feeds").await
    }

    pub async fn create_feed(&self, url: &str) -> Result<FeedResponse> {
        let body = CreateFeedRequest {
            url: url.to_string(),
        };
        self.post("/feeds", &body).await
    }

    pub async fn delete_feed(&self, id: &str) -> Result<()> {
        self.delete(&format!("/feeds/{id}")).await
    }

    pub async fn import_opml(&self, file_path: &Path) -> Result<ImportOpmlResponse> {
        let file_bytes = tokio::fs::read(file_path)
            .await
            .context("Failed to read OPML file")?;

        let file_name = file_path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "import.opml".to_string());

        let part = reqwest::multipart::Part::bytes(file_bytes)
            .file_name(file_name)
            .mime_str("application/xml")
            .context("Failed to set MIME type")?;

        let form = reqwest::multipart::Form::new().part("file", part);

        self.post_multipart("/feeds/import-opml", form).await
    }

    // --- Article API ---

    pub async fn list_articles(
        &self,
        feed_id: Option<&str>,
        unread: bool,
        page: u32,
        limit: u32,
    ) -> Result<PaginatedResponse<ArticleResponse>> {
        let mut params = vec![format!("page={page}"), format!("limit={limit}")];

        if let Some(fid) = feed_id {
            params.push(format!("feed_id={fid}"));
        }

        if unread {
            params.push("is_read=false".to_string());
        }

        let query = params.join("&");
        self.get(&format!("/articles?{query}")).await
    }

    pub async fn get_article(&self, id: &str) -> Result<ArticleResponse> {
        self.get(&format!("/articles/{id}")).await
    }

    // --- Bookmark API ---

    pub async fn list_bookmarks(
        &self,
        page: u32,
        limit: u32,
    ) -> Result<PaginatedResponse<BookmarkResponse>> {
        self.get(&format!("/bookmarks?page={page}&limit={limit}"))
            .await
    }

    pub async fn create_bookmark(
        &self,
        article_id: Option<&str>,
        url: Option<&str>,
    ) -> Result<BookmarkResponse> {
        let body = CreateBookmarkRequest {
            article_id: article_id.map(String::from),
            url: url.map(String::from),
        };
        self.post("/bookmarks", &body).await
    }

    pub async fn delete_bookmark(&self, id: &str) -> Result<()> {
        self.delete(&format!("/bookmarks/{id}")).await
    }

    pub async fn get_bookmark(&self, id: &str) -> Result<BookmarkResponse> {
        self.get(&format!("/bookmarks/{id}")).await
    }

    pub async fn search_bookmarks(
        &self,
        query: &str,
        page: u32,
        limit: u32,
    ) -> Result<PaginatedResponse<BookmarkResponse>> {
        let encoded_query = urlencoding::encode(query);
        self.get(&format!(
            "/bookmarks/search?q={encoded_query}&page={page}&limit={limit}"
        ))
        .await
    }
}
