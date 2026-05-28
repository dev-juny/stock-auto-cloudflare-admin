# VM Systemd 설정 가이드

## 1. 마스터 키를 이용한 암호화
로컬에서 암호화된 값을 생성합니다.

```powershell
cd stock-auto-backend
$env:MASTER_SECRET="아무거나_랜덤_문자열"
npm run encrypt "DB_비밀번호"
npm run encrypt "KIS_API_KEY"
npm run encrypt "KIS_API_SECRET"
```

## 2. .env 파일 수정 (VM 내부)
`/home/ubuntu/stock-auto-backend/.env` 파일에서 암호화된 값으로 교체합니다.

```ini
PORT=4000
NODE_ENV=production
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=$2b$10$...
ORACLE_WALLET_PATH=/home/ubuntu/wallet
ORACLE_DSN=mydb_high
DB_USER=ADMIN

# 아래 값은 암호화된 문자열 (ENC:...)로 교체
DB_PASSWORD=ENC:...
KIS_API_KEY=ENC:...
KIS_API_SECRET=ENC:...
KIS_ACCOUNT_NUMBER=ENC:...

KIS_BASE_URL=https://openapi.koreainvestment.com:9443
KIS_WS_URL=wss://openapi.koreainvestment.com:21000
```

## 3. Systemd 서비스 등록 (VM 내부)
```bash
# 서비스 파일 복사
sudo cp deploy/vm/stock-backend.service /etc/systemd/system/

# 파일 편집 (MASTER_SECRET 입력)
sudo nano /etc/systemd/system/stock-backend.service
# Environment="MASTER_SECRET=..." 부분에 실제 키 입력

# 권한 설정 (root만 읽기 가능)
sudo chmod 600 /etc/systemd/system/stock-backend.service

# 서비스 실행
sudo systemctl daemon-reload
sudo systemctl enable stock-backend
sudo systemctl start stock-backend

# 상태 확인
sudo systemctl status stock-backend
```

## 4. 로그 확인
```bash
sudo journalctl -u stock-backend -f
```
