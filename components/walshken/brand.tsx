import {
  ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Bell, Building2, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight,
  CircleAlert, Clock3, Compass, FileText, FolderKanban, Globe2, GraduationCap, History, LayoutGrid, ListChecks, LockKeyhole,
  MapPin, Menu, MessageSquare, Monitor, Paperclip, Plane, Plus, Plug, ReceiptText, Scale, Search, Settings2, ShieldCheck, SlidersHorizontal,
  TimerReset, Users, UserRound, Video, Wallet, X, BriefcaseBusiness, BookOpenCheck, ChartNoAxesCombined, Coffee, LogOut,
  CalendarOff, Landmark, Mail, MoveUpRight, Send, Download, CircleCheck, CircleHelp, Ellipsis, Hash, CircleDot, PanelLeftClose,
} from "lucide-react";

const icons = {
  right: ArrowRight, left: ArrowLeft, external: ArrowUpRight, downRight: ArrowDownRight, menu: Menu, close: X, search: Search,
  down: ChevronDown, next: ChevronRight, previous: ChevronLeft, plus: Plus, tick: Check, help: CircleHelp, alert: CircleAlert,
  globe: Globe2, pin: MapPin, services: BriefcaseBusiness, technology: Monitor, accounting: Landmark, travel: Plane, immigration: Compass,
  education: GraduationCap, taxation: ReceiptText, paralegal: Scale, layout: LayoutGrid, message: MessageSquare, video: Video,
  check: BookOpenCheck, project: FolderKanban, calendar: CalendarDays, clock: Clock3, shift: TimerReset, list: ListChecks, wallet: Wallet,
  leave: CalendarOff, file: FileText, users: Users, bell: Bell, user: UserRound, building: Building2, shield: ShieldCheck, lock: LockKeyhole,
  chart: ChartNoAxesCombined, history: History, settings: Settings2, plug: Plug, filter: SlidersHorizontal, attachment: Paperclip,
  coffee: Coffee, logout: LogOut, mail: Mail, move: MoveUpRight, send: Send, download: Download, success: CircleCheck,
  more: Ellipsis, hash: Hash, dot: CircleDot, panel: PanelLeftClose,
};

export function Icon({ name, size = 20, className }: { name: string; size?: number; className?: string }) {
  const Glyph = icons[name as keyof typeof icons] ?? BriefcaseBusiness;
  return <Glyph className={className} size={size} strokeWidth={1.75} aria-hidden="true" />;
}

export function Brand({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return <a className={`brand${compact ? " brand-compact" : ""}`} href={href} aria-label="Walshken home">
    <img src="/favicon.svg" width="42" height="42" alt="" />
    <span>Walshken<span className="brand-period">.</span></span>
  </a>;
}
