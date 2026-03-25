use std::time::Duration;

use anyhow::{bail, Context, Result};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

const CALLBACK_TIMEOUT_SECS: u64 = 120;
const MAX_PORT_ATTEMPTS: u16 = 10;
const MAX_REQUEST_SIZE: usize = 16384;

pub struct OAuthResult {
    pub token: String,
}

fn build_callback_html(auth_url: &str, expected_state: &str) -> String {
    format!(
        r#"<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>bookmark-rss login</title></head>
<body>
<p id="status">Logging in...</p>
<script>
(async function() {{
  const status = document.getElementById('status');
  try {{
    const params = new URLSearchParams(window.location.search);
    const state = params.get('state');
    if (state !== '{expected_state}') {{
      throw new Error('Invalid state parameter');
    }}

    const sessionRes = await fetch('{auth_url}/auth/get-session', {{
      credentials: 'include'
    }});
    if (!sessionRes.ok) throw new Error('Failed to get session');
    const session = await sessionRes.json();
    const sessionToken = session.session.token;

    const tokenRes = await fetch('{auth_url}/auth/token', {{
      method: 'POST',
      headers: {{ 'Authorization': 'Bearer ' + sessionToken }}
    }});
    if (!tokenRes.ok) throw new Error('Failed to get JWT');
    const data = await tokenRes.json();

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/complete';
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'token';
    input.value = data.token;
    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
  }} catch (e) {{
    status.textContent = 'Login failed: ' + e.message;
  }}
}})();
</script>
</body></html>"#
    )
}

fn build_success_html() -> &'static str {
    r#"<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>bookmark-rss login</title></head>
<body><p>Login complete! You can close this tab.</p></body></html>"#
}

fn parse_request_line(buf: &[u8]) -> Option<(String, String)> {
    let request = String::from_utf8_lossy(buf);
    let first_line = request.lines().next()?;
    let parts: Vec<&str> = first_line.split_whitespace().collect();
    if parts.len() >= 2 {
        Some((parts[0].to_string(), parts[1].to_string()))
    } else {
        None
    }
}

fn extract_token_from_post_body(buf: &[u8]) -> Option<String> {
    let body_str = String::from_utf8_lossy(buf);
    let body = body_str.split("\r\n\r\n").nth(1)?;
    for param in body.split('&') {
        let mut kv = param.splitn(2, '=');
        if kv.next() == Some("token") {
            return kv.next().map(|v| {
                urlencoding::decode(v.trim())
                    .unwrap_or_default()
                    .into_owned()
            });
        }
    }
    None
}

fn extract_state_from_query(path: &str) -> Option<String> {
    let query = path.split('?').nth(1)?;
    for param in query.split('&') {
        let mut kv = param.splitn(2, '=');
        if kv.next() == Some("state") {
            return kv
                .next()
                .map(|v| urlencoding::decode(v).unwrap_or_default().into_owned());
        }
    }
    None
}

pub fn generate_state() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos();
    format!("{:x}{:x}", nanos, std::process::id())
}

async fn send_response(stream: &mut tokio::net::TcpStream, status: &str, body: &str) -> Result<()> {
    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    stream
        .write_all(response.as_bytes())
        .await
        .context("Failed to write response")?;
    stream.flush().await.context("Failed to flush response")?;
    Ok(())
}

async fn read_request(stream: &mut tokio::net::TcpStream) -> Result<Vec<u8>> {
    let mut buf = Vec::with_capacity(8192);
    let mut tmp = [0u8; 1024];
    loop {
        let n = stream
            .read(&mut tmp)
            .await
            .context("Failed to read request")?;
        if n == 0 {
            break;
        }
        buf.extend_from_slice(&tmp[..n]);
        if buf.windows(4).any(|w| w == b"\r\n\r\n") {
            break;
        }
        if buf.len() > MAX_REQUEST_SIZE {
            bail!("Request too large");
        }
    }
    Ok(buf)
}

pub async fn find_available_port(base_port: u16) -> Result<(TcpListener, u16)> {
    for offset in 0..MAX_PORT_ATTEMPTS {
        let port = base_port + offset;
        match TcpListener::bind(format!("127.0.0.1:{port}")).await {
            Ok(listener) => return Ok((listener, port)),
            Err(_) => continue,
        }
    }
    bail!(
        "No available port found in range {}-{}",
        base_port,
        base_port + MAX_PORT_ATTEMPTS - 1
    );
}

pub async fn wait_for_oauth_callback(
    listener: TcpListener,
    auth_url: &str,
    expected_state: &str,
) -> Result<OAuthResult> {
    let callback_html = build_callback_html(auth_url, expected_state);

    let result = tokio::time::timeout(
        Duration::from_secs(CALLBACK_TIMEOUT_SECS),
        handle_connections(listener, &callback_html, expected_state),
    )
    .await
    .context("Login timed out. Please try again.")?;

    result
}

async fn handle_connections(
    listener: TcpListener,
    callback_html: &str,
    expected_state: &str,
) -> Result<OAuthResult> {
    loop {
        let (mut stream, _) = listener
            .accept()
            .await
            .context("Failed to accept connection")?;

        let buf = read_request(&mut stream).await?;

        let (method, path) = match parse_request_line(&buf) {
            Some(parsed) => parsed,
            None => continue,
        };

        if method == "GET" && path.starts_with("/callback") {
            let state = extract_state_from_query(&path);
            if state.as_deref() != Some(expected_state) {
                send_response(&mut stream, "400 Bad Request", "Invalid state").await?;
                continue;
            }
            send_response(&mut stream, "200 OK", callback_html).await?;
        } else if method == "POST" && path.starts_with("/complete") {
            let token = extract_token_from_post_body(&buf);
            send_response(&mut stream, "200 OK", build_success_html()).await?;

            match token {
                Some(t) if !t.is_empty() => return Ok(OAuthResult { token: t }),
                _ => bail!("No token received in callback"),
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_token_from_post_body() {
        let request = b"POST /complete HTTP/1.1\r\nContent-Type: application/x-www-form-urlencoded\r\n\r\ntoken=abc123";
        assert_eq!(
            extract_token_from_post_body(request),
            Some("abc123".to_string())
        );
    }

    #[test]
    fn test_extract_token_encoded_post() {
        let request = b"POST /complete HTTP/1.1\r\n\r\ntoken=abc%20123";
        assert_eq!(
            extract_token_from_post_body(request),
            Some("abc 123".to_string())
        );
    }

    #[test]
    fn test_extract_token_missing_post() {
        let request = b"POST /complete HTTP/1.1\r\n\r\nother=value";
        assert_eq!(extract_token_from_post_body(request), None);
    }

    #[test]
    fn test_extract_state_from_query() {
        let path = "/callback?state=abc123&code=xyz";
        assert_eq!(extract_state_from_query(path), Some("abc123".to_string()));
    }

    #[test]
    fn test_extract_state_missing() {
        let path = "/callback?code=xyz";
        assert_eq!(extract_state_from_query(path), None);
    }

    #[test]
    fn test_parse_request_line() {
        let request = b"GET /callback?code=123 HTTP/1.1\r\nHost: localhost\r\n\r\n";
        let (method, path) = parse_request_line(request).unwrap();
        assert_eq!(method, "GET");
        assert_eq!(path, "/callback?code=123");
    }

    #[test]
    fn test_parse_request_line_post() {
        let request = b"POST /complete HTTP/1.1\r\nHost: localhost\r\n\r\n";
        let (method, path) = parse_request_line(request).unwrap();
        assert_eq!(method, "POST");
        assert_eq!(path, "/complete");
    }

    #[test]
    fn test_generate_state() {
        let state = generate_state();
        assert!(!state.is_empty());
        let state2 = generate_state();
        // Should be different (or at least non-empty)
        assert!(!state2.is_empty());
    }
}
