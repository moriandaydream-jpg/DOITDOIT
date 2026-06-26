# 배포 안내

## 기존 사이트 업데이트

GitHub Pages에는 아래 파일을 교체합니다.

- `index.html`
- `app.js`
- `styles.css`
- 설치 페이지를 아직 사용 중이면 `install.html`, `install.js`

기존 `config.js`에는 실제 Supabase 주소와 키가 들어 있으므로 백업하고, ZIP 안의 빈 기본 설정으로 덮어쓰지 마세요.

## 이번 버전 적용 순서

1. Supabase SQL Editor에서 최신 `supabase-schema.sql`을 다시 실행합니다.
2. 아래 명령으로 최신 Edge Function을 다시 배포합니다.
3. GitHub Pages의 `index.html`, `app.js`, `styles.css`를 교체합니다.
4. 설치 페이지를 아직 쓰면 `install.html`, `install.js`도 교체합니다.
5. 사이트를 새로고침하고 카카오 관리자 로그인, 게시글 열기, 댓글 등록을 확인합니다.

## Edge Function 업데이트

`supabase/functions/forest-proxy/index.ts`는 GitHub Pages가 아니라 Supabase Edge Functions에 배포합니다.

```bash
supabase functions deploy forest-proxy --no-verify-jwt --project-ref YOUR_PROJECT_REF
```

함수 URL은 `https://YOUR_PROJECT_REF.supabase.co/functions/v1/forest-proxy`입니다.

배포 확인 주소 `https://YOUR_PROJECT_REF.supabase.co/functions/v1/forest-proxy/api/settings`를 열었을 때 설정 JSON이 나오면 정상입니다. `인증 헤더 누락`이 나오면 `--no-verify-jwt` 배포가 적용되지 않은 상태입니다.
