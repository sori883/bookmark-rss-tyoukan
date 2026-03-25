use anyhow::Result;
use clap::Parser;

mod auth;
mod client;
mod commands;
mod config;
mod error;
mod output;

#[derive(Parser)]
#[command(name = "bookmark-rss", about = "CLI経由で記事検索・ブックマーク操作")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(clap::Subcommand)]
enum Commands {
    /// OAuthログイン
    Login,
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
    /// フィード一覧
    List,
    /// フィード追加
    Add { url: String },
    /// フィード削除
    Remove { id: String },
    /// OPMLインポート
    Import { file: String },
}

#[derive(clap::Subcommand)]
enum ArticleAction {
    /// 記事一覧
    List {
        #[arg(long)]
        unread: bool,
        #[arg(long)]
        feed: Option<String>,
    },
    /// 記事詳細表示
    Read { id: String },
}

#[derive(clap::Subcommand)]
enum BookmarkAction {
    /// ブックマーク一覧
    List,
    /// ブックマーク追加 (URL or 記事ID)
    Add { target: String },
    /// ブックマーク削除
    Remove { id: String },
    /// ブックマーク本文表示 (Markdown)
    Read { id: String },
    /// ブックマーク全文検索
    Search { keyword: String },
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .json()
        .with_target(false)
        .init();

    let cli = Cli::parse();
    let app_config = config::AppConfig::load()?;

    match cli.command {
        Commands::Login => commands::login::execute(&app_config).await,
        Commands::Feed { action } => {
            let api = build_client(&app_config)?;
            match action {
                FeedAction::List => commands::feed::list(&api).await,
                FeedAction::Add { url } => commands::feed::add(&api, &url).await,
                FeedAction::Remove { id } => commands::feed::remove(&api, &id).await,
                FeedAction::Import { file } => commands::feed::import(&api, &file).await,
            }
        }
        Commands::Article { action } => {
            let api = build_client(&app_config)?;
            match action {
                ArticleAction::List { unread, feed } => {
                    commands::article::list(&api, unread, feed.as_deref()).await
                }
                ArticleAction::Read { id } => commands::article::read(&api, &id).await,
            }
        }
        Commands::Bookmark { action } => {
            let api = build_client(&app_config)?;
            match action {
                BookmarkAction::List => commands::bookmark::list(&api).await,
                BookmarkAction::Add { target } => commands::bookmark::add(&api, &target).await,
                BookmarkAction::Remove { id } => commands::bookmark::remove(&api, &id).await,
                BookmarkAction::Read { id } => commands::bookmark::read(&api, &id).await,
                BookmarkAction::Search { keyword } => {
                    commands::bookmark::search(&api, &keyword).await
                }
            }
        }
    }
}

fn build_client(config: &config::AppConfig) -> Result<client::ApiClient> {
    let token = auth::token_store::load_token(&config.token_path())?;
    client::ApiClient::new(&config.api_url, &token)
}
