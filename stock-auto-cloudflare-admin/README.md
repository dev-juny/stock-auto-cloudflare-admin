# stock-auto-cloudflare-admin

## 역할
자동매매 시스템의 관리자 대시보드입니다.
Cloudflare Workers + 정적 프론트엔드(Vite/React 등)로 구성되며, 포트폴리오 조회, 주문 내역 확인, 수동 매매 인터페이스를 제공합니다.

## 디렉토리 구조
- `src/` - 프론트엔드 소스 코드
- `public/` - 정적 에셋
- `wrangler.jsonc` / `wrangler.toml` - Cloudflare 배포 설정

## 아키텍처
- `stock-auto-backend`의 API를 Cloudflare Workers를 통해 프록시하거나 직접 호출합니다.
- CORS 및 인증 토큰 관리를 Cloudflare Edge에서 처리합니다.
