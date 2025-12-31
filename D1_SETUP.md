# D1로 한 번에 옮긴 버전 (B안)

이 버전은 **민원/건의 + 소개페이지(agency/rank/department) 관리자 수정까지 전부 D1**로 저장하도록 바꾼 전체본이야.

구성
- Render/Express: 화면(EJS) 렌더 + R2 파일 업로드
- Cloudflare Worker(D1 API): D1 CRUD API 제공 (Express가 여기로 fetch)

## 1) Cloudflare D1 만들기
1. Cloudflare Dashboard → Workers & Pages → D1
2. 데이터베이스 생성 (예: jellypolice)
3. Database ID를 복사

## 2) Worker(D1 API) 배포
1. 터미널에서 d1-worker로 이동 후 의존성 설치
2. d1-worker/wrangler.toml에서 아래 2개를 수정
   - database_id: 너가 만든 D1 Database ID
   - API_TOKEN: 랜덤한 긴 문자열(관리자 보호용)
3. D1 스키마 적용
   - d1-worker/schema.sql 내용을 D1에 실행
4. 배포

## 3) Render(Express) 환경변수
Render 서비스 환경변수에 아래 추가
- D1_API_BASE: Worker 배포 URL (예: https://jelly-d1-api.<subdomain>.workers.dev)
- D1_API_TOKEN: Worker의 API_TOKEN과 같은 값

R2 환경변수는 기존 그대로 사용
- R2_ENDPOINT, R2_ACCESS_KEY, R2_SECRET_KEY, R2_BUCKET_NAME

## 4) 동작 확인
- /intro/agency, /intro/rank, /intro/department 열어서 정상 출력
- /admin에서 소개페이지 수정 저장 → 새로고침 후 반영 확인
- 민원/건의 제출 후 /admin/inquiry, /admin/suggest에서 목록 확인
