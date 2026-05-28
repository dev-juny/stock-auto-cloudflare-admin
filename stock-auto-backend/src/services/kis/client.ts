import { config } from '../../config';
import { logger } from '../../utils/logger';
import { getAccessToken } from './auth';
import { parseKisAccount, KisAccount } from './account';

export class KisClient {
  private account: KisAccount;

  constructor() {
    this.account = parseKisAccount(config.KIS_ACCOUNT_NUMBER);
  }

  async request(path: string, trId: string, method: string = 'GET', body?: any, params?: Record<string, string>) {
    const token = await getAccessToken();
    let url = `${config.KIS_BASE_URL}${path}`;

    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'appkey': config.KIS_API_KEY,
      'appsecret': config.KIS_API_SECRET,
      'authorization': `Bearer ${token}`,
      'tr_id': trId,
      'custtype': 'P',
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data: any = await response.json();

    if (!response.ok) {
      throw new Error(`API Error ${path}: ${JSON.stringify(data)}`);
    }

    if (data.rt_cd && data.rt_cd !== '0') {
      throw new Error(`KIS API Error: ${data.msg1} (${data.msg_cd})`);
    }

    return data;
  }

  async checkBalance() {
    logger.info('잔고조회 시도...', this.account);
    return this.request(
      '/uapi/domestic-stock/v1/trading/inquire-balance',
      config.KIS_IS_MOCK ? 'VTTC8434R' : 'TTTC8434R',
      'GET',
      undefined,
      {
        CANO: this.account.CANO,
        ACNT_PRDT_CD: this.account.ACNT_PRDT_CD,
        AFHR_FLPR_YN: 'N',
        OFL_YN: '',
        INQR_DVSN: '02',
        UNPR_DVSN: '01',
        FUND_STTL_ICLD_YN: 'N',
        FNCG_AMT_AUTO_RDPT_YN: 'N',
        PRCS_DVSN: '01',
        CTX_AREA_FK100: '',
        CTX_AREA_NK100: '',
      }
    );
  }

  async checkQuote(stockCode: string) {
    logger.info(`시세조회 시도: ${stockCode}`);
    return this.request(
      `/uapi/domestic-stock/v1/quotations/inquire-price?fid_cond_mrkt_div_code=J&fid_input_iscd=${stockCode}`,
      'FHKST01010100',
      'GET'
    );
  }

  async fetchDailyChart(stockCode: string, startDate: string, endDate: string, marketCode: string = 'J') {
    logger.info(`일봉데이터 조회: ${stockCode} (${startDate}~${endDate})`);
    return this.request(
      '/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice',
      'FHKST03010100',
      'GET',
      undefined,
      {
        FID_COND_MRKT_DIV_CODE: marketCode,
        FID_INPUT_ISCD: stockCode,
        FID_INPUT_DATE_1: startDate,
        FID_INPUT_DATE_2: endDate,
        FID_PERIOD_DIV_CODE: 'D',
      }
    );
  }

  getAccount() {
    return this.account;
  }
}

let _kisClient: KisClient | null = null;
export const getKisClient = (): KisClient => {
  if (!_kisClient) _kisClient = new KisClient();
  return _kisClient;
};
