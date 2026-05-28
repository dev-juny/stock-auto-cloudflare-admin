import bcrypt from 'bcrypt';

// 사용법: npm run gen:hash <생성할 비밀번호>
const password = process.argv[2];

if (!password) {
  console.error('\n[오류] 비밀번호를 입력해주세요.');
  console.error('사용 예시: npm run gen:hash MySecretPassword123\n');
  process.exit(1);
}

console.log('🔒 비밀번호 해시 생성 중...');

bcrypt.genSalt(10, (err, salt) => {
  if (err) return console.error(err);

  bcrypt.hash(password, salt, (err, hash) => {
    if (err) return console.error(err);

    console.log('\n✅ 생성 완료! 아래 값을 .env 파일의 ADMIN_PASSWORD_HASH에 붙여넣으세요.\n');
    console.log('----------------------------------------');
    console.log(hash);
    console.log('----------------------------------------\n');
  });
});
