class AuthenticationError(Exception):
    """auth サービスからの JWT 取得失敗"""


class FeedServiceError(Exception):
    """feed サービスへのリクエスト失敗"""


class NotificationServiceError(Exception):
    """notification サービスへのリクエスト失敗"""


class ArticleSelectionError(Exception):
    """AI 記事選定失敗"""


class SummarizationError(Exception):
    """要約生成失敗"""
