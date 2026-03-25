use std::path::PathBuf;

use anyhow::{Context, Result};

pub struct AppConfig {
    pub bff_url: String,
    pub auth_url: String,
    pub config_dir: PathBuf,
    pub callback_port: u16,
}

impl AppConfig {
    pub fn load() -> Result<Self> {
        let bff_url = std::env::var("BOOKMARK_RSS_BFF_URL")
            .unwrap_or_else(|_| "http://localhost:3010".to_string());
        let auth_url = std::env::var("BOOKMARK_RSS_AUTH_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());
        let config_dir = dirs::config_dir()
            .context("Failed to resolve config directory")?
            .join("bookmark-rss");

        Ok(Self {
            bff_url,
            auth_url,
            config_dir,
            callback_port: 18923,
        })
    }

    pub fn token_path(&self) -> PathBuf {
        self.config_dir.join("token.json")
    }
}
