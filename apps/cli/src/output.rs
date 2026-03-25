use comfy_table::{ContentArrangement, Table};

use crate::client::models::{
    ArticleResponse, BookmarkResponse, FeedResponse, ImportOpmlResponse, PaginatedResponse,
};

fn truncate(s: &str, max_chars: usize) -> String {
    let char_count = s.chars().count();
    if char_count <= max_chars {
        s.to_string()
    } else {
        let truncated: String = s.chars().take(max_chars.saturating_sub(3)).collect();
        format!("{truncated}...")
    }
}

fn short_id(id: &str) -> &str {
    if id.len() > 8 && id.is_char_boundary(8) {
        &id[..8]
    } else {
        id
    }
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
        eprintln!("No feeds found.");
        return;
    }

    let mut table = Table::new();
    table.set_content_arrangement(ContentArrangement::Dynamic);
    table.set_header(vec!["ID", "Title", "URL", "Last Fetched"]);

    for feed in feeds {
        table.add_row(vec![
            short_id(&feed.id),
            &truncate(&feed.title, 30),
            &truncate(&feed.url, 40),
            feed.last_fetched_at.as_deref().unwrap_or("-"),
        ]);
    }

    println!("{table}");
}

pub fn print_import_result(result: &ImportOpmlResponse) {
    eprintln!("Imported {} feed(s).", result.imported_count);
    if !result.feeds.is_empty() {
        print_feeds_table(&result.feeds);
    }
}

pub fn print_articles_table(response: &PaginatedResponse<ArticleResponse>) {
    if response.data.is_empty() {
        eprintln!("No articles found.");
        return;
    }

    let mut table = Table::new();
    table.set_content_arrangement(ContentArrangement::Dynamic);
    table.set_header(vec!["ID", "", "Title", "Published"]);

    for article in &response.data {
        let read_mark = if article.is_read { " " } else { "*" };
        table.add_row(vec![
            short_id(&article.id),
            read_mark,
            &truncate(&article.title, 50),
            &article.published_at,
        ]);
    }

    println!("{table}");
    eprintln!("{}", format_pagination(response));
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
        eprintln!("No bookmarks found.");
        return;
    }

    let mut table = Table::new();
    table.set_content_arrangement(ContentArrangement::Dynamic);
    table.set_header(vec!["ID", "Title", "URL", "Created"]);

    for bookmark in &response.data {
        table.add_row(vec![
            short_id(&bookmark.id),
            &truncate(&bookmark.title, 40),
            &truncate(&bookmark.url, 40),
            &bookmark.created_at,
        ]);
    }

    println!("{table}");
    eprintln!("{}", format_pagination(response));
}

pub fn print_bookmark_markdown(bookmark: &BookmarkResponse) {
    eprintln!("Title: {}", bookmark.title);
    eprintln!("URL:   {}", bookmark.url);
    eprintln!("---");
    termimad::print_text(&bookmark.content_markdown);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_truncate_ascii() {
        assert_eq!(truncate("hello", 10), "hello");
        assert_eq!(truncate("hello world!", 8), "hello...");
    }

    #[test]
    fn test_truncate_japanese() {
        let jp = "日本語のテスト文字列です";
        assert_eq!(truncate(jp, 20), jp);
        assert_eq!(truncate(jp, 6), "日本語...");
    }

    #[test]
    fn test_short_id_uuid() {
        assert_eq!(short_id("abcdef12-3456-7890"), "abcdef12");
        assert_eq!(short_id("short"), "short");
    }

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
