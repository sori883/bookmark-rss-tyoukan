use assert_cmd::Command;
use tempfile::TempDir;

pub struct TestEnv {
    pub config_dir: TempDir,
    pub api_url: String,
}

#[allow(clippy::new_without_default)]
impl TestEnv {
    pub fn new() -> Self {
        let config_dir = TempDir::new().expect("Failed to create temp dir");
        let api_url = std::env::var("BOOKMARK_RSS_API_URL")
            .unwrap_or_else(|_| "http://localhost:3001".to_string());

        // テスト用トークンファイルを作成
        let token = std::env::var("BOOKMARK_RSS_TEST_TOKEN")
            .expect("BOOKMARK_RSS_TEST_TOKEN must be set for E2E tests");

        let token_path = config_dir.path().join("token.json");
        let token_json = serde_json::json!({
            "access_token": token,
            "created_at": "2026-01-01T00:00:00Z"
        });
        std::fs::write(&token_path, token_json.to_string()).expect("Failed to write token file");

        Self {
            config_dir,
            api_url,
        }
    }

    pub fn cmd(&self) -> Command {
        let mut cmd = Command::cargo_bin("bookmark-rss-cli").expect("binary not found");
        cmd.env("BOOKMARK_RSS_API_URL", &self.api_url);
        cmd.env(
            "BOOKMARK_RSS_CONFIG_DIR",
            self.config_dir.path().to_str().unwrap(),
        );
        // ログ出力を抑制
        cmd.env("RUST_LOG", "off");
        cmd
    }
}
