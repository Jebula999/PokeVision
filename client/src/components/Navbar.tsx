import { Button } from "@/components/ui/button";
import pokevisionLogo from "@assets/image6555_1758124202791.png";

const Navbar = () => {
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-card-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto max-w-6xl px-4 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Left: Logo */}
          <div className="flex items-center">
            <img 
              src={pokevisionLogo} 
              alt="PokéVision Logo" 
              className="h-10 w-auto"
              data-testid="logo-main"
            />
          </div>

          {/* Right: Navigation Links */}
          <div className="hidden md:flex items-center space-x-6">
            <a
              href="https://discord.gg/86pNbRzX4N"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-discord"
            >
              Discord
            </a>
            <a
              href="https://map.pokevision.co.za"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-map"
            >
              Map
            </a>
            <Button 
              asChild 
              className="metallic-gold-bg text-black hover:opacity-90 font-semibold"
              data-testid="button-signup"
            >
              <a href="https://ko-fi.com/pokevision" target="_blank" rel="noopener noreferrer">
                Sign Up
              </a>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => console.log('Mobile menu toggled')}
              data-testid="button-menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="4" x2="20" y1="12" y2="12"/>
                <line x1="4" x2="20" y1="6" y2="6"/>
                <line x1="4" x2="20" y1="18" y2="18"/>
              </svg>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;