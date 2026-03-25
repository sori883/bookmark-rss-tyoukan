use anyhow::Result;

use crate::client::ApiClient;
use crate::output;

pub async fn list(client: &ApiClient, unread: bool, feed_id: Option<&str>) -> Result<()> {
    let response = client.list_articles(feed_id, unread, 1, 20).await?;
    output::print_articles_table(&response);
    Ok(())
}

pub async fn read(client: &ApiClient, id: &str) -> Result<()> {
    let article = client.get_article(id).await?;
    output::print_article_detail(&article);
    Ok(())
}
