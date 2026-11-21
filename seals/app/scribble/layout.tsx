import BoardShell from "@/app/components/BoardShell";
import { BoardProvider } from "@/store/BoardProvider";

export default function ScribbleLayout({ children }: { children: React.ReactNode }) {
    return (
        <BoardProvider>
            <BoardShell>{children}</BoardShell>
        </BoardProvider>
    );
}
