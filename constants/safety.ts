const blockedPatterns: { pattern: RegExp; reason: string }[] = [
  { pattern: /(死ね|殺す|消えろ|レイプ)/i, reason: '脅迫・嫌がらせにあたる表現が含まれています。' },
  { pattern: /(児童ポルノ|child\s*(porn|sexual))/i, reason: '児童の搾取に関する表現は投稿できません。' },
  { pattern: /(nudes?|裸の写真).*(送れ|send)/i, reason: '性的な画像を要求する表現は投稿できません。' },
];

export function validateUserContent(text: string) {
  const normalized = text.normalize('NFKC');
  if (normalized.length > 2000) return 'メッセージは2,000文字以内で入力してください。';
  return blockedPatterns.find(({ pattern }) => pattern.test(normalized))?.reason ?? null;
}

export const reportReasons = [
  { value: 'harassment', label: '嫌がらせ・いじめ' },
  { value: 'hate', label: '差別・ヘイト' },
  { value: 'sexual', label: '性的な内容・児童の安全' },
  { value: 'violence', label: '暴力・脅迫' },
  { value: 'spam', label: 'スパム・詐欺' },
  { value: 'privacy', label: '個人情報の侵害' },
  { value: 'other', label: 'その他' },
] as const;
