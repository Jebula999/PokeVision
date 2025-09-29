import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import globeImage from "@assets/globe_1757705553393.png";
import pokevisionLogo from "@assets/image65555_1758147416107.png";

const Hero = () => {
  return (
    <section className="relative w-full overflow-hidden py-20 lg:py-32">
      {/* Background Earth Image */}
      <div 
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${globeImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center 30%',
          backgroundRepeat: 'no-repeat'
        }}
      />
      
      {/* Dark overlay to ensure text readability */}
      <div className="absolute inset-0 bg-black/60" />
      
      {/* Bottom fade to black for clean transition */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black via-black/90 to-transparent" />
      
      {/* Content */}
      <div className="relative z-10 container mx-auto max-w-6xl px-4 lg:px-8">
        <div className="flex flex-col items-center text-center space-y-8">
          {/* PokéVision Logo */}
          <div className="mb-6">
            <img 
              src={pokevisionLogo} 
              alt="PokéVision Logo" 
              className="h-44 md:h-56 lg:h-64 w-auto mx-auto drop-shadow-2xl"
              data-testid="logo-hero"
            />
          </div>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
            Custom Location Feeds for{" "}
            <span className="metallic-gold">Your Areas</span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl leading-relaxed">
            Please use the button bellow to request an area or get an idea on pricing. Reach out on Discord for any queries.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <Button 
              asChild
              variant="outline"
              size="lg"
              className="metallic-gold-border text-foreground hover:bg-primary/10 text-base px-8 py-3"
              data-testid="button-join-discord"
            >
              <a href="https://discord.gg/86pNbRzX4N" target="_blank" rel="noopener noreferrer">
                Join Discord
              </a>
            </Button>
            
            <Button 
              asChild
              size="lg"
              className="metallic-gold-bg text-black hover:opacity-90 text-base px-8 py-3 font-semibold"
              data-testid="button-request-area"
            >
              <Link href="/request-area">
                Request An Area
              </Link>
            </Button>
            
            <Button 
              asChild
              variant="outline"
              size="lg"
              className="metallic-gold-border text-foreground hover:bg-primary/10 text-base px-8 py-3"
              data-testid="button-view-map"
            >
              <a href="https://map.pokevision.co.za/" target="_blank" rel="noopener noreferrer">
                View Map
              </a>
            </Button>
          </div>
        </div>
      </div>
      
      {/* Decorative gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent pointer-events-none z-5" />
    </section>
  );
};

export default Hero;