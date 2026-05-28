/**
 * 계좌번호 파싱 유틸리티
 * KIS API는 CANO(8자리)와 ACNT_PRDT_CD(2자리)를 별도로 요구함
 */
export interface KisAccount {
  CANO: string;
  ACNT_PRDT_CD: string;
}

export const parseKisAccount = (fullAccount: string): KisAccount => {
  const padded = fullAccount.length >= 10
    ? fullAccount
    : fullAccount.padEnd(8, '0') + '01';

  return {
    CANO: padded.substring(0, 8),
    ACNT_PRDT_CD: padded.substring(8, 10),
  };
};
