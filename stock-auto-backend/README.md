# stock-auto-backend

## 역할
국내주식 자동매매 시스템의 핵심 백엔드 서버입니다.

## 기술 스택
- Node.js + TypeScript
- Express 4.x
- Oracle DB ( Autonomous Database )

## 디렉토리 구조
```
src/
├── index.ts           # 진입점, 서버 시작, Graceful Shutdown
├── server.ts          # Express 앱 및 미들웨어 설정
├── config/            # 환경 변수 관리
├── db/                # Oracle 연결 모듈 (풀 관리)
├── middleware/        # 인증, 에러 처리 미들웨어
├── routes/            # API 라우터 (health, auth, status)
├── services/          # 비즈니스 로직 (세션 관리)
└── utils/             # 로거 등 유틸리티
```

## 시작 방법
```bash
npm install
npm run dev        # 개발 서버 (포트 4000)
npm run build      # 프로덕션 빌드
npm start          # 프로덕션 실행
```

## API 엔드포인트

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| GET | `/api/health` | 서버 상태 확인 | 불필요 |
| GET | `/api/health/db` | DB 연결 상태 | 불필요 |
| POST | `/api/auth/login` | 관리자 로그인 | 불필요 |
| POST | `/api/auth/logout` | 로그아웃 | 필요 |
| GET | `/api/auth/me` | 현재 사용자 정보 | 필요 |
| GET | `/api/status` | 런타임 상태 읽기 | 필요 |
| POST | `/api/status` | 런타임 상태 쓰기 | 필요 |

## 환경 변수 및 보안

### 민감정보 암호화 (Systemd 방식)
`.env` 파일에 직접 평문을 저장하지 않고, **AES-256 암호화**된 값을 저장합니다.
마스터 키(`MASTER_SECRET`)는 **VM의 Systemd 서비스 파일**에만 저장되어 `.env` 유출 시에도 안전합니다.

1. **암호화**: `npm run encrypt "비밀번호"` 실행 후 출력된 `ENC:...` 값을 `.env`에 입력
2. **VM 설정**: `/etc/systemd/system/stock-backend.service`의 `Environment="MASTER_SECRET=..."` 에 마스터 키 입력
3. **실행**: `sudo systemctl start stock-backend` 시 자동으로 복호화되어 메모리에 로드됨

## 주의
- `src/`는 운영용 코드, `scripts/`는 실험용 코드로 분리합니다.
- `.env`, Wallet, 마스터 키는 절대 Git에 커밋하지 않습니다.
