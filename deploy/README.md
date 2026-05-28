# deploy

## 역할
Oracle Cloud VM, Cloudflare Workers, 데이터베이스 마이그레이션 등 모든 환경의 배포 및 인프라 설정을 관리합니다.

## 디렉토리 구조
- `vm/` - Oracle Cloud VM 초기화 스크립트, systemd 서비스 파일, Docker Compose 설정
- `cloudflare/` - Workers 배포 설정, wrangler 환경 파일
- `db/` - Autonomous DB 마이그레이션 스크립트, Wallet 설정 가이드
- `ci-cd/` - GitHub Actions 워크플로우 파일 (선택적)

## 주의
- 이 폴더의 스크립트는 운영 환경(Production)에 직접 영향을 줍니다.
- 모든 변경은 반드시 테스트 환경(VTS)에서 검증 후 병합합니다.
- SSH 키, Wallet 파일, `.env` 등 민감 정보는 절대 커밋하지 않습니다.
