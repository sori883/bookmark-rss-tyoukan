use std::path::Path;

use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct StoredToken {
    access_token: String,
    created_at: String,
}

pub fn load_token(token_path: &Path) -> Result<String> {
    if !token_path.exists() {
        bail!("Not logged in. Please run: bookmark-rss login");
    }

    let content = std::fs::read_to_string(token_path).context("Failed to read token file")?;
    let stored: StoredToken =
        serde_json::from_str(&content).context("Failed to parse token file")?;

    Ok(stored.access_token)
}

pub fn save_token(token_path: &Path, token: &str) -> Result<()> {
    if let Some(parent) = token_path.parent() {
        std::fs::create_dir_all(parent).context("Failed to create config directory")?;
    }

    let stored = StoredToken {
        access_token: token.to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
    };

    let content = serde_json::to_string_pretty(&stored).context("Failed to serialize token")?;

    std::fs::write(token_path, &content).context("Failed to write token file")?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = std::fs::Permissions::from_mode(0o600);
        std::fs::set_permissions(token_path, perms)
            .context("Failed to set token file permissions")?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_save_and_load_token() {
        let tmp = TempDir::new().unwrap();
        let path = tmp.path().join("token.json");

        save_token(&path, "test-jwt-token").unwrap();
        let loaded = load_token(&path).unwrap();
        assert_eq!(loaded, "test-jwt-token");
    }

    #[test]
    fn test_load_missing_token() {
        let tmp = TempDir::new().unwrap();
        let path = tmp.path().join("nonexistent.json");

        let result = load_token(&path);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Not logged in"));
    }

    #[cfg(unix)]
    #[test]
    fn test_token_file_permissions() {
        use std::os::unix::fs::PermissionsExt;

        let tmp = TempDir::new().unwrap();
        let path = tmp.path().join("token.json");

        save_token(&path, "secret").unwrap();
        let metadata = std::fs::metadata(&path).unwrap();
        assert_eq!(metadata.permissions().mode() & 0o777, 0o600);
    }
}
