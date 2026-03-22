import { Heart } from "lucide-react";

export default function AppFooter() {
  return (
    <footer className="border-t py-6 mt-auto">
      <div className="mx-auto max-w-6xl px-6 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
        <span>Made with</span>
        <Heart className="h-4 w-4 fill-red-500 text-red-500" />
        <span>by</span>
        <a
          href="https://github.com/hassard0"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-foreground hover:text-primary transition-colors underline underline-offset-4"
        >
          hassard0
        </a>
      </div>
    </footer>
  );
}
