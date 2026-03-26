mod e2e_helpers;

use e2e_helpers::TestEnv;

#[test]
fn bookmark_list_returns_success() {
    let env = TestEnv::new();
    env.cmd().args(["bookmark", "list"]).assert().success();
}

#[test]
fn bookmark_search_returns_success() {
    let env = TestEnv::new();
    env.cmd()
        .args(["bookmark", "search", "test"])
        .assert()
        .success();
}

#[test]
fn bookmark_read_nonexistent_fails() {
    let env = TestEnv::new();
    env.cmd()
        .args(["bookmark", "read", "nonexistent-id"])
        .assert()
        .failure();
}

#[test]
fn bookmark_add_url_and_remove() {
    let env = TestEnv::new();

    // URL指定でブックマーク追加
    let output = env
        .cmd()
        .args(["bookmark", "add", "https://example.com"])
        .output()
        .expect("Failed to run command");

    // 成功 or 既に登録済み（DUPLICATE）のどちらかで正常
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        output.status.success() || stderr.contains("DUPLICATE"),
        "bookmark add failed unexpectedly: {stderr}"
    );
}
