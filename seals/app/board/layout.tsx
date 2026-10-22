import BoardShell from "@/app/components/BoardShell";
import { BoardProvider } from "@/store/BoardProvider";
export default function BoardLayout({ children }: { children: React.ReactNode }) {
  return <BoardProvider><BoardShell>{children}</BoardShell></BoardProvider>;
}
