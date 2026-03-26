use std::path::PathBuf;

use anyhow::{Context, Result};

pub struct AppConfig {
    pub api_url: String,
    pub auth_url: String,
    pub config_dir: PathBuf,
}

impl AppConfig {
    pub fn load() -> Result<Self> {
        let api_url = std::env::var("BOOKMARK_RSS_API_URL")
            .unwrap_or_else(|_| "http://localhost:3001".to_string());
        let auth_url = std::env::var("BOOKMARK_RSS_AUTH_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());
        let config_dir = if let Ok(dir) = std::env::var("BOOKMARK_RSS_CONFIG_DIR") {
            PathBuf::from(dir)
        } else {
            dirs::config_dir()
                .context("Failed to resolve config directory")?
                .join("bookmark-rss")
        };

        Ok(Self {
            api_url,
            auth_url,
            config_dir,
        })
    }

    pub fn token_path(&self) -> PathBuf {
        self.config_dir.join("token.json")
    }
}
