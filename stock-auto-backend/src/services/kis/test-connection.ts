import dotenv from 'dotenv';
dotenv.config();

import { initSecureConfig, config } from '../../config';
initSecureConfig();

import { getAccessToken } from './auth';
import { parseKisAccount } from './account';

const log = (msg: string, detail?: any) => {
  console.log(`[TEST] ${msg}`);
  if (detail) console.log('       ', JSON.stringify(detail, null, 2));
};

const logError = (msg: string, err: any) => {
  console.error(`[FAIL] ${msg}`);
  if (err) console.error('       ', err.message || JSON.stringify(err, null, 2));
};

const runTest = async () => {
  console.log('\n========== KIS 연동 테스트 시작 ==========\n');

  log('1. 환경 변수 확인');
  const checks = [
    { name: 'KIS_BASE_URL', val: config.KIS_BASE_URL },
    { name: 'KIS_API_KEY', val: config.KIS_API_KEY ? '설정됨' : '미설정' },
    { name: 'KIS_API_SECRET', val: config.KIS_API_SECRET ? '설정됨' : '미설정' },
    { name: 'KIS_ACCOUNT_NUMBER', val: config.KIS_ACCOUNT_NUMBER || '미설정' },
  ];
  const missing = checks.filter(c => !c.val);
  if (missing.length > 0) {
    logError('필수 환경 변수 누락', missing.map(m => m.name));
    process.exit(1);
  }
  log('   모든 필수 값 설정됨');

  log('2. 계좌번호 파싱');
  let account;
  try {
    account = parseKisAccount(config.KIS_ACCOUNT_NUMBER);
    log('   분리 결과', account);
  } catch (e: any) {
    logError('계좌번호 파싱 실패', { input: config.KIS_ACCOUNT_NUMBER, error: e.message });
    process.exit(1);
  }

  log('3. Access Token 발급');
  let token;
  try {
    token = await getAccessToken();
    log('   토큰 발급 성공', { tokenPrefix: token.substring(0, 20) + '...' });
  } catch (e: any) {
    logError('토큰 발급 실패', e);
    console.log('   -> KIS_API_KEY, KIS_API_SECRET 또는 KIS_BASE_URL을 확인하세요.');
    process.exit(1);
  }

  log('4. 국내주식 잔고 조회');
  try {
    const url = `${config.KIS_BASE_URL}/uapi/domestic-stock/v1/trading/inquire-balance`;
    const response = await fetch(`${url}?CANO=${account.CANO}&ACNT_PRDT_CD=${account.ACNT_PRDT_CD}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'appkey': config.KIS_API_KEY,
        'appsecret': config.KIS_API_SECRET,
        'authorization': `Bearer ${token}`,
        'tr_id': config.KIS_IS_MOCK ? 'VTTC8434R' : 'TTTC8434R',
        'custtype': 'P',
      },
    });

    const data: any = await response.json();

    if (data.rt_cd && data.rt_cd !== '0') {
      logError('잔고 조회 API 오류 응답', {
        rt_cd: data.rt_cd,
        msg_cd: data.msg_cd,
        msg1: data.msg1,
        usedAccount: { CANO: account.CANO, ACNT_PRDT_CD: account.ACNT_PRDT_CD },
      });
      console.log('   -> 계좌번호 (CANO/ACNT_PRDT_CD) 또는 API 키 권한을 확인하세요.');
      process.exit(1);
    }

    if (!response.ok) {
      logError('HTTP 오류', { status: response.status, body: data });
      process.exit(1);
    }

    log('   잔고 조회 성공');
    
    const output = data.output;
    if (output) {
      log('   요약 정보', {
        총평가금액: output.nby_amt || '0',
        예수금: output.dnca_amt || '0',
        당일손익: output.fncg_amt || '0',
      });
    }
  } catch (e: any) {
    logError('잔고 조회 중 예외 발생', e);
    console.log('   -> 네트워크 연결 또는 BASE_URL을 확인하세요.');
    process.exit(1);
  }

  console.log('\n========== 모든 테스트 성공 ==========\n');
};

runTest().catch(console.error);
