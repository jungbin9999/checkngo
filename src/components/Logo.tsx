import Image from 'next/image';

// check&go 브랜드 로고 (아이콘 + 워드마크 락업). 원본 에셋: public/logo.png
export function Logo({ className, priority = false }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/logo.png"
      alt="check&go"
      width={1964}
      height={716}
      priority={priority}
      className={className}
    />
  );
}
