use std::time::Duration;

use anyhow::{bail, Context, Result};

use crate::auth::token_store;
use crate::client::models::{DeviceCodeResponse, DeviceTokenError, DeviceTokenRequest};
use crate::config::AppConfig;

pub async fn execute(config: &AppConfig) -> Result<()> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .context("Failed to build HTTP client")?;

    // 1. デバイスコード発行
    let device_code_url = format!("{}/auth/device/code", config.auth_url);
    let response = client
        .post(&device_code_url)
        .send()
        .await
        .context("Failed to request device code")?;

    if !response.status().is_success() {
        bail!("Failed to get device code: {}", response.status());
    }

    let device: DeviceCodeResponse = response
        .json()
        .await
        .context("Failed to parse device code response")?;

    // 2. ユーザーにコードを表示
    eprintln!();
    eprintln!("  ブラウザでログインしてください:");
    eprintln!("  URL:  {}", device.verification_uri);
    eprintln!("  コード: {}", device.user_code);
    eprintln!();

    // ブラウザを自動で開く
    if open::that(&device.verification_uri).is_err() {
        eprintln!("  ブラウザを開けませんでした。上のURLに手動でアクセスしてください。");
    }

    // 3. ポーリング
    let token_url = format!("{}/auth/device/token", config.auth_url);
    let interval = Duration::from_secs(device.interval);
    let deadline = tokio::time::Instant::now() + Duration::from_secs(device.expires_in);

    loop {
        if tokio::time::Instant::now() > deadline {
            bail!("認証がタイムアウトしました。再度 login を実行してください。");
        }

        tokio::time::sleep(interval).await;

        let body = DeviceTokenRequest {
            device_code: device.device_code.clone(),
        };

        let res = client
            .post(&token_url)
            .json(&body)
            .send()
            .await
            .context("Failed to poll for token")?;

        if res.status().is_success() {
            let token: crate::client::models::DeviceTokenResponse =
                res.json().await.context("Failed to parse token")?;

            token_store::save_token(&config.token_path(), &token.access_token)?;
            eprintln!("  ログイン成功！");
            return Ok(());
        }

        // エラーレスポンスを確認
        let error: DeviceTokenError = res.json().await.unwrap_or(DeviceTokenError {
            error: "unknown".to_string(),
        });

        match error.error.as_str() {
            "authorization_pending" => continue,
            "expired_token" => bail!("コードが期限切れです。再度 login を実行してください。"),
            other => bail!("認証エラー: {other}"),
        }
    }
}
