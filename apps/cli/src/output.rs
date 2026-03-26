use crate::client::models::{
    ArticleResponse, BookmarkResponse, FeedResponse, ImportOpmlResponse, PaginatedResponse,
};

fn sanitize(s: &str) -> String {
    s.replace(['\t', '\n'], " ")
}

fn format_pagination<T>(response: &PaginatedResponse<T>) -> String {
    let page = response.page as u64;
    let limit = response.limit as u64;
    let start = page
        .saturating_sub(1)
        .saturating_mul(limit)
        .saturating_add(1);
    let end = std::cmp::min(page.saturating_mul(limit), response.total);
    let total_pages = if limit == 0 {
        0
    } else {
        response.total.div_ceil(limit)
    };

    format!(
        "Showing {start}-{end} of {} (page {}/{})",
        response.total, response.page, total_pages
    )
}

pub fn print_feeds_table(feeds: &[FeedResponse]) {
    if feeds.is_empty() {
        println!("No feeds found.");
        return;
    }

    println!("ID\tTitle\tURL\tLast Fetched");
    for feed in feeds {
        println!(
            "{}\t{}\t{}\t{}",
            feed.id,
            sanitize(&feed.title),
            sanitize(&feed.url),
            feed.last_fetched_at.as_deref().unwrap_or("-"),
        );
    }
}

pub fn print_import_result(result: &ImportOpmlResponse) {
    println!("Imported {} feed(s).", result.imported_count);
    if !result.feeds.is_empty() {
        print_feeds_table(&result.feeds);
    }
}

pub fn print_articles_table(response: &PaginatedResponse<ArticleResponse>) {
    if response.data.is_empty() {
        println!("No articles found.");
        return;
    }

    println!("ID\tUnread\tTitle\tPublished");
    for article in &response.data {
        let unread = if article.is_read { "" } else { "*" };
        println!(
            "{}\t{}\t{}\t{}",
            article.id,
            unread,
            sanitize(&article.title),
            article.published_at,
        );
    }
    println!("{}", format_pagination(response));
}

pub fn print_article_detail(article: &ArticleResponse) {
    println!("Title: {}", article.title);
    println!("URL:   {}", article.url);
    println!("Feed:  {}", article.feed_id);
    println!("Date:  {}", article.published_at);
    println!("Read:  {}", if article.is_read { "Yes" } else { "No" });
}

pub fn print_bookmarks_table(response: &PaginatedResponse<BookmarkResponse>) {
    if response.data.is_empty() {
        println!("No bookmarks found.");
        return;
    }

    println!("ID\tTitle\tURL\tCreated");
    for bookmark in &response.data {
        println!(
            "{}\t{}\t{}\t{}",
            bookmark.id,
            sanitize(&bookmark.title),
            sanitize(&bookmark.url),
            bookmark.created_at,
        );
    }
    println!("{}", format_pagination(response));
}

pub fn print_bookmark_markdown(bookmark: &BookmarkResponse) {
    println!("Title: {}", bookmark.title);
    println!("URL:   {}", bookmark.url);
    println!("---");
    println!("{}", bookmark.content_markdown);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_pagination_normal() {
        let response: PaginatedResponse<()> = PaginatedResponse {
            data: vec![],
            total: 100,
            page: 2,
            limit: 20,
        };
        assert_eq!(
            format_pagination(&response),
            "Showing 21-40 of 100 (page 2/5)"
        );
    }

    #[test]
    fn test_format_pagination_zero_limit() {
        let response: PaginatedResponse<()> = PaginatedResponse {
            data: vec![],
            total: 0,
            page: 0,
            limit: 0,
        };
        let result = format_pagination(&response);
        assert!(result.contains("Showing"));
    }
}
