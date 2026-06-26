# 별숲 커뮤니티

GitHub Pages 같은 정적 호스팅에 올릴 수 있는 Supabase 기반 게시판 CMS입니다. 전통적인 그누보드처럼 PHP 서버를 쓰지는 않지만, 게시판/블로그/댓글/관리자 설정을 프론트엔드와 Supabase RLS로 처리합니다.

## 들어간 기능

- 여러 게시판: 공지사항, 자유게시판, 질문답변, 블로그 기본 생성
- 게시판형 목록: 번호, 제목, 분류, 글쓴이, 날짜, 조회
- 블로그형 목록: 카드형 글 목록
- 댓글 작성/삭제
- 조회수 증가 RPC
- 공지글 고정
- 게시판별 쓰기 권한: 모두 또는 관리자
- 관리자 패널: 사이트 제목, 기본 게시판, 배경, 테마, 스킨, 게시판 생성/수정
- 설치 페이지: SQL 복사, Supabase 연결 테스트, 관리자 User ID 확인, `config.js` 생성
- 설치 후 제거 스크립트: `install.html`, `install.js`, `remove-installer.js`, `remove-installer.ps1` 삭제
- 프록시 모드: `apiBaseUrl`로 DB 접근을 Edge Function에 맡겨 service-role key를 숨깁니다.
- 관리자 로그인: 카카오 계정의 User ID가 관리자 ID와 일치할 때만 로그인 상태를 유지합니다.

## 설치 순서

### 쉬운 모드: Supabase 직접 연결

1. `install.html`을 엽니다.
2. Supabase 프로젝트 URL과 publishable/anon key를 입력합니다.
3. Supabase Auth 설정에서 **Anonymous sign-ins**를 켭니다.
4. 설치 페이지의 SQL을 Supabase SQL Editor에서 실행합니다.
5. 연결 테스트를 눌러 현재 User ID를 관리자 ID로 지정합니다.
6. `공유 설정 저장`을 눌러 Supabase에 관리자 ID와 기본 설정을 저장합니다.
7. `config.js`를 생성해서 배포본에 반영합니다.
8. 운영 배포 전 `node remove-installer.js`를 실행하거나 설치 파일들을 배포에서 제외합니다.

이 모드는 GitHub Pages만으로 배포하기 쉽지만 publishable/anon key가 브라우저에 보입니다. 이 키는 원래 공개용이고, 실제 보호는 RLS 정책이 담당합니다.

## 소셜 로그인 설정

카카오 로그인을 쓰려면 Supabase Dashboard에서 Kakao Provider를 켜야 합니다.

1. Supabase Dashboard > Authentication > Providers로 갑니다.
2. Kakao Provider를 켭니다.
3. Kakao Client ID / Secret을 입력합니다.
4. `config.js`의 `oauthRedirectUrl`에 실제 배포 주소를 넣습니다. GitHub Pages라면 `https://계정.github.io/저장소/`처럼 마지막 `/`까지 포함합니다.
5. Authentication > URL Configuration에서 Site URL과 Redirect URLs에 같은 주소를 정확히 넣습니다.
6. Kakao Developers의 Redirect URI에는 Supabase Dashboard에 표시된 `https://<project-ref>.supabase.co/auth/v1/callback`을 넣습니다.
7. 사이트에서 카카오 로그인 후 관리자 페이지의 `내 ID 사용`을 누르고 `공유 설정 저장`을 누릅니다.

이후 `owner_user_id`가 소셜 로그인 계정의 User ID로 고정돼서, 익명 로그인처럼 도메인마다 ID가 달라지는 문제가 줄어듭니다.

`config.js`의 `oauthProviders`는 `["kakao"]`만 사용합니다.

카카오 로그인은 관리자 전용입니다. 이미 `owner_user_id`가 지정된 상태에서 다른 카카오 계정으로 로그인하면 세션을 종료하고 손님 상태로 되돌립니다.

### 프록시 + 카카오 로그인 모드

1. Supabase SQL Editor에서 `supabase-schema.sql`을 실행합니다.
2. Supabase Edge Function `supabase/functions/forest-proxy`를 배포합니다.
3. 함수 시크릿에 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`를 넣습니다. `ADMIN_TOKEN`은 비상 관리자 토큰으로 선택입니다. 필요하면 `CORS_ORIGIN`도 넣습니다.
4. Supabase Authentication > Providers에서 Kakao를 켜고, Kakao Developers에도 Supabase가 안내하는 callback URL을 등록합니다.
5. `install.html`에서 프록시 API URL, Supabase URL, publishable/anon key를 입력하고 `config.js`를 생성합니다. API URL은 `https://<project-ref>.supabase.co/functions/v1/forest-proxy` 형태입니다.
6. 배포된 사이트에서 Kakao 로그인 후 관리자 패널의 `내 ID 사용`을 누르고 `공유 설정 저장`을 누릅니다.

이 모드에서 브라우저에 보이는 Supabase publishable/anon key는 Auth 로그인 시작용입니다. DB 쓰기용 service-role key는 Edge Function 시크릿에만 있고 브라우저로 나가지 않습니다. Cloudflare가 필수는 아닙니다. Supabase Edge Functions를 쓰면 추가 가입 없이 같은 Supabase 프로젝트 안에서 처리할 수 있습니다.

## 권한 구조

- 방문자: 익명 로그인 후 `write_role = all` 게시판에 글/댓글 작성 가능
- 관리자: `forest_site_settings.owner_user_id`와 일치하는 User ID
- 블로그/공지 전용 게시판: `write_role = owner`
- 실제 제한은 Supabase RLS 정책에서 처리합니다.
- 프록시 모드에서는 Edge Function이 Supabase Auth access token을 확인해서 오너/작성자 권한을 처리합니다. `ADMIN_TOKEN`은 선택적인 비상 우회키입니다.

## RLS가 막을 때

직접 연결 모드에서 블로그/공지 작성이 막히면, 보통 설치 페이지에서 저장한 익명 User ID와 실제 배포 페이지의 익명 User ID가 다른 상황입니다. `file://`, 로컬 서버, GitHub Pages는 origin이 달라서 Supabase 익명 로그인 ID가 달라질 수 있습니다.

1. 실제 배포된 `index.html`을 엽니다.
2. 관리자 패널에서 현재 `User ID`를 확인합니다.
3. Supabase SQL Editor에서 아래 SQL을 실행합니다.

```sql
update public.forest_site_settings
set owner_user_id = '여기에_현재_User_ID'
where id = 'main';
```

그 뒤 새로고침하면 블로그/공지/게시판 관리 권한이 맞아야 합니다.

## 배경 변경

관리자 패널의 배경 이미지 URL 또는 `config.js`의 `backgroundUrl`을 바꾸면 됩니다. 기본 배경은 `assets/shooting-star-forest.png`입니다.

## 파일

- `index.html`: 실제 앱
- `app.js`: 게시판 CMS 로직
- `styles.css`: 스킨과 반응형 UI
- `install.html`: 설치 화면
- `install.js`: 설치 도우미
- `config.js`: 배포 설정
- `supabase-schema.sql`: Supabase 테이블/RLS/RPC
- `supabase/functions/forest-proxy`: Supabase Edge Function 프록시
- `supabase/config.toml`: Edge Function 공개 호출 설정
- `proxy/cloudflare-worker.js`: Cloudflare를 쓰고 싶을 때의 대체 프록시
- `remove-installer.js`: 설치 후 정리 스크립트
- `remove-installer.ps1`: Windows PowerShell용 정리 스크립트
