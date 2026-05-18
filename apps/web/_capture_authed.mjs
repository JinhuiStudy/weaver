import { chromium } from '@playwright/test';

const browser = await chromium.launch({ 
  headless: false,
  args: ['--window-size=1440,900'],
});
const ctx = await browser.newContext({ 
  viewport: { width: 1440, height: 900 }, 
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

await page.goto('https://weaver-web.jinhuistudy.workers.dev/');

console.log('━'.repeat(60));
console.log('🌐 Chromium 새 창이 열렸습니다. 거기서 진행해주세요.');
console.log('');
console.log('📋 1단계 (90초):');
console.log('   ① "Sign in with GitHub" 클릭 → GitHub 로그인');
console.log('   ② 처음이면 핸들 입력 / 가입 절차');
console.log('   ③ /builder/new 또는 /builder/demo 진입');
console.log('');
console.log('⏳ 90초 후 1차 캡처...');
console.log('━'.repeat(60));

await page.waitForTimeout(90000);

await page.screenshot({ 
  path: '/Users/parkjinhui/Desktop/dev/marketing/screenshots/weaver-builder-step1.png',
  fullPage: false,
});
console.log('📸 1차 캡처 저장: weaver-builder-step1.png');
console.log('   현재 URL: ' + page.url());
console.log('');
console.log('━'.repeat(60));
console.log('📋 2단계 (75초):');
console.log('   ④ ⌘K → "input" → Enter');
console.log('   ⑤ ⌘K → "agent" → Enter');
console.log('   ⑥ ⌘K → "output" → Enter');
console.log('   ⑦ (선택) 노드 위치 드래그 / 연결');
console.log('   또는: 자연어 compose 입력');
console.log('');
console.log('⏳ 75초 후 최종 캡처...');
console.log('━'.repeat(60));

await page.waitForTimeout(75000);

await page.screenshot({ 
  path: '/Users/parkjinhui/Desktop/dev/marketing/screenshots/weaver-builder-real.png',
  fullPage: false,
});
console.log('📸 최종 캡처 저장: weaver-builder-real.png');
console.log('   현재 URL: ' + page.url());

await page.waitForTimeout(2000);
await ctx.close();
await browser.close();
console.log('');
console.log('✅ 완료');
