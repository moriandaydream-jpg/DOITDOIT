# Supabase Edge Function 프록시

Cloudflare 가입 없이 Supabase 안에서 DB 접근을 숨기고, Supabase Auth 소셜 로그인 토큰을 검증하기 위한 함수입니다.

## 배포 개념

- 함수 URL: `https://<project-ref>.supabase.co/functions/v1/forest-proxy`
- 프론트 `config.js`: `apiBaseUrl`에 위 URL을 넣습니다.
- 카카오 같은 소셜 로그인을 쓰면 프론트에 Supabase URL과 publishable/anon key도 Auth 전용으로 넣습니다.
- 브라우저에는 service-role key가 들어가지 않습니다.
- 블로그/공지/관리자 작업은 Supabase Auth access token의 User ID로 확인합니다.
- `ADMIN_TOKEN`은 선택적인 비상 관리자 토큰입니다.

## 필요한 시크릿

Supabase Edge Functions는 기본적으로 `SUPABASE_URL`과 서비스 키 계열 환경변수를 사용할 수 있습니다. 이 함수는 다음 값을 사용합니다.

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` 또는 `SUPABASE_SECRET_KEYS`
- `ADMIN_TOKEN` 선택
- `CORS_ORIGIN` 선택. GitHub Pages 주소를 넣으면 그 주소만 허용합니다.

## 설정

`supabase/config.toml`에 아래 설정이 들어가 있어야 방문자도 함수를 호출할 수 있습니다.

```toml
[functions.forest-proxy]
verify_jwt = false
```

함수 호출 자체는 공개하되, 쓰기 권한은 함수 내부에서 Supabase Auth JWT 또는 `ADMIN_TOKEN`으로 확인합니다.
