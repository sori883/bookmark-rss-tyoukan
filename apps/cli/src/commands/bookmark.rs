use anyhow::Result;

use crate::client::ApiClient;
use crate::output;

pub async fn list(client: &ApiClient) -> Result<()> {
    let response = client.list_bookmarks(1, 20).await?;
    output::print_bookmarks_table(&response);
    Ok(())
}

pub async fn add(client: &ApiClient, target: &str) -> Result<()> {
    let (article_id, url) = if target.starts_with("http://") || target.starts_with("https://") {
        (None, Some(target))
    } else {
        (Some(target), None)
    };

    let bookmark = client.create_bookmark(article_id, url).await?;
    println!("Bookmarked: {}", bookmark.title);
    Ok(())
}

pub async fn remove(client: &ApiClient, id: &str) -> Result<()> {
    client.delete_bookmark(id).await?;
    println!("Bookmark removed.");
    Ok(())
}

pub async fn read(client: &ApiClient, id: &str) -> Result<()> {
    let bookmark = client.get_bookmark(id).await?;
    output::print_bookmark_markdown(&bookmark);
    Ok(())
}

pub async fn search(client: &ApiClient, keyword: &str) -> Result<()> {
    let response = client.search_bookmarks(keyword, 1, 20).await?;
    output::print_bookmarks_table(&response);
    Ok(())
}
