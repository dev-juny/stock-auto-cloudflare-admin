import oracledb from 'oracledb';
import dotenv from 'dotenv';

dotenv.config();

// 환경 변수 읽기
const walletPath = process.env.ORACLE_WALLET_PATH || '';
const dsn = process.env.ORACLE_DSN || '';
const dbUser = process.env.DB_USER || '';
const dbPassword = process.env.DB_PASSWORD || '';

console.log('=== Oracle 연결 테스트 ===');
console.log(`Wallet: ${walletPath || '미설정'}`);
console.log(`DSN: ${dsn || '미설정'}`);
console.log(`User: ${dbUser || '미설정'}`);

const start = async () => {
  // 체크리스트
  if (!walletPath) {
    console.error('\n[ERROR] ORACLE_WALLET_PATH가 비어있습니다.');
    console.log('-> .env 파일에 Wallet 압축 해제 경로를 입력하세요.');
    process.exit(1);
  }
  if (!dsn) {
    console.error('\n[ERROR] ORACLE_DSN이 비어있습니다.');
    console.log('-> tnsnames.ora 파일에서 alias를 확인하고 .env에 입력하세요.');
    process.exit(1);
  }

  try {
    // 1. Wallet 초기화
    console.log('\n1. Oracle Instant Client Wallet 초기화...');
    oracledb.initOracleClient({ configDir: walletPath });
    console.log('   -> 성공');

    // 2. 연결 시도
    console.log('2. Oracle DB 연결 시도...');
    const conn = await oracledb.getConnection({
      user: dbUser,
      password: dbPassword,
      connectString: dsn,
    });
    console.log('   -> 성공');

    // 3. SELECT 1 실행
    console.log('3. SELECT 1 실행...');
    const result = await conn.execute('SELECT 1 AS result FROM DUAL');
    console.log('   -> 성공:', result.rows);

    console.log('\n✅ 모든 연결 검증이 완료되었습니다.');
    await conn.close();
  } catch (error: any) {
    console.error('\n❌ 연결 실패:', error.message);
    console.log('\n🔍 가장 먼저 확인할 항목:');
    console.log('   1. .env 파일의 ORACLE_WALLET_PATH에 wallet 폴더 경로가 정확한지 확인');
    console.log('   2. Wallet 폴더 안에 cwallet.sso, tnsnames.ora 파일이 있는지 확인');
    console.log('   3. tnsnames.ora에서 ORACLE_DSN alias 이름이 맞는지 확인');
    console.log('   4. DB_USER, DB_PASSWORD가 맞는지 확인 (기본: ADMIN)');
    console.log('   5. OCI 콘솔에서 Autonomous Database가 Running 상태인지 확인');
    process.exit(1);
  }
};

start();
