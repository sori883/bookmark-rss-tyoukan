use std::path::PathBuf;

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Default)]
struct ConfigFile {
    api_url: Option<String>,
    auth_url: Option<String>,
}

pub struct AppConfig {
    pub api_url: String,
    pub auth_url: String,
    pub config_dir: PathBuf,
}

impl AppConfig {
    /// 環境変数 > 設定ファイル > デフォルト の優先順で読み込む
    pub fn load() -> Result<Self> {
        let config_dir = if let Ok(dir) = std::env::var("BOOKMARK_RSS_CONFIG_DIR") {
            PathBuf::from(dir)
        } else {
            dirs::config_dir()
                .context("Failed to resolve config directory")?
                .join("bookmark-rss")
        };

        let file_config = load_config_file(&config_dir);

        let api_url = std::env::var("BOOKMARK_RSS_API_URL")
            .ok()
            .or(file_config.api_url)
            .unwrap_or_else(|| "http://localhost:3001".to_string());

        let auth_url = std::env::var("BOOKMARK_RSS_AUTH_URL")
            .ok()
            .or(file_config.auth_url)
            .unwrap_or_else(|| "http://localhost:3000".to_string());

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

fn load_config_file(config_dir: &PathBuf) -> ConfigFile {
    let path = config_dir.join("config.json");
    std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn save_config(config_dir: &PathBuf, api_url: Option<&str>, auth_url: Option<&str>) -> Result<()> {
    std::fs::create_dir_all(config_dir)
        .context("Failed to create config directory")?;

    let mut current = load_config_file(config_dir);
    if let Some(url) = api_url {
        current.api_url = Some(url.to_string());
    }
    if let Some(url) = auth_url {
        current.auth_url = Some(url.to_string());
    }

    let path = config_dir.join("config.json");
    let json = serde_json::to_string_pretty(&current)
        .context("Failed to serialize config")?;
    std::fs::write(&path, json)
        .context("Failed to write config file")?;

    Ok(())
}
