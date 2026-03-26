use std::path::Path;

use anyhow::{bail, Result};

use crate::client::ApiClient;
use crate::output;

pub async fn list(client: &ApiClient) -> Result<()> {
    let feeds = client.list_feeds().await?;
    output::print_feeds_table(&feeds);
    Ok(())
}

pub async fn add(client: &ApiClient, url: &str) -> Result<()> {
    let feed = client.create_feed(url).await?;
    println!("Feed added: {} ({})", feed.title, feed.url);
    Ok(())
}

pub async fn remove(client: &ApiClient, id: &str) -> Result<()> {
    client.delete_feed(id).await?;
    println!("Feed removed.");
    Ok(())
}

pub async fn import(client: &ApiClient, file_path: &str) -> Result<()> {
    let path = Path::new(file_path);
    if !path.exists() {
        bail!("File not found: {}", file_path);
    }
    let result = client.import_opml(path).await?;
    output::print_import_result(&result);
    Ok(())
}
