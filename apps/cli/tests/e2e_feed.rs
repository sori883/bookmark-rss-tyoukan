mod e2e_helpers;

use e2e_helpers::TestEnv;
use predicates::prelude::*;

#[test]
fn feed_list_returns_success() {
    let env = TestEnv::new();
    env.cmd().args(["feed", "list"]).assert().success();
}

#[test]
fn feed_add_and_remove() {
    let env = TestEnv::new();

    // フィード追加
    let output = env
        .cmd()
        .args(["feed", "add", "https://zenn.dev/feed"])
        .output()
        .expect("Failed to run command");

    assert!(
        output.status.success(),
        "feed add failed: {:?}",
        String::from_utf8_lossy(&output.stderr)
    );

    // フィード一覧に表示されること
    env.cmd()
        .args(["feed", "list"])
        .assert()
        .success()
        .stdout(predicate::str::contains("zenn.dev"));
}

#[test]
fn feed_add_invalid_url_fails() {
    let env = TestEnv::new();
    env.cmd()
        .args(["feed", "add", "not-a-url"])
        .assert()
        .failure();
}
