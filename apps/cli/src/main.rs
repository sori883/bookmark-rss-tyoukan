use clap::Parser;

#[derive(Parser)]
#[command(name = "bookmark-rss", about = "CLI経由で記事検索・ブックマーク操作")]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(clap::Subcommand)]
enum Commands {
    /// フィード操作
    Feed {
        #[command(subcommand)]
        action: FeedAction,
    },
    /// 記事操作
    Article {
        #[command(subcommand)]
        action: ArticleAction,
    },
    /// ブックマーク操作
    Bookmark {
        #[command(subcommand)]
        action: BookmarkAction,
    },
}

#[derive(clap::Subcommand)]
enum FeedAction {
    List,
    Add { url: String },
    Remove { id: String },
    Import { file: String },
}

#[derive(clap::Subcommand)]
enum ArticleAction {
    List {
        #[arg(long)]
        unread: bool,
        #[arg(long)]
        feed: Option<String>,
    },
    Read { id: String },
}

#[derive(clap::Subcommand)]
enum BookmarkAction {
    List,
    Add { target: String },
    Remove { id: String },
    Read { id: String },
    Search { keyword: String },
}

fn main() {
    let _cli = Cli::parse();
    println!("bookmark-rss CLI - not yet implemented");
}
