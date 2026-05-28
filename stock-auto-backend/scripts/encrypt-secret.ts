import { encryptValue } from '../src/utils/crypto';

// 사용법: MASTER_SECRET=<키> npm run encrypt <값>
const secret = process.env.MASTER_SECRET;
const text = process.argv[2];

if (!secret || !text) {
  console.log('');
  console.log('❌ 사용 예시:');
  console.log('  $env:MASTER_SECRET="my-secret-key"');
  console.log('  npm run encrypt "내비밀번호"');
  console.log('');
  process.exit(1);
}

console.log('🔒 암호화 결과 (.env에 복사하세요):');
console.log('----------------------------------------');
console.log(encryptValue(text, secret));
console.log('----------------------------------------');
console.log('');
console.log('위 값을 .env 파일의 해당 항목에 붙여넣으세요.');
