import logoSymbol from "@assets/POKE VISION LOGO_1757707181958.png";

const Footer = () => {
  return (
    <footer className="w-full py-8 border-t border-card-border bg-card/30">
      <div className="container mx-auto max-w-6xl px-4 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="flex flex-col items-center md:items-start space-y-2">
            <img 
              src={logoSymbol} 
              alt="PokéVision Symbol" 
              className="h-8 w-auto"
              data-testid="logo-footer"
            />
            <p className="text-muted-foreground text-center md:text-left">
              © PokéVision. Personalized location intelligence for modern businesses and enthusiasts.
            </p>
          </div>
          
          <div className="flex items-center space-x-6">
            <a
              href="https://discord.gg/86pNbRzX4N"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              data-testid="footer-link-discord"
            >
              Discord
            </a>
            <a
              href="https://map.pokevision.co.za"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              data-testid="footer-link-map"
            >
              Map
            </a>
            <a
              href="https://ko-fi.com/pokevision"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              data-testid="footer-link-kofi"
            >
              Ko-Fi
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;