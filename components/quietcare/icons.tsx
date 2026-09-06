import Image from "next/image";

type IconProps = { size?: number; className?: string };

function AssetIcon({ name, size = 24, className = "" }: IconProps & { name: string }) {
  return <Image className={className} src={`/assets/icons/${name}.svg`} alt="" width={size} height={size} aria-hidden />;
}

export function ArrowLeft(props: IconProps) { return <AssetIcon name="arrow-left" {...props} />; }
export function Camera(props: IconProps) { return <AssetIcon name="camera" {...props} />; }
export function Folder(props: IconProps) { return <AssetIcon name="folder" {...props} />; }
export function Edit(props: IconProps) { return <AssetIcon name="edit" {...props} />; }
export function Plus(props: IconProps) { return <AssetIcon name="plus" {...props} />; }
export function Share(props: IconProps) { return <AssetIcon name="share" {...props} />; }
export function Download(props: IconProps) { return <AssetIcon name="download" {...props} />; }
export function Expand(props: IconProps) { return <AssetIcon name="expand" {...props} />; }
export function UserCircle(props: IconProps) { return <AssetIcon name="user-circle" {...props} />; }
export function Sun(props: IconProps) { return <AssetIcon name="sun" {...props} />; }
export function Moon(props: IconProps) { return <AssetIcon name="moon" {...props} />; }
export function Info(props: IconProps) { return <AssetIcon name="information-circle" {...props} />; }

export function Check({ size = 18, className = "" }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m6 12 4 4 8-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Bell({ size = 18, className = "" }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

export function Clock({ size = 18, className = "" }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export function ActivityIcon({ size = 18, className = "" }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

export function SendIcon({ size = 18, className = "" }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}
