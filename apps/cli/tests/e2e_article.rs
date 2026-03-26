mod e2e_helpers;

use e2e_helpers::TestEnv;

#[test]
fn article_list_returns_success() {
    let env = TestEnv::new();
    env.cmd().args(["article", "list"]).assert().success();
}

#[test]
fn article_list_unread_filter() {
    let env = TestEnv::new();
    env.cmd()
        .args(["article", "list", "--unread"])
        .assert()
        .success();
}

#[test]
fn article_read_nonexistent_fails() {
    let env = TestEnv::new();
    env.cmd()
        .args(["article", "read", "nonexistent-id"])
        .assert()
        .failure();
}
