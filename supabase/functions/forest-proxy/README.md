# Supabase Edge Function 프록시

Cloudflare 가입 없이 Supabase 안에서 공개키 숨김 모드를 쓰기 위한 함수입니다.

## 배포 개념

- 함수 URL: `https://<project-ref>.supabase.co/functions/v1/forest-proxy`
- 프론트 `config.js`: `apiBaseUrl`에 위 URL만 넣습니다.
- 브라우저에는 Supabase URL/key/service-role key가 들어가지 않습니다.
- 블로그/공지/관리자 작업은 `ADMIN_TOKEN`으로 로그인합니다.

## 필요한 시크릿

Supabase Edge Functions는 기본적으로 `SUPABASE_URL`과 서비스 키 계열 환경변수를 사용할 수 있습니다. 이 함수는 다음 값을 사용합니다.

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` 또는 `SUPABASE_SECRET_KEYS`
- `ADMIN_TOKEN`
- `CORS_ORIGIN` 선택. GitHub Pages 주소를 넣으면 그 주소만 허용합니다.

## 설정

`supabase/config.toml`에 아래 설정이 들어가 있어야 방문자도 함수를 호출할 수 있습니다.

```toml
[functions.forest-proxy]
verify_jwt = false
```

관리자 작업은 JWT 대신 `ADMIN_TOKEN`으로 막습니다.
