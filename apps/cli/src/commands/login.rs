use std::time::Duration;

use anyhow::{Context, Result};

use crate::auth::oauth_server;
use crate::auth::token_store;
use crate::client::models::{SocialSignInRequest, SocialSignInResponse};
use crate::config::AppConfig;

pub async fn execute(config: &AppConfig) -> Result<()> {
    let (listener, port) = oauth_server::find_available_port(config.callback_port)
        .await
        .context("Failed to start OAuth callback server")?;

    let state = oauth_server::generate_state();
    let callback_url = format!("http://localhost:{port}/callback?state={state}");
    eprintln!("Starting OAuth login...");

    let auth_url = start_oauth_flow(&config.auth_url, &callback_url).await?;

    eprintln!("Opening browser for authentication...");
    if open::that(&auth_url).is_err() {
        eprintln!("Failed to open browser. Please visit this URL manually:");
        eprintln!("  {auth_url}");
    }

    eprintln!("Waiting for authentication (timeout: 120s)...");
    let result = oauth_server::wait_for_oauth_callback(listener, &config.auth_url, &state).await?;

    token_store::save_token(&config.token_path(), &result.token)?;
    eprintln!("Login successful! Token saved.");
    Ok(())
}

async fn start_oauth_flow(auth_url: &str, callback_url: &str) -> Result<String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .context("Failed to build HTTP client")?;

    let body = SocialSignInRequest {
        provider: "google".to_string(),
        callback_url: callback_url.to_string(),
    };

    let response = client
        .post(format!("{auth_url}/auth/sign-in/social"))
        .json(&body)
        .send()
        .await
        .context("Failed to initiate OAuth flow")?;

    if !response.status().is_success() {
        anyhow::bail!("Auth service returned status {}", response.status());
    }

    let sign_in: SocialSignInResponse = response
        .json()
        .await
        .context("Failed to parse auth response")?;

    Ok(sign_in.url)
}
