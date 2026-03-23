-- bookmarks の全文検索用カラムとインデックス（Drizzle で未対応のため手動管理）

-- search_vector カラムを tsvector に変更
ALTER TABLE bookmarks ALTER COLUMN search_vector TYPE tsvector USING to_tsvector('japanese', coalesce(title, '') || ' ' || coalesce(content_markdown, ''));

-- GIN インデックス
CREATE INDEX IF NOT EXISTS idx_bookmarks_search ON bookmarks USING GIN(search_vector);

-- search_vector 自動更新トリガー
CREATE OR REPLACE FUNCTION bookmarks_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('japanese', coalesce(NEW.title, '') || ' ' || coalesce(NEW.content_markdown, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bookmarks_search_vector_trigger ON bookmarks;
CREATE TRIGGER bookmarks_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, content_markdown ON bookmarks
  FOR EACH ROW
  EXECUTE FUNCTION bookmarks_search_vector_update();
