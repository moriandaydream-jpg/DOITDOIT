# 프록시

브라우저에 Supabase publishable/anon key를 넣고 싶지 않을 때 쓰는 대체 프록시입니다.

Cloudflare Worker는 예시일 뿐이고 필수는 아닙니다. Vercel Functions, Netlify Functions, Supabase Edge Functions, 개인 서버도 같은 API 경로를 제공하면 됩니다.

추가 가입을 피하려면 `../supabase/functions/forest-proxy`를 먼저 봐. Supabase 프로젝트 안에서 바로 쓸 수 있는 버전입니다.

## 필요한 환경변수

- `SUPABASE_URL`: Supabase 프로젝트 URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key
- `ADMIN_TOKEN`: 블로그/관리자 로그인 토큰
- `CORS_ORIGIN`: 선택. GitHub Pages 주소를 넣으면 그 주소만 허용합니다. 비워두면 `*`입니다.

## 사용 흐름

1. Supabase SQL Editor에서 `../supabase-schema.sql`을 실행합니다.
2. Cloudflare Worker에 `cloudflare-worker.js`를 배포합니다.
3. Worker secret으로 위 환경변수를 넣습니다.
4. `install.html`에서 프록시 API URL과 관리자 토큰을 입력합니다.
5. `config.js`를 생성합니다. 이때 Supabase key는 비워지고 `apiBaseUrl`만 들어갑니다.

`SUPABASE_SERVICE_ROLE_KEY`는 절대 GitHub 저장소나 정적 호스팅에 올리지 마세요.

## Cloudflare 가입이 싫다면

Supabase 계정만 쓰고 싶으면 Supabase Edge Functions로 같은 프록시를 옮기면 됩니다. 구조는 같습니다.

- 프론트 `config.js`: `apiBaseUrl`만 공개
- 서버 함수 환경변수: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_TOKEN`
- 관리자 로그인: 설치 페이지/관리자 패널에서 `ADMIN_TOKEN` 입력
