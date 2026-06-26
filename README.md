# 별숲 블로그 보드

Supabase를 저장소로 쓰는 공유 블로그/게시판입니다. 별똥별이 보이는 숲 배경을 기본으로 넣었고, 나중에 배경 이미지 URL만 바꿔도 분위기를 교체할 수 있습니다.

## 설치

1. `install.html`을 엽니다.
2. Supabase 프로젝트 URL과 publishable/anon key를 입력합니다.
3. Supabase Auth 설정에서 **Anonymous sign-ins**를 켭니다.
4. 설치 페이지의 SQL을 Supabase SQL Editor에서 실행합니다.
5. 연결 테스트를 눌러 현재 User ID를 관리자 ID로 지정합니다.
6. `config.js`를 생성해서 배포본에 반영합니다.
7. 운영 배포 전 `remove-installer.ps1`을 실행하거나 `install.html`, `install.js`, `remove-installer.ps1`을 배포본에서 제외합니다.

## 모드

- 게시판: 방문자도 익명 로그인으로 글을 작성할 수 있습니다.
- 블로그: `forest_site_settings.owner_user_id`와 같은 관리자만 글을 작성할 수 있습니다.

## 파일

- `index.html`: 실제 앱
- `install.html`: 설치 화면
- `install.js`: 설치 화면 로직
- `config.js`: 배포 설정
- `styles.css`: 숲 테마 UI
- `app.js`: Supabase 연결, 모드 전환, 글 CRUD
- `supabase-schema.sql`: 테이블과 기본 RLS 정책
- `remove-installer.ps1`: 설치 후 설치 파일 제거 스크립트
- `assets/shooting-star-forest.png`: 기본 배경 이미지

Supabase publishable/anon key는 브라우저에 노출되는 공개 키입니다. 실제 쓰기 권한은 Supabase RLS 정책으로 관리하세요.
